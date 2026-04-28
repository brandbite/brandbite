// -----------------------------------------------------------------------------
// @file: app/api/admin/page-blocks/[pageKey]/[type]/route.ts
// @purpose: Admin upsert for a single typed block on a page. Phase 1
//           supports one-block-per-type semantics: there's one HERO on
//           the home page, one FAQ, etc. Phase 3 generalises to multiple
//           blocks of the same type at different positions.
//
//           Validates the incoming `data` against the Zod schema for the
//           block `type` before writing — keeps junk out of the DB
//           (and hence off the public site).
//
//           Triggers `revalidatePath('/')` after a successful save so
//           Next.js's prerendered landing page picks up the change
//           immediately rather than waiting for the next ISR refresh.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteOwnerRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { isKnownBlockType, parseBlockData } from "@/lib/blocks/types";

const PAGE_KEY_PATTERN = /^[a-z0-9-]+$/;

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ pageKey: string; type: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteOwnerRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { pageKey, type: rawType } = await params;
    const type = rawType.toUpperCase();

    if (!pageKey || !PAGE_KEY_PATTERN.test(pageKey) || pageKey.length > 60) {
      return NextResponse.json(
        { error: "BAD_REQUEST", reason: "invalid pageKey" },
        { status: 400 },
      );
    }
    if (!isKnownBlockType(type)) {
      return NextResponse.json(
        { error: "BAD_REQUEST", reason: "unknown block type" },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => null)) as { data?: unknown } | null;
    if (!body || body.data === undefined || body.data === null) {
      return NextResponse.json({ error: "BAD_REQUEST", reason: "data required" }, { status: 400 });
    }

    // Validate against the type-specific Zod schema. Anything that fails
    // here gets a 400 with details — the admin form should already be
    // valid by the time it submits, but server-side defence is the
    // canonical guarantee.
    const parsed = parseBlockData({ type, data: body.data });
    if (!parsed) {
      return NextResponse.json(
        { error: "BAD_REQUEST", reason: "block data failed validation" },
        { status: 400 },
      );
    }

    // Find the existing block of this type on this page. Phase 1 assumes
    // one-of-each — Phase 3 generalises to multiple blocks of the same
    // type at different positions.
    const existing = await prisma.pageBlock.findFirst({
      where: { pageKey, type },
      select: { id: true, position: true },
    });

    let blockId: string;
    if (existing) {
      const updated = await prisma.pageBlock.update({
        where: { id: existing.id },
        // Cast through unknown because Prisma's Json type doesn't accept
        // our discriminated-union shape directly. Validation above
        // already guarantees the shape matches the schema for `type`.
        data: { data: parsed.data as unknown as never },
        select: { id: true },
      });
      blockId = updated.id;
    } else {
      // Find next free position. For first-block-on-page this is 0.
      const max = await prisma.pageBlock.findFirst({
        where: { pageKey },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const position = max ? max.position + 1 : 0;
      const created = await prisma.pageBlock.create({
        data: {
          pageKey,
          type,
          position,
          data: parsed.data as unknown as never,
        },
        select: { id: true },
      });
      blockId = created.id;
    }

    // Forensic trail until we add a proper PAGE_CONTENT_EDIT enum to
    // AdminActionType (follow-up). Logged structured for grep-ability.
    console.log("[admin/page-blocks] block saved", {
      actor: user.email,
      role: user.role,
      pageKey,
      type,
      blockId,
      created: !existing,
    });

    // Invalidate the prerender cache so the public landing page reflects
    // the new content immediately. We invalidate the root and the
    // dedicated public API endpoint that the client-side fetch hits.
    try {
      revalidatePath("/");
      revalidatePath(`/api/page-blocks/${pageKey}`);
    } catch (revalidateErr) {
      console.warn("[admin/page-blocks] revalidatePath failed", revalidateErr);
    }

    return NextResponse.json({ ok: true, blockId });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[admin/page-blocks] PUT error", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
