// -----------------------------------------------------------------------------
// @file: app/api/session/route.ts
// @purpose: Expose current session user info (+ demo persona when in demo mode)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2026-02-22
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getDemoPersonaById, isValidDemoPersona, type DemoPersonaId } from "@/lib/demo-personas";
import { formatRole } from "@/lib/roles";

export async function GET(req: NextRequest) {
  try {
    // Rate limit: 60 requests/min per IP
    const ip = getClientIp(req.headers);
    const rl = rateLimit(`session:${ip}`, { limit: 60, windowSeconds: 60 });
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

    return NextResponse.json(
      {
        ok: true,
        demoPersona: demoPersonaSummary,
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
