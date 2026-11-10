// -----------------------------------------------------------------------------
// @file: app/api/customer/integrations/google-drive/callback/route.ts
// @purpose: Google's answer to the Drive consent screen: check the state,
//           exchange the code, make sure Drive access was actually granted,
//           create (or reuse) the "brandbite" folder and save the encrypted
//           tokens. Ends on Settings → Integrations with a result message.
// -----------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { decodeIdTokenPayload, exchangeCodeForTokens } from "@/lib/google/oauth";
import { saveCompanyIntegration } from "@/lib/integrations/company-integrations";
import { ensureRootFolder, readDriveOauthConfig } from "@/lib/integrations/google-drive";
import {
  clearOAuthState,
  integrationsRedirectUrl,
  readOAuthState,
} from "@/lib/integrations/oauth-state";
import { canManageIntegrations, normalizeCompanyRole } from "@/lib/permissions/companyRoles";
import { scheduleMoveAfterConnect } from "@/lib/source-files/move-to-connected-storage";
import { prisma } from "@/lib/prisma";

const SLUG = "google-drive";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// Leaves time for moving files in the background after the redirect.
export const maxDuration = 300;

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
      return finish("error", "Google Drive wasn't connected: access was not granted.");
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
      return finish("error", "Only company owners or project managers can connect Google Drive.");
    }

    const config = readDriveOauthConfig(req.url);
    if ("error" in config) return finish("error", "Google Drive isn't available yet.");

    const tokens = await exchangeCodeForTokens(config, code);
    if (!tokens.scope.split(" ").includes(DRIVE_FILE_SCOPE)) {
      return finish(
        "error",
        "Google Drive wasn't connected: please tick the Drive permission on Google's screen.",
      );
    }
    if (!tokens.refresh_token) {
      return finish(
        "error",
        "Google didn't return lasting access. Remove brandbite at myaccount.google.com/permissions, then connect again.",
      );
    }

    const previous = await prisma.companyIntegration.findUnique({
      where: { companyId_provider: { companyId, provider: "GOOGLE_DRIVE" } },
      select: { externalRootId: true },
    });
    const rootFolderId = await ensureRootFolder(
      tokens.access_token,
      previous?.externalRootId ?? null,
    );

    const payload = tokens.id_token ? decodeIdTokenPayload(tokens.id_token) : null;
    const email = typeof payload?.email === "string" ? payload.email : null;

    await saveCompanyIntegration({
      companyId,
      provider: "GOOGLE_DRIVE",
      connectedByUserId: user.id,
      accountLabel: email,
      scopes: tokens.scope,
      externalRootId: rootFolderId,
      secrets: {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    // Move source files we were keeping on brandbite storage into the new
    // drive, after the redirect so the customer isn't kept waiting.
    scheduleMoveAfterConnect(companyId, new URL(req.url).origin);

    return finish("connected", email ?? undefined);
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    console.error("[integrations.google-drive] callback error", error);
    return finish("error", "Google Drive couldn't be connected. Please try again.");
  }
}
