// -----------------------------------------------------------------------------
// @file: app/api/creative/soundtrack-preference/route.ts
// @purpose: A creative's own choice about focus-playlist suggestions
//           ("Don't suggest music" on the card, and the switch in Settings).
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isEngagementOn } from "@/lib/engagement/switches.server";
import { prisma } from "@/lib/prisma";

/** The signed-in creative's id, or null when the caller isn't a creative. */
async function creativeId(): Promise<string | null> {
  const user = await getCurrentUserOrThrow();
  return user.role === "DESIGNER" ? user.id : null;
}

const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

export async function GET() {
  try {
    const id = await creativeId();
    if (!id) return forbidden();
    // The switch in Settings only shows while the owner has the feature on.
    if (!(await isEngagementOn("focusPlaylist"))) return NextResponse.json({ enabled: false });
    const account = await prisma.userAccount.findUnique({
      where: { id },
      select: { soundtrackSuggestions: true },
    });
    return NextResponse.json({
      enabled: true,
      suggestions: account?.soundtrackSuggestions !== false,
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[soundtrack-preference] GET error", err);
    return NextResponse.json({ error: "Failed to load preference" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const id = await creativeId();
    if (!id) return forbidden();
    const body = (await req.json().catch(() => null)) as { suggestions?: unknown } | null;
    if (typeof body?.suggestions !== "boolean") {
      return NextResponse.json({ error: "suggestions must be true or false" }, { status: 400 });
    }
    await prisma.userAccount.update({
      where: { id },
      data: { soundtrackSuggestions: body.suggestions },
    });
    return NextResponse.json({ suggestions: body.suggestions });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[soundtrack-preference] PATCH error", err);
    return NextResponse.json({ error: "Failed to save preference" }, { status: 500 });
  }
}
