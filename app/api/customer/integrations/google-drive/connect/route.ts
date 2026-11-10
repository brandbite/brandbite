// -----------------------------------------------------------------------------
// @file: app/api/customer/integrations/google-drive/connect/route.ts
// @purpose: Start connecting the company's Google Drive (OWNER / PM): sets the
//           OAuth state cookie and sends the browser to Google's consent screen.
// -----------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { buildAuthorizeUrl } from "@/lib/google/oauth";
import { isProviderAvailable } from "@/lib/integrations/company-integrations";
import { GOOGLE_DRIVE_SCOPES, readDriveOauthConfig } from "@/lib/integrations/google-drive";
import { integrationsRedirectUrl, startOAuthState } from "@/lib/integrations/oauth-state";
import { canManageIntegrations, normalizeCompanyRole } from "@/lib/permissions/companyRoles";

const SLUG = "google-drive";

export async function GET(req: NextRequest) {
  const fail = (message: string) =>
    NextResponse.redirect(integrationsRedirectUrl(req.url, SLUG, "error", message));
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return fail("Only customer workspaces can connect Google Drive.");
    }
    if (!canManageIntegrations(normalizeCompanyRole(user.companyRole))) {
      return fail("Only company owners or project managers can connect Google Drive.");
    }
    if (!isProviderAvailable("GOOGLE_DRIVE")) {
      return fail("Google Drive isn't available yet.");
    }
    const config = readDriveOauthConfig(req.url);
    if ("error" in config) return fail("Google Drive isn't available yet.");

    const res = new NextResponse(null, { status: 302 });
    const state = startOAuthState(res, SLUG, user.activeCompanyId);
    res.headers.set("Location", buildAuthorizeUrl(config, state, GOOGLE_DRIVE_SCOPES));
    return res;
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    console.error("[integrations.google-drive] connect error", error);
    return fail("Could not start connecting Google Drive.");
  }
}
