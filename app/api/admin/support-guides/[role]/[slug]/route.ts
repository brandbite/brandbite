// -----------------------------------------------------------------------------
// @file: app/api/admin/support-guides/[role]/[slug]/route.ts
// @purpose: One Support guide. GET its code version and CMS edit; PUT saves an
//           edit; PATCH hides, shows or resolves a code change; DELETE goes
//           back to the code text (or deletes a CMS-only guide).
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole, isSiteOwnerRole } from "@/lib/roles";
import {
  applyGuideAction,
  getGuideDetail,
  GuideAdminError,
  isSupportRole,
  removeGuideEntry,
  saveGuide,
  type GuideAction,
} from "@/lib/support/admin";
import type { SupportRole } from "@/lib/support/types";

import { guideErrorResponse } from "../../errors";

type Ctx = { params: Promise<{ role: string; slug: string }> };

const ACTIONS: GuideAction[] = ["hide", "show", "keep-mine", "keep-as-cms"];

/** Checks the caller and the guide; owner-only guides are for the site owner. */
async function authorize(ctx: Ctx): Promise<{ role: SupportRole; slug: string; userId: string }> {
  const user = await getCurrentUserOrThrow();
  if (!isSiteAdminRole(user.role)) throw new GuideAdminError("FORBIDDEN", "Admins only.");
  const { role, slug } = await ctx.params;
  if (!isSupportRole(role)) throw new GuideAdminError("NOT_FOUND", "Guide not found.");
  const detail = await getGuideDetail(role, slug);
  if (!detail) throw new GuideAdminError("NOT_FOUND", "Guide not found.");
  if (detail.ownerOnly && !isSiteOwnerRole(user.role)) {
    throw new GuideAdminError("FORBIDDEN", "Only the site owner can change this guide.");
  }
  return { role, slug, userId: user.id };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { role, slug } = await authorize(ctx);
    return NextResponse.json({ guide: await getGuideDetail(role, slug) });
  } catch (err) {
    return guideErrorResponse(err, "GET");
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { role, slug, userId } = await authorize(ctx);
    const body = (await req.json().catch(() => null)) as { content?: unknown } | null;
    await saveGuide(role, slug, body?.content, userId);
    return NextResponse.json({ guide: await getGuideDetail(role, slug) });
  } catch (err) {
    return guideErrorResponse(err, "PUT");
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { role, slug, userId } = await authorize(ctx);
    const body = (await req.json().catch(() => null)) as { action?: string } | null;
    const action = ACTIONS.find((candidate) => candidate === body?.action);
    if (!action) throw new GuideAdminError("INVALID", "Unknown action.");
    await applyGuideAction(role, slug, action, userId);
    return NextResponse.json({ guide: await getGuideDetail(role, slug) });
  } catch (err) {
    return guideErrorResponse(err, "PATCH");
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { role, slug } = await authorize(ctx);
    await removeGuideEntry(role, slug);
    return NextResponse.json({ guide: await getGuideDetail(role, slug) });
  } catch (err) {
    return guideErrorResponse(err, "DELETE");
  }
}
