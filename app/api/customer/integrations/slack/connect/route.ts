// -----------------------------------------------------------------------------
// @file: app/api/customer/integrations/slack/connect/route.ts
// @purpose: Start connecting Slack (OWNER / PM): sets the OAuth state cookie
//           and sends the browser to Slack, where the customer picks the
//           channel brandbite posts to.
// -----------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isProviderAvailable } from "@/lib/integrations/company-integrations";
import { integrationsRedirectUrl, startOAuthState } from "@/lib/integrations/oauth-state";
import { buildSlackAuthorizeUrl, readSlackConfig } from "@/lib/integrations/slack";
import { canManageIntegrations, normalizeCompanyRole } from "@/lib/permissions/companyRoles";

const SLUG = "slack";

export async function GET(req: NextRequest) {
  const fail = (message: string) =>
    NextResponse.redirect(integrationsRedirectUrl(req.url, SLUG, "error", message));
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return fail("Only customer workspaces can connect Slack.");
    }
    if (!canManageIntegrations(normalizeCompanyRole(user.companyRole))) {
      return fail("Only company owners or project managers can connect Slack.");
    }
    if (!isProviderAvailable("SLACK")) return fail("Slack isn't available yet.");
    const config = readSlackConfig(req.url);
    if ("error" in config) return fail("Slack isn't available yet.");

    const res = new NextResponse(null, { status: 302 });
    const state = startOAuthState(res, SLUG, user.activeCompanyId);
    res.headers.set("Location", buildSlackAuthorizeUrl(config, state));
    return res;
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    console.error("[integrations.slack] connect error", error);
    return fail("Could not start connecting Slack.");
  }
}
