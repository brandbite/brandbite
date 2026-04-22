// -----------------------------------------------------------------------------
// @file: app/api/admin/consultation-settings/google/connect/route.ts
// @purpose: Kick off the Google OAuth flow. SITE_OWNER / SITE_ADMIN only.
//           Sets a signed-ish (random) state cookie to validate on callback,
//           then 302s to Google's consent screen.
// -----------------------------------------------------------------------------

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { AdminActionType } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { buildAuthorizeUrl, readGoogleOauthConfig } from "@/lib/google/oauth";
import { canEditConsultationSettings } from "@/lib/roles";

const STATE_COOKIE = "brandbite_google_oauth_state";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const auditCtx = extractAuditContext(req);

    if (!canEditConsultationSettings(user.role)) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.GOOGLE_OAUTH_CONFIG_EDIT,
        outcome: "BLOCKED",
        metadata: { op: "connect-attempt" },
        errorMessage: "Admin only",
        context: auditCtx,
      });
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const configOrError = readGoogleOauthConfig();
    if ("error" in configOrError) {
      return NextResponse.json(
        { error: `Google OAuth is not configured — ${configOrError.error}` },
        { status: 500 },
      );
    }

    const state = randomUUID();
    const authorizeUrl = buildAuthorizeUrl(configOrError, state);

    // Log the initiation of the connect flow. We DON'T log the completed
    // connection here (the callback handler is a separate route) — this is
    // just "someone kicked off Google OAuth". Useful to correlate with the
    // callback if a hostile actor tries to intercept the flow.
    await logAdminAction({
      actor: user,
      action: AdminActionType.GOOGLE_OAUTH_CONFIG_EDIT,
      outcome: "SUCCESS",
      metadata: { op: "connect-initiated" },
      context: auditCtx,
    });

    const res = NextResponse.redirect(authorizeUrl);
    // 10-minute TTL is plenty for the consent round-trip.
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return res;
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[google/connect] GET error", error);
    return NextResponse.json({ error: "Failed to start OAuth" }, { status: 500 });
  }
}
