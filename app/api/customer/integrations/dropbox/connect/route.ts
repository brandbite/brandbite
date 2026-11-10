// -----------------------------------------------------------------------------
// @file: app/api/customer/integrations/dropbox/connect/route.ts
// @purpose: Start connecting the company's Dropbox (OWNER / PM): sets the OAuth
//           state cookie and sends the browser to Dropbox's consent screen.
// -----------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isProviderAvailable } from "@/lib/integrations/company-integrations";
import { buildDropboxAuthorizeUrl, readDropboxConfig } from "@/lib/integrations/dropbox";
import { integrationsRedirectUrl, startOAuthState } from "@/lib/integrations/oauth-state";
import { canManageIntegrations, normalizeCompanyRole } from "@/lib/permissions/companyRoles";

const SLUG = "dropbox";

export async function GET(req: NextRequest) {
  const fail = (message: string) =>
    NextResponse.redirect(integrationsRedirectUrl(req.url, SLUG, "error", message));
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return fail("Only customer workspaces can connect Dropbox.");
    }
    if (!canManageIntegrations(normalizeCompanyRole(user.companyRole))) {
      return fail("Only company owners or project managers can connect Dropbox.");
    }
    if (!isProviderAvailable("DROPBOX")) {
      return fail("Dropbox isn't available yet.");
    }
    const config = readDropboxConfig(req.url);
    if ("error" in config) return fail("Dropbox isn't available yet.");

    const res = new NextResponse(null, { status: 302 });
    const state = startOAuthState(res, SLUG, user.activeCompanyId);
    res.headers.set("Location", buildDropboxAuthorizeUrl(config, state));
    return res;
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    console.error("[integrations.dropbox] connect error", error);
    return fail("Could not start connecting Dropbox.");
  }
}
