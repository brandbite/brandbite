// -----------------------------------------------------------------------------
// @file: app/api/admin/support-guides/errors.ts
// @purpose: Shared error-to-response mapping for the Support guide admin API.
// -----------------------------------------------------------------------------

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { GuideAdminError } from "@/lib/support/admin";

const STATUS: Record<GuideAdminError["code"], number> = {
  NOT_FOUND: 404,
  INVALID: 400,
  CONFLICT: 409,
  FORBIDDEN: 403,
};

/**
 * Public guides are cached pages (/guides, revalidated every 5 minutes); an
 * admin change refreshes them at once. Dashboard guides render per request.
 */
export function refreshPublicGuide(role: string, slug: string) {
  if (role !== "public") return;
  try {
    revalidatePath("/guides");
    revalidatePath(`/guides/${slug}`);
    revalidatePath("/sitemap.xml");
  } catch (err) {
    console.warn("[admin/support-guides] revalidate failed", err);
  }
}

export function guideErrorResponse(err: unknown, method: string) {
  if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (err instanceof GuideAdminError) {
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: STATUS[err.code] },
    );
  }
  console.error(`[admin/support-guides] ${method} error`, err);
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}
