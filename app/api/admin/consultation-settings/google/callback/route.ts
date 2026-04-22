// -----------------------------------------------------------------------------
// @file: app/api/admin/consultation-settings/google/callback/route.ts
// @purpose: Handle the redirect back from Google's consent screen. Validates
//           the state cookie, exchanges the code for tokens, persists them on
//           ConsultationSettings, then redirects the admin back to the
//           settings page with a success (or error) banner flag.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { AdminActionType } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { getConsultationSettings } from "@/lib/consultation/settings";
import {
  decodeIdTokenPayload,
  exchangeCodeForTokens,
  readGoogleOauthConfig,
} from "@/lib/google/oauth";
import { prisma } from "@/lib/prisma";
import { canEditConsultationSettings } from "@/lib/roles";

const STATE_COOKIE = "brandbite_google_oauth_state";
const SETTINGS_PATH = "/admin/consultations/settings";

function redirectWithFlag(req: NextRequest, flag: string, message?: string): NextResponse {
  const base = new URL(SETTINGS_PATH, req.url);
  base.searchParams.set("google", flag);
  if (message) base.searchParams.set("message", message);
  const res = NextResponse.redirect(base);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!canEditConsultationSettings(user.role)) {
      return redirectWithFlag(req, "error", "Admin only");
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorFromGoogle = url.searchParams.get("error");

    if (errorFromGoogle) {
      return redirectWithFlag(req, "error", `Google returned: ${errorFromGoogle}`);
    }
    if (!code || !state) {
      return redirectWithFlag(req, "error", "Missing code or state in callback");
    }

    const cookieState = req.cookies.get(STATE_COOKIE)?.value;
    if (!cookieState || cookieState !== state) {
      return redirectWithFlag(req, "error", "State mismatch (possible CSRF)");
    }

    const configOrError = readGoogleOauthConfig();
    if ("error" in configOrError) {
      return redirectWithFlag(req, "error", configOrError.error);
    }

    const tokens = await exchangeCodeForTokens(configOrError, code);
    if (!tokens.refresh_token) {
      // Google only returns refresh_token on first consent — if this admin
      // previously authorized from another device and we never got the token,
      // we need to force the consent screen again. We already pass prompt=consent
      // in the authorize URL; if we still get nothing, surface the error.
      return redirectWithFlag(
        req,
        "error",
        "Google did not return a refresh token. Remove previous Brandbite access at myaccount.google.com/permissions, then try Connect again.",
      );
    }

    const payload = tokens.id_token ? decodeIdTokenPayload(tokens.id_token) : null;
    const email = (payload?.email as string | undefined) ?? null;

    const settings = await getConsultationSettings();
    await prisma.consultationSettings.update({
      where: { id: settings.id },
      data: {
        googleAccountEmail: email,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        googleConnectedAt: new Date(),
        googleCalendarId: settings.googleCalendarId ?? "primary",
        updatedById: user.id,
      },
    });

    await logAdminAction({
      actor: user,
      action: AdminActionType.GOOGLE_OAUTH_CONFIG_EDIT,
      outcome: "SUCCESS",
      targetType: "ConsultationSettings",
      targetId: settings.id,
      metadata: { op: "connect-completed", googleAccountEmail: email },
      context: extractAuditContext(req),
    });

    return redirectWithFlag(req, "connected", email ?? "connected");
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[google/callback] GET error", error);
    const message = error instanceof Error ? error.message : "OAuth failed";
    return redirectWithFlag(req, "error", message);
  }
}
