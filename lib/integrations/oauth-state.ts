// -----------------------------------------------------------------------------
// @file: lib/integrations/oauth-state.ts
// @purpose: CSRF protection for customer integration OAuth flows. The connect
//           route puts a random state plus the company id in a short-lived
//           httpOnly cookie; the callback only accepts the provider's answer
//           when the state matches and the user still has that company active.
// -----------------------------------------------------------------------------

import { randomUUID } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

export const INTEGRATIONS_SETTINGS_PATH = "/customer/settings";

const cookieName = (slug: string) => `brandbite_${slug.replace(/-/g, "_")}_oauth_state`;

export function startOAuthState(res: NextResponse, slug: string, companyId: string): string {
  const state = randomUUID();
  res.cookies.set(cookieName(slug), `${state}.${companyId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return state;
}

/** The company id the flow was started for, or null when the state doesn't match. */
export function readOAuthState(
  req: NextRequest,
  slug: string,
  state: string | null,
): string | null {
  const stored = req.cookies.get(cookieName(slug))?.value;
  if (!stored || !state) return null;
  const dot = stored.indexOf(".");
  if (dot < 0 || stored.slice(0, dot) !== state) return null;
  return stored.slice(dot + 1) || null;
}

export function clearOAuthState(res: NextResponse, slug: string) {
  res.cookies.delete(cookieName(slug));
}

/** Back to Settings → Integrations with a result the page shows once. */
export function integrationsRedirectUrl(
  base: string,
  slug: string,
  result: "connected" | "error",
  message?: string,
): URL {
  const url = new URL(INTEGRATIONS_SETTINGS_PATH, base);
  url.searchParams.set("tab", "integrations");
  url.searchParams.set("integration", slug);
  url.searchParams.set("result", result);
  if (message) url.searchParams.set("message", message);
  return url;
}
