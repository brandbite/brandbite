// -----------------------------------------------------------------------------
// @file: app/api/newsletters/[id]/route.ts
// @purpose: Open, change and delete one kept newsletter. A newsletter belongs
//           to a company; a request for another company's answers 404, the
//           same as one that doesn't exist.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";

import { readNewsletter } from "@/lib/newsletter/newsletter";
import {
  cleanName,
  fail,
  incomingNewsletter,
  keepVersion,
  newsletterOwner,
  summarize,
} from "@/lib/newsletter/store.server";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

const NOT_FOUND = "That newsletter doesn't exist any more.";

export async function GET(_req: NextRequest, { params }: Context) {
  const owner = await newsletterOwner();
  if ("response" in owner) return owner.response;
  const { id } = await params;
  try {
    const row = await prisma.newsletter.findFirst({ where: { id, companyId: owner.companyId } });
    const data = row ? readNewsletter(row.data) : null;
    if (!row || !data) return fail(404, NOT_FOUND);
    return NextResponse.json({ newsletter: summarize(row), data: { ...data, name: row.name } });
  } catch (error) {
    console.error("[newsletters] GET one failed", error);
    return fail(500, "The newsletter couldn't be opened.");
  }
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const owner = await newsletterOwner();
  if ("response" in owner) return owner.response;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const change: { name?: string; data?: object; isTemplate?: boolean } = {};
  if (body?.data !== undefined) {
    const data = incomingNewsletter(body.data);
    if ("error" in data) return fail(400, data.error);
    const name = cleanName(body.name, cleanName(data.name, ""));
    if (name) change.name = name;
    change.data = name ? { ...data, name } : data;
  } else if (body?.name !== undefined) {
    const name = cleanName(body.name, "");
    if (!name) return fail(400, "Give the newsletter a name.");
    change.name = name;
  }
  if (typeof body?.isTemplate === "boolean") change.isTemplate = body.isTemplate;
  if (!Object.keys(change).length) return fail(400, "Nothing to change.");

  try {
    const existing = await prisma.newsletter.findFirst({
      where: { id, companyId: owner.companyId },
      select: { id: true, data: true },
    });
    if (!existing) return fail(404, NOT_FOUND);
    // A rename alone also renames the document kept inside the row.
    if (change.name && !change.data) {
      const data = readNewsletter(existing.data);
      if (data) change.data = { ...data, name: change.name };
    }
    // What it was before this change is kept as an earlier version, at most one every few minutes.
    if (body?.data !== undefined) await keepVersion(id, existing.data, owner.userId);
    const row = await prisma.newsletter.update({ where: { id }, data: change });
    return NextResponse.json({ newsletter: summarize(row) });
  } catch (error) {
    console.error("[newsletters] PATCH failed", error);
    return fail(500, "The newsletter couldn't be saved.");
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const owner = await newsletterOwner();
  if ("response" in owner) return owner.response;
  const { id } = await params;
  try {
    const gone = await prisma.newsletter.deleteMany({ where: { id, companyId: owner.companyId } });
    if (!gone.count) return fail(404, NOT_FOUND);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[newsletters] DELETE failed", error);
    return fail(500, "The newsletter couldn't be deleted.");
  }
}
