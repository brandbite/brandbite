// -----------------------------------------------------------------------------
// @file: app/api/newsletters/blocks/route.ts
// @purpose: The blocks a company keeps from the newsletter builder to use
//           again: list them, keep one more. Same people as kept newsletters
//           (signed-in customers whose company is on a plan); everyone in the
//           company shares the list.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";

import {
  readSavedBlock,
  SAVED_BLOCKS_MAX,
  savedBlockName,
  type SavedBlock,
} from "@/lib/newsletter/saved";
import { cleanName, fail, newsletterOwner } from "@/lib/newsletter/store.server";
import { prisma } from "@/lib/prisma";

function toSaved(row: { id: string; name: string; data: unknown }): SavedBlock | null {
  const block = readSavedBlock(row.data);
  return block ? { id: row.id, name: row.name, block } : null;
}

export async function GET() {
  const owner = await newsletterOwner();
  if ("response" in owner) return owner.response;
  try {
    const rows = await prisma.newsletterSavedBlock.findMany({
      where: { companyId: owner.companyId },
      orderBy: { createdAt: "desc" },
      take: SAVED_BLOCKS_MAX,
    });
    return NextResponse.json({
      blocks: rows.map(toSaved).filter((saved): saved is SavedBlock => saved !== null),
    });
  } catch (error) {
    console.error("[newsletters/blocks] GET failed", error);
    return fail(500, "Your blocks couldn't be loaded.");
  }
}

export async function POST(req: NextRequest) {
  const owner = await newsletterOwner();
  if ("response" in owner) return owner.response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const block = readSavedBlock(body?.block);
  if (!block) return fail(400, "That isn't a block.");

  try {
    const count = await prisma.newsletterSavedBlock.count({
      where: { companyId: owner.companyId },
    });
    if (count >= SAVED_BLOCKS_MAX) {
      return fail(
        409,
        `Your company keeps up to ${SAVED_BLOCKS_MAX} blocks. Delete one to make room.`,
      );
    }
    const row = await prisma.newsletterSavedBlock.create({
      data: {
        name: cleanName(body?.name, savedBlockName(block)),
        data: block,
        companyId: owner.companyId,
        createdById: owner.userId,
      },
    });
    return NextResponse.json({ block: toSaved(row) }, { status: 201 });
  } catch (error) {
    console.error("[newsletters/blocks] POST failed", error);
    return fail(500, "The block couldn't be kept.");
  }
}
