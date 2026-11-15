// -----------------------------------------------------------------------------
// @file: lib/brand/brand-access.server.ts
// @purpose: Who may see and edit a company's brand guide from the customer
//           side: every member sees it, owners and project managers edit it.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

import "server-only";

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isCompanyAdminRole, normalizeCompanyRole } from "@/lib/permissions/companyRoles";

export type CustomerBrandAccess =
  | { ok: false; response: NextResponse }
  | { ok: true; userId: string; companyId: string; canEdit: boolean };

export async function customerBrandAccess(): Promise<CustomerBrandAccess> {
  const user = await getCurrentUserOrThrow();
  if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return {
    ok: true,
    userId: user.id,
    companyId: user.activeCompanyId,
    canEdit: isCompanyAdminRole(normalizeCompanyRole(user.companyRole)),
  };
}

export const BRAND_EDIT_DENIED =
  "Only company owners and project managers can edit the brand guide.";

export function editDenied(): NextResponse {
  return NextResponse.json({ error: BRAND_EDIT_DENIED }, { status: 403 });
}

/** Turns a thrown error into a response; logs anything unexpected. */
export function brandRouteError(error: unknown, where: string): NextResponse {
  if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  console.error(`[brand] ${where} error`, error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
