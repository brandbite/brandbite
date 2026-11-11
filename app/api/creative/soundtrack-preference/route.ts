// -----------------------------------------------------------------------------
// @file: app/api/creative/soundtrack-preference/route.ts
// @purpose: A creative's own choice about focus-playlist suggestions
//           ("Don't suggest music" on the card, and the switch in Settings).
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isEngagementOn } from "@/lib/engagement/switches.server";
import { prisma } from "@/lib/prisma";

async function creativeOrError() {
  const user = await getCurrentUserOrThrow();
  if (user.role !== "DESIGNER") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return { user } as const;
}

export async function GET() {
  try {
    const auth = await creativeOrError();
    if ("error" in auth) return auth.error;
    // The switch in Settings only shows while the owner has the feature on.
    if (!(await isEngagementOn("focusPlaylist"))) return NextResponse.json({ enabled: false });
    const account = await prisma.userAccount.findUnique({
      where: { id: auth.user.id },
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
    const auth = await creativeOrError();
    if ("error" in auth) return auth.error;
    const body = (await req.json().catch(() => null)) as { suggestions?: unknown } | null;
    if (typeof body?.suggestions !== "boolean") {
      return NextResponse.json({ error: "suggestions must be true or false" }, { status: 400 });
    }
    await prisma.userAccount.update({
      where: { id: auth.user.id },
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
