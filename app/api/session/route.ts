// -----------------------------------------------------------------------------
// @file: app/api/session/route.ts
// @purpose: Expose current demo persona + session user info for client UI
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import {
  getDemoPersonaById,
  isValidDemoPersona,
  type DemoPersonaId,
} from "@/lib/demo-personas";
import { formatRole } from "@/lib/roles";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const personaIdRaw = cookieStore.get("bb-demo-user")?.value ?? null;

    let demoPersonaSummary: {
      id: DemoPersonaId;
      label: string;
      role: string;
      roleLabel: string;
    } | null = null;

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
    return NextResponse.json(
      { ok: false, error: "Failed to load session" },
      { status: 500 },
    );
  }
}
