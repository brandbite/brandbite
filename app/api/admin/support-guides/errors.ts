// -----------------------------------------------------------------------------
// @file: app/api/admin/support-guides/errors.ts
// @purpose: Shared error-to-response mapping for the Support guide admin API.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { GuideAdminError } from "@/lib/support/admin";

const STATUS: Record<GuideAdminError["code"], number> = {
  NOT_FOUND: 404,
  INVALID: 400,
  CONFLICT: 409,
  FORBIDDEN: 403,
};

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
