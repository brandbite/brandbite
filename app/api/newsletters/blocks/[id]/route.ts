// -----------------------------------------------------------------------------
// @file: app/api/newsletters/blocks/[id]/route.ts
// @purpose: Delete one block a company kept for reuse. Another company's
//           answers 404, the same as one that doesn't exist.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";

import { fail, newsletterOwner } from "@/lib/newsletter/store.server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const owner = await newsletterOwner();
  if ("response" in owner) return owner.response;
  const { id } = await params;
  try {
    const gone = await prisma.newsletterSavedBlock.deleteMany({
      where: { id, companyId: owner.companyId },
    });
    if (!gone.count) return fail(404, "That block doesn't exist any more.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[newsletters/blocks] DELETE failed", error);
    return fail(500, "The block couldn't be deleted.");
  }
}
