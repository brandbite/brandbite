// -----------------------------------------------------------------------------
// @file: app/api/ai/generate/brief-parsing/route.ts
// @purpose: AI "brief parsing" — take a free-text description and return a
//           structured ticket draft (title, description, jobTypeId, quantity,
//           priority). Customer-only, idempotent, same token/rate-limit guards
//           as the other /api/ai/generate/* routes.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  getAiToolConfig,
  validateSufficientTokens,
  claimAiGeneration,
  refundAiTokens,
  checkRateLimit,
} from "@/lib/ai/cost-calculator";
import { readIdempotencyKey } from "@/lib/ai/idempotency";
import {
  buildBriefParsingSystemPrompt,
  buildBriefParsingPrompt,
  type BriefParseJobType,
} from "@/lib/ai/prompts";
import { generateText } from "@/lib/ai/provider-router";
import { insufficientTokensResponse } from "@/lib/errors/insufficient-tokens";
import { prisma } from "@/lib/prisma";

type ParsedBrief = {
  title: string;
  description: string;
  jobTypeId: string | null;
  quantity: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
};

const PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);

/** Trim common "```json ... ```" wrappers some models emit despite the prompt. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

function coerceParsedBrief(raw: unknown, validJobTypeIds: Set<string>): ParsedBrief {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title.trim().slice(0, 200) : "";
  const description = typeof obj.description === "string" ? obj.description.trim() : "";
  const jobTypeId =
    typeof obj.jobTypeId === "string" && validJobTypeIds.has(obj.jobTypeId) ? obj.jobTypeId : null;
  const qtyNum = typeof obj.quantity === "number" ? Math.round(obj.quantity) : 1;
  const quantity = Math.max(1, Math.min(qtyNum || 1, 100));
  const priority =
    typeof obj.priority === "string" && PRIORITIES.has(obj.priority.toUpperCase())
      ? (obj.priority.toUpperCase() as ParsedBrief["priority"])
      : "MEDIUM";
  return { title, description, jobTypeId, quantity, priority };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return NextResponse.json(
        { error: "Only company members can parse a brief." },
        { status: 403 },
      );
    }

    const idempotencyKey = readIdempotencyKey(req.headers);

    const body = await req.json();
    const { brief } = body as { brief?: string };
    if (!brief || brief.trim().length < 10) {
      return NextResponse.json(
        { error: "Brief is required (at least 10 characters)." },
        { status: 400 },
      );
    }
    if (brief.length > 4000) {
      return NextResponse.json(
        { error: "Brief is too long (max 4000 characters)." },
        { status: 400 },
      );
    }

    const toolConfig = await getAiToolConfig("BRIEF_PARSING");
    if (!toolConfig.enabled) {
      return NextResponse.json({ error: "Brief parsing is currently disabled" }, { status: 403 });
    }

    const rateLimit = await checkRateLimit(user.activeCompanyId, "BRIEF_PARSING");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt.toISOString(),
        },
        { status: 429 },
      );
    }

    const cost = toolConfig.tokenCost;
    const balance = await validateSufficientTokens(user.activeCompanyId, cost);
    if (!balance.sufficient) {
      return insufficientTokensResponse({
        required: cost,
        balance: balance.balance,
        action: "AI brief parsing",
      });
    }

    // Load the active job types so we can let the model pick one. Keep the
    // payload small — enough for the model to discriminate by name + short
    // description. All of these come from the same DB the ticket form reads.
    const jobTypesRaw = await prisma.jobType.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        hasQuantity: true,
        defaultQuantity: true,
      },
      orderBy: { name: "asc" },
    });

    const jobTypesForPrompt: BriefParseJobType[] = jobTypesRaw.map((j) => ({
      id: j.id,
      name: j.name,
      description: j.description,
      hasQuantity: j.hasQuantity,
      defaultQuantity: j.defaultQuantity,
    }));
    const validJobTypeIds = new Set(jobTypesRaw.map((j) => j.id));

    const systemPrompt = buildBriefParsingSystemPrompt(jobTypesForPrompt);
    const userPrompt = buildBriefParsingPrompt(brief);

    const { generation, reused } = await claimAiGeneration({
      idempotencyKey,
      userId: user.id,
      companyId: user.activeCompanyId,
      toolType: "BRIEF_PARSING",
      prompt: userPrompt,
      inputParams: { briefLength: brief.length },
      cost,
    });

    if (reused) {
      const prior = (generation.outputParams as { parsed?: ParsedBrief } | null)?.parsed;
      return NextResponse.json(
        {
          generation: {
            id: generation.id,
            status: generation.status,
            toolType: generation.toolType,
            provider: generation.provider,
            model: generation.model,
            parsed: prior ?? null,
            tokenCost: generation.tokenCost,
            createdAt: generation.createdAt.toISOString(),
          },
          reused: true,
        },
        { status: 200 },
      );
    }

    try {
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: { status: "PROCESSING", startedAt: new Date() },
      });

      const result = await generateText(userPrompt, systemPrompt, {
        maxTokens: 400,
        temperature: 0.3,
      });

      let parsed: ParsedBrief | null = null;
      try {
        parsed = coerceParsedBrief(JSON.parse(stripCodeFence(result.text)), validJobTypeIds);
      } catch (parseErr) {
        console.warn("[api/ai/generate/brief-parsing] JSON parse failed", parseErr);
      }

      if (!parsed || parsed.title.length === 0) {
        throw new Error("Model returned an unparseable response.");
      }

      const completed = await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          provider: result.provider,
          model: result.model,
          outputText: result.text,
          outputParams: {
            parsed,
            usage: result.usage,
          },
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          generation: {
            id: completed.id,
            status: completed.status,
            toolType: completed.toolType,
            provider: completed.provider,
            model: completed.model,
            parsed,
            tokenCost: cost,
            createdAt: completed.createdAt.toISOString(),
          },
        },
        { status: 201 },
      );
    } catch (genError) {
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: {
          status: "FAILED",
          errorMessage: genError instanceof Error ? genError.message : "Unknown error",
          completedAt: new Date(),
        },
      });

      await refundAiTokens(user.activeCompanyId, cost, {
        generationId: generation.id,
        toolType: "BRIEF_PARSING",
      });

      console.error("[api/ai/generate/brief-parsing] generation failed", genError);
      return NextResponse.json(
        { error: "Brief parsing failed. Tokens have been refunded." },
        { status: 500 },
      );
    }
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (code === "INVALID_IDEMPOTENCY_KEY") {
      return NextResponse.json(
        { error: "Idempotency-Key header must be a valid UUID" },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_CONFLICT") {
      return NextResponse.json(
        { error: "Idempotency-Key belongs to another user or company" },
        { status: 409 },
      );
    }
    console.error("[api/ai/generate/brief-parsing] POST error", error);
    return NextResponse.json({ error: "Failed to parse brief" }, { status: 500 });
  }
}
