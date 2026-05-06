// -----------------------------------------------------------------------------
// @file: app/api/session/route.ts
// @purpose: Expose current session user info (+ demo persona when in demo mode).
//           Also returns the BetterAuth session's expiresAt so the client-side
//           session-timeout-warning hook can schedule a "your session expires
//           soon" prompt (WCAG 2.2.1). Fetching this endpoint also extends
//           the session if BetterAuth's updateAge window is active, so it
//           doubles as the refresh mechanism for the "Stay signed in" button.
// @version: v1.2.0
// @status: active
// @lastUpdate: 2026-04-22
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getDemoPersonaById, isValidDemoPersona, type DemoPersonaId } from "@/lib/demo-personas";
import { formatRole } from "@/lib/roles";

const isDemoMode = () => {
  if (process.env.DEMO_MODE !== "true") return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_DEMO_IN_PROD === "true";
};

export async function GET(req: NextRequest) {
  try {
    // Rate limit: 60 requests/min per IP
    const ip = getClientIp(req.headers);
    const rl = await rateLimit(`session:${ip}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Demo persona summary (only in demo mode)
    let demoPersonaSummary: {
      id: DemoPersonaId;
      label: string;
      role: string;
      roleLabel: string;
    } | null = null;

    if (process.env.DEMO_MODE === "true") {
      const cookieStore = await cookies();
      const personaIdRaw = cookieStore.get("bb-demo-user")?.value ?? null;

      if (personaIdRaw && isValidDemoPersona(personaIdRaw)) {
        const persona = getDemoPersonaById(personaIdRaw as DemoPersonaId);
        if (persona) {
          demoPersonaSummary = {
            id: persona.id,
            label: persona.label,
            role: persona.role,
            roleLabel: formatRole(persona.role),
          };
        }
      }
    }

    const user = await getCurrentUser();

    // Read the session expiry + id straight from BetterAuth. In demo mode
    // there is no server-tracked expiry (the persona cookie is just a
    // persona switch), so both fields are null and the client-side
    // timeout hook + active-sessions list both no-op.
    let expiresAt: string | null = null;
    let sessionId: string | null = null;
    if (!isDemoMode() && user) {
      try {
        const { auth } = await import("@/lib/better-auth");
        const session = await auth.api.getSession({ headers: await headers() });
        const iso = session?.session?.expiresAt
          ? new Date(session.session.expiresAt).toISOString()
          : null;
        expiresAt = iso;
        // The session id (NOT the token — the token is the bearer secret
        // we never want to expose to JS) lets the active-sessions list on
        // /profile flag which row is "this device". Comparing `id` is
        // safe to surface; BetterAuth's listSessions also returns it.
        sessionId = session?.session?.id ?? null;
      } catch (err) {
        // Non-fatal: the warning just won't fire. Log so we notice if this
        // regresses silently.
        console.warn("[/api/session] could not read BetterAuth session expiry:", err);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        demoPersona: demoPersonaSummary,
        session: {
          expiresAt, // ISO string or null (demo mode / unauthenticated)
          id: sessionId, // BetterAuth session id, null in demo or unauthenticated
        },
        user: user
          ? {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              activeCompanyId: user.activeCompanyId,
              companyRole: user.companyRole,
            }
          : null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/session] error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load session" }, { status: 500 });
  }
}
