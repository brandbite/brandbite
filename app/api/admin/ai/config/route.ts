// -----------------------------------------------------------------------------
// @file: app/api/admin/ai/config/route.ts
// @purpose: Admin AI tool configuration API (list + update)
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import type { AiToolType } from "@prisma/client";

const AI_TOOL_TYPES: AiToolType[] = [
  "IMAGE_GENERATION",
  "BACKGROUND_REMOVAL",
  "TEXT_GENERATION",
  "DESIGN_SUGGESTION",
  "BRIEF_PARSING",
  "UPSCALE_IMAGE",
];

const DEFAULT_CONFIGS: Record<AiToolType, { tokenCost: number; rateLimit: number }> = {
  IMAGE_GENERATION: { tokenCost: 2, rateLimit: 20 },
  BACKGROUND_REMOVAL: { tokenCost: 1, rateLimit: 30 },
  TEXT_GENERATION: { tokenCost: 1, rateLimit: 50 },
  DESIGN_SUGGESTION: { tokenCost: 1, rateLimit: 30 },
  BRIEF_PARSING: { tokenCost: 1, rateLimit: 30 },
  UPSCALE_IMAGE: { tokenCost: 2, rateLimit: 20 },
};

const TOOL_LABELS: Record<AiToolType, string> = {
  IMAGE_GENERATION: "Image Generation",
  BACKGROUND_REMOVAL: "Background Removal",
  TEXT_GENERATION: "Text / Copy Generation",
  DESIGN_SUGGESTION: "Design Suggestions",
  BRIEF_PARSING: "Brief Parsing",
  UPSCALE_IMAGE: "Image Upscaling",
};

// GET: list all tool configs
export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can access AI settings" },
        { status: 403 },
      );
    }

    const configs = await prisma.aiToolConfig.findMany({
      orderBy: { toolType: "asc" },
    });

    // Merge with defaults for any missing tool types
    const configMap = new Map(configs.map((c) => [c.toolType, c]));

    const tools = AI_TOOL_TYPES.map((toolType) => {
      const existing = configMap.get(toolType);
      return {
        toolType,
        label: TOOL_LABELS[toolType],
        enabled: existing?.enabled ?? true,
        tokenCost: existing?.tokenCost ?? DEFAULT_CONFIGS[toolType].tokenCost,
        rateLimit: existing?.rateLimit ?? DEFAULT_CONFIGS[toolType].rateLimit,
        config: existing?.config ?? null,
        updatedAt: existing?.updatedAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ tools });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/ai/config] GET error", error);
    return NextResponse.json({ error: "Failed to load AI config" }, { status: 500 });
  }
}

// PATCH: update a specific tool config
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can update AI settings" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { toolType, enabled, tokenCost, rateLimit } = body as {
      toolType?: AiToolType;
      enabled?: boolean;
      tokenCost?: number;
      rateLimit?: number;
    };

    if (!toolType || !AI_TOOL_TYPES.includes(toolType)) {
      return NextResponse.json({ error: "Invalid tool type" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof enabled === "boolean") data.enabled = enabled;
    if (typeof tokenCost === "number" && tokenCost >= 0) data.tokenCost = tokenCost;
    if (typeof rateLimit === "number" && rateLimit >= 1) data.rateLimit = rateLimit;

    const config = await prisma.aiToolConfig.upsert({
      where: { toolType },
      create: {
        toolType,
        enabled: (data.enabled as boolean) ?? true,
        tokenCost: (data.tokenCost as number) ?? DEFAULT_CONFIGS[toolType].tokenCost,
        rateLimit: (data.rateLimit as number) ?? DEFAULT_CONFIGS[toolType].rateLimit,
      },
      update: data,
    });

    return NextResponse.json({
      tool: {
        toolType: config.toolType,
        label: TOOL_LABELS[config.toolType],
        enabled: config.enabled,
        tokenCost: config.tokenCost,
        rateLimit: config.rateLimit,
        updatedAt: config.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/ai/config] PATCH error", error);
    return NextResponse.json({ error: "Failed to update AI config" }, { status: 500 });
  }
}
