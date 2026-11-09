// -----------------------------------------------------------------------------
// @file: app/api/admin/support-guides/route.ts
// @purpose: GET every Support guide with its CMS state; POST a CMS-only guide.
//           SITE_ADMIN gate, like /api/admin/faq; owner-only admin guides are
//           listed for the site owner only.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole, isSiteOwnerRole } from "@/lib/roles";
import {
  createCmsGuide,
  GuideAdminError,
  isGuideOwner,
  listGuideRows,
  type GuideOwner,
} from "@/lib/support/admin";

import { guideErrorResponse, refreshPublicGuide } from "./errors";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const guides = await listGuideRows(isSiteOwnerRole(user.role));
    return NextResponse.json({ guides });
  } catch (err) {
    return guideErrorResponse(err, "GET");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const body = (await req.json().catch(() => null)) as {
      role?: string;
      slug?: string;
      content?: unknown;
    } | null;
    if (!body || !isGuideOwner(body.role ?? "") || typeof body.slug !== "string") {
      throw new GuideAdminError("INVALID", "Pick who the guide is for and give it an address.");
    }
    await createCmsGuide(body.role as GuideOwner, body.slug.trim(), body.content, user.id);
    refreshPublicGuide(body.role as string, body.slug.trim());
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return guideErrorResponse(err, "POST");
  }
}
