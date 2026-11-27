// -----------------------------------------------------------------------------
// @file: app/api/newsletters/[id]/versions/[versionId]/route.ts
// @purpose: One earlier version of a kept newsletter, as the document it
//           was, for the editor to put back. The newsletter must belong to
//           the asker's company.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";

import { readNewsletter } from "@/lib/newsletter/newsletter";
import { fail, newsletterOwner } from "@/lib/newsletter/store.server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const owner = await newsletterOwner();
  if ("response" in owner) return owner.response;
  const { id, versionId } = await params;
  try {
    const row = await prisma.newsletterVersion.findFirst({
      where: { id: versionId, newsletterId: id, newsletter: { companyId: owner.companyId } },
      select: { data: true },
    });
    const data = row ? readNewsletter(row.data) : null;
    if (!data) return fail(404, "That version doesn't exist any more.");
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[newsletters/versions] GET one failed", error);
    return fail(500, "That version couldn't be opened.");
  }
}
