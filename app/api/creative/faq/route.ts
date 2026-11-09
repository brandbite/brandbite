// -----------------------------------------------------------------------------
// @file: app/api/creative/faq/route.ts
// @purpose: The FAQ written for creatives. Signed-in creatives only, so unlike
//           /api/faq it isn't cached publicly.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { CREATIVE_FAQ_CATEGORY } from "@/lib/faq/audience";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "DESIGNER") {
      return NextResponse.json({ error: "Only creatives can see this FAQ" }, { status: 403 });
    }

    const faqs = await prisma.faq.findMany({
      where: { isActive: true, category: CREATIVE_FAQ_CATEGORY },
      orderBy: { position: "asc" },
      select: { id: true, question: true, answer: true, category: true },
    });

    return NextResponse.json({ faqs, categories: [CREATIVE_FAQ_CATEGORY] });
  } catch (err) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[api/creative/faq] failed", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
