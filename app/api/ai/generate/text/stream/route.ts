// -----------------------------------------------------------------------------
// @file: app/api/ai/generate/text/stream/route.ts
// @purpose: Streaming AI text/copy generation endpoint (Server-Sent Events)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
// -----------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAiToolConfig,
  validateSufficientTokens,
  claimAiGeneration,
  refundAiTokens,
  checkRateLimit,
} from "@/lib/ai/cost-calculator";
import { generateTextStream } from "@/lib/ai/provider-router";
import {
  insufficientTokensBody,
  INSUFFICIENT_TOKENS_STATUS,
} from "@/lib/errors/insufficient-tokens";
import {
  buildStreamingCopySystemPrompt,
  buildCopyPrompt,
  STREAM_VARIATION_DELIMITER,
  type CopyFormat,
  type CopyTone,
} from "@/lib/ai/prompts";
import { readIdempotencyKey } from "@/lib/ai/idempotency";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events framing helper. Every SSE chunk is prefixed with an
 * `event:` line and a `data:` line, terminated by a blank line.
 */
function sseEvent(event: string, payload: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Parses the accumulated delimited response into an array of trimmed
 * variation strings. Empty trailing splits are dropped.
 */
function parseVariations(fullText: string): string[] {
  return fullText
    .split(STREAM_VARIATION_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Returns a short JSON error response for auth / validation failures that
 * happen before we open the stream. Once the stream starts, errors travel
 * over SSE instead.
 */
function jsonError(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  // -------------------------------------------------------------------------
  // Pre-stream validation. Anything that fails here returns a normal JSON
  // error — the stream itself is only opened once we've committed to run.
  // -------------------------------------------------------------------------

  let user: Awaited<ReturnType<typeof getCurrentUserOrThrow>>;
  try {
    user = await getCurrentUserOrThrow();
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "UNAUTHENTICATED") {
      return jsonError({ error: "Unauthenticated" }, 401);
    }
    throw error;
  }

  if (!user.activeCompanyId) {
    return jsonError({ error: "No active company" }, 400);
  }

  let idempotencyKey: string | null;
  try {
    idempotencyKey = readIdempotencyKey(req.headers);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "INVALID_IDEMPOTENCY_KEY") {
      return jsonError({ error: "Idempotency-Key header must be a valid UUID" }, 400);
    }
    throw error;
  }

  let body: {
    prompt?: string;
    format?: CopyFormat;
    tone?: CopyTone;
    variations?: number;
    wordCount?: number;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError({ error: "Invalid JSON body" }, 400);
  }

  const rawPrompt = body.prompt;
  if (!rawPrompt || rawPrompt.trim().length === 0) {
    return jsonError({ error: "Prompt is required" }, 400);
  }

  const toolConfig = await getAiToolConfig("TEXT_GENERATION");
  if (!toolConfig.enabled) {
    return jsonError({ error: "Text generation is currently disabled" }, 403);
  }

  const rateLimit = await checkRateLimit(user.activeCompanyId, "TEXT_GENERATION");
  if (!rateLimit.allowed) {
    return jsonError(
      {
        error: "Rate limit exceeded",
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt.toISOString(),
      },
      429,
    );
  }

  const cost = toolConfig.tokenCost;
  const balance = await validateSufficientTokens(user.activeCompanyId, cost);
  if (!balance.sufficient) {
    return jsonError(
      insufficientTokensBody({
        required: cost,
        balance: balance.balance,
        action: "AI text generation",
      }),
      INSUFFICIENT_TOKENS_STATUS,
    );
  }

  const copyFormat = body.format ?? "custom";
  const copyTone = body.tone ?? "professional";
  const numVariations = Math.min(Math.max(body.variations ?? 3, 1), 5);
  const systemPrompt = buildStreamingCopySystemPrompt(copyFormat, copyTone, numVariations);
  const userPrompt = buildCopyPrompt(rawPrompt, { wordCount: body.wordCount });

  // Claim the generation + debit tokens in one transaction. Retries with the
  // same Idempotency-Key return the existing record without a second debit.
  let generation: Awaited<ReturnType<typeof claimAiGeneration>>["generation"];
  let reused: boolean;
  try {
    const claim = await claimAiGeneration({
      idempotencyKey,
      userId: user.id,
      companyId: user.activeCompanyId,
      toolType: "TEXT_GENERATION",
      prompt: userPrompt,
      inputParams: {
        format: copyFormat,
        tone: copyTone,
        variations: numVariations,
        wordCount: body.wordCount,
      },
      cost,
    });
    generation = claim.generation;
    reused = claim.reused;
  } catch (error) {
    if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_CONFLICT") {
      return jsonError({ error: "Idempotency-Key belongs to another user or company" }, 409);
    }
    console.error("[api/ai/generate/text/stream] claim error", error);
    return jsonError({ error: "Failed to start generation" }, 500);
  }

  const companyId = user.activeCompanyId;

  // -------------------------------------------------------------------------
  // Open the SSE stream. From here on every error path writes an `error`
  // event and closes the stream instead of throwing a 500.
  // -------------------------------------------------------------------------

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (event: string, payload: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(event, payload)));
        } catch {
          // Client disconnected; nothing we can do.
        }
      };

      // If the request was an idempotent retry of a finished generation,
      // replay the stored variations so the client doesn't have to special-
      // case the replay path.
      if (reused) {
        const priorVariations =
          (generation.outputParams as { variations?: string[] } | null)?.variations ?? [];
        const priorText = generation.outputText ?? priorVariations.join(STREAM_VARIATION_DELIMITER);

        safeEnqueue("meta", {
          id: generation.id,
          provider: generation.provider,
          model: generation.model,
          tokenCost: generation.tokenCost,
          reused: true,
        });
        if (priorText) {
          safeEnqueue("delta", { text: priorText });
        }
        safeEnqueue("done", {
          id: generation.id,
          variations: priorVariations,
          outputText: priorText,
          reused: true,
        });
        controller.close();
        return;
      }

      // Fresh generation — flip to PROCESSING, open the OpenAI stream, and
      // forward deltas.
      try {
        await prisma.aiGeneration.update({
          where: { id: generation.id },
          data: { status: "PROCESSING", startedAt: new Date() },
        });

        const { meta, chunks } = generateTextStream(userPrompt, systemPrompt, {
          maxTokens: 1024,
          temperature: 0.8,
        });

        safeEnqueue("meta", {
          id: generation.id,
          provider: meta.provider,
          model: meta.model,
          tokenCost: cost,
          reused: false,
        });

        let fullText = "";
        let usage: { promptTokens: number; completionTokens: number } | undefined;

        for await (const chunk of chunks) {
          if (chunk.text) {
            fullText += chunk.text;
            safeEnqueue("delta", { text: chunk.text });
          }
          if (chunk.usage) {
            usage = chunk.usage;
          }
        }

        const variations = parseVariations(fullText);

        await prisma.aiGeneration.update({
          where: { id: generation.id },
          data: {
            status: "COMPLETED",
            provider: meta.provider,
            model: meta.model,
            outputText: fullText,
            outputParams: {
              variations,
              usage: usage ?? { promptTokens: 0, completionTokens: 0 },
            },
            completedAt: new Date(),
          },
        });

        safeEnqueue("done", {
          id: generation.id,
          variations,
          outputText: fullText,
          usage: usage ?? null,
          reused: false,
        });
        controller.close();
      } catch (error) {
        console.error("[api/ai/generate/text/stream] generation failed", error);

        try {
          await prisma.aiGeneration.update({
            where: { id: generation.id },
            data: {
              status: "FAILED",
              errorMessage: error instanceof Error ? error.message : "Unknown error",
              completedAt: new Date(),
            },
          });

          await refundAiTokens(companyId, cost, {
            generationId: generation.id,
            toolType: "TEXT_GENERATION",
          });
        } catch (bookkeepingError) {
          console.error(
            "[api/ai/generate/text/stream] failed to refund tokens after generation error",
            bookkeepingError,
          );
        }

        safeEnqueue("error", {
          id: generation.id,
          message: "Text generation failed. Tokens have been refunded.",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
