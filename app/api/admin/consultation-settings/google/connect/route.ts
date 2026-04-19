// -----------------------------------------------------------------------------
// @file: app/api/admin/consultation-settings/google/connect/route.ts
// @purpose: Kick off the Google OAuth flow. SITE_OWNER / SITE_ADMIN only.
//           Sets a signed-ish (random) state cookie to validate on callback,
//           then 302s to Google's consent screen.
// -----------------------------------------------------------------------------

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { buildAuthorizeUrl, readGoogleOauthConfig } from "@/lib/google/oauth";
import { isSiteAdminRole } from "@/lib/roles";

const STATE_COOKIE = "brandbite_google_oauth_state";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
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
