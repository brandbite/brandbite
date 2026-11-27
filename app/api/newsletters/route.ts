// -----------------------------------------------------------------------------
// @file: app/api/newsletters/route.ts
// @purpose: List and create the newsletters a company keeps from the
//           newsletter builder. For signed-in customers whose company is on
//           a plan; everyone in the company sees the same list. Everyone
//           else keeps a single draft in their browser and never calls this.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";

import { NEWSLETTER_MAX_SAVED } from "@/lib/newsletter/newsletter";
import {
  cleanName,
  fail,
  incomingNewsletter,
  newsletterOwner,
  summarize,
  UNTITLED,
} from "@/lib/newsletter/store.server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const owner = await newsletterOwner();
  if ("response" in owner) return owner.response;
  try {
    const rows = await prisma.newsletter.findMany({
      where: { companyId: owner.companyId },
      orderBy: { updatedAt: "desc" },
      take: NEWSLETTER_MAX_SAVED,
    });
    return NextResponse.json({ newsletters: rows.map(summarize), limit: NEWSLETTER_MAX_SAVED });
  } catch (error) {
    console.error("[newsletters] GET failed", error);
    return fail(500, "Your newsletters couldn't be loaded.");
  }
}

export async function POST(req: NextRequest) {
  const owner = await newsletterOwner();
  if ("response" in owner) return owner.response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const data = incomingNewsletter(body?.data);
  if ("error" in data) return fail(400, data.error);
  const name = cleanName(body?.name, cleanName(data.name, UNTITLED));

  try {
    const count = await prisma.newsletter.count({ where: { companyId: owner.companyId } });
    if (count >= NEWSLETTER_MAX_SAVED) {
      return fail(
        409,
        `Your company keeps up to ${NEWSLETTER_MAX_SAVED} newsletters. Delete one to make room.`,
        { code: "LIMIT_REACHED" },
      );
    }
    const row = await prisma.newsletter.create({
      data: {
        name,
        data: { ...data, name },
        isTemplate: body?.isTemplate === true,
        companyId: owner.companyId,
        createdById: owner.userId,
      },
    });
    return NextResponse.json({ newsletter: summarize(row) }, { status: 201 });
  } catch (error) {
    console.error("[newsletters] POST failed", error);
    return fail(500, "The newsletter couldn't be saved.");
  }
}
