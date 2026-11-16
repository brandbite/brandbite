// -----------------------------------------------------------------------------
// @file: app/api/ai/tools/route.ts
// @purpose: Which AI tools can be used right now: switched on by an admin and
//           backed by a provider that is set up. The AI Tools page marks the
//           rest "Coming soon" instead of letting a customer try them.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getAiToolConfig } from "@/lib/ai/cost-calculator";
import { AI_TOOL_TYPES, isAiToolAvailable } from "@/lib/ai/provider-router";
import { getCurrentUserOrThrow } from "@/lib/auth";

export async function GET() {
  try {
    await getCurrentUserOrThrow();

    const entries = await Promise.all(
      AI_TOOL_TYPES.map(async (toolType) => {
        const config = await getAiToolConfig(toolType);
        return [toolType, { available: config.enabled && isAiToolAvailable(toolType) }] as const;
      }),
    );

    return NextResponse.json({ tools: Object.fromEntries(entries) });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[api/ai/tools] GET error", error);
    return NextResponse.json({ error: "Failed to load AI tools" }, { status: 500 });
  }
}
