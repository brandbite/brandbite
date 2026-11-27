// -----------------------------------------------------------------------------
// @file: app/api/newsletters/[id]/versions/route.ts
// @purpose: The earlier versions of one kept newsletter, newest first: when
//           each was written and by whom. The newsletter must belong to the
//           asker's company.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";

import { VERSIONS_MAX, type NewsletterVersionSummary } from "@/lib/newsletter/saved";
import { fail, newsletterOwner } from "@/lib/newsletter/store.server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const owner = await newsletterOwner();
  if ("response" in owner) return owner.response;
  const { id } = await params;
  try {
    const rows = await prisma.newsletterVersion.findMany({
      where: { newsletterId: id, newsletter: { companyId: owner.companyId } },
      orderBy: { createdAt: "desc" },
      take: VERSIONS_MAX,
      select: { id: true, createdAt: true, createdBy: { select: { name: true } } },
    });
    const versions: NewsletterVersionSummary[] = rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      by: row.createdBy?.name ?? null,
    }));
    return NextResponse.json({ versions });
  } catch (error) {
    console.error("[newsletters/versions] GET failed", error);
    return fail(500, "The earlier versions couldn't be loaded.");
  }
}
