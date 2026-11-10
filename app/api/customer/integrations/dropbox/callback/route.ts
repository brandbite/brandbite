// -----------------------------------------------------------------------------
// @file: app/api/customer/integrations/dropbox/callback/route.ts
// @purpose: Dropbox's answer to the consent screen: check the state, exchange
//           the code for tokens (with a refresh token), read the account email
//           and save the encrypted tokens. Ends on Settings → Integrations.
//           No folder is made up front: Dropbox creates
//           Apps/<app>/<Project>/<CODE Title>/ on the first upload.
// -----------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { saveCompanyIntegration } from "@/lib/integrations/company-integrations";
import {
  exchangeDropboxCode,
  getDropboxAccountEmail,
  readDropboxConfig,
} from "@/lib/integrations/dropbox";
import {
  clearOAuthState,
  integrationsRedirectUrl,
  readOAuthState,
} from "@/lib/integrations/oauth-state";
import { canManageIntegrations, normalizeCompanyRole } from "@/lib/permissions/companyRoles";

const SLUG = "dropbox";

export async function GET(req: NextRequest) {
  const finish = (result: "connected" | "error", message?: string) => {
    const res = NextResponse.redirect(integrationsRedirectUrl(req.url, SLUG, result, message));
    clearOAuthState(res, SLUG);
    return res;
  };
  try {
    const user = await getCurrentUserOrThrow();
    const url = new URL(req.url);
    if (url.searchParams.get("error")) {
      return finish("error", "Dropbox wasn't connected: access was not granted.");
    }
    const companyId = readOAuthState(req, SLUG, url.searchParams.get("state"));
    const code = url.searchParams.get("code");
    if (!companyId || !code) {
      return finish("error", "That sign-in link expired. Please try connecting again.");
    }
    if (
      user.role !== "CUSTOMER" ||
      user.activeCompanyId !== companyId ||
      !canManageIntegrations(normalizeCompanyRole(user.companyRole))
    ) {
      return finish("error", "Only company owners or project managers can connect Dropbox.");
    }

    const config = readDropboxConfig(req.url);
    if ("error" in config) return finish("error", "Dropbox isn't available yet.");

    const tokens = await exchangeDropboxCode(config, code);
    if (!tokens.refresh_token) {
      return finish("error", "Dropbox didn't return lasting access. Please try connecting again.");
    }
    const email = await getDropboxAccountEmail(tokens.access_token);

    await saveCompanyIntegration({
      companyId,
      provider: "DROPBOX",
      connectedByUserId: user.id,
      accountLabel: email,
      scopes: tokens.scope ?? null,
      externalRootId: tokens.account_id ?? null,
      secrets: {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return finish("connected", email ?? undefined);
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    console.error("[integrations.dropbox] callback error", error);
    return finish("error", "Dropbox couldn't be connected. Please try again.");
  }
}
