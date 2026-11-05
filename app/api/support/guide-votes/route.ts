// -----------------------------------------------------------------------------
// @file: app/api/support/guide-votes/route.ts
// @purpose: The signed-in person's "Was this helpful?" answer on a Support guide.
//           GET reads it, PUT sets or changes it. The audience comes from the
//           person's role, so nobody can vote on another role's guides.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { voteAudienceFor } from "@/lib/support/guide-votes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const voteSchema = z.object({
  slug: z.string().min(1).max(200),
  helpful: z.boolean(),
});

function failure(error: unknown, label: string) {
  if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  console.error(`[support.guide-votes] ${label} error`, error);
  return NextResponse.json({ error: "Failed to process the vote" }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const slug = new URL(req.url).searchParams.get("slug") ?? "";

    const audience = voteAudienceFor(user.role, slug);
    if (!audience) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    const vote = await prisma.guideVote.findUnique({
      where: { userId_audience_slug: { userId: user.id, audience, slug } },
      select: { helpful: true },
    });

    return NextResponse.json({ helpful: vote?.helpful ?? null });
  } catch (error) {
    return failure(error, "GET");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    const limit = await rateLimit(`guide-votes:user:${user.id}`, {
      limit: 30,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many votes. Please wait a minute." }, { status: 429 });
    }

    const parsed = voteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
    }
    const { slug, helpful } = parsed.data;

    const audience = voteAudienceFor(user.role, slug);
    if (!audience) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    await prisma.guideVote.upsert({
      where: { userId_audience_slug: { userId: user.id, audience, slug } },
      create: { userId: user.id, audience, slug, helpful },
      update: { helpful },
    });

    return NextResponse.json({ helpful });
  } catch (error) {
    return failure(error, "PUT");
  }
}
