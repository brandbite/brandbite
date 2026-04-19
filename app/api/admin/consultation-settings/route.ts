// -----------------------------------------------------------------------------
// @file: app/api/admin/consultation-settings/route.ts
// @purpose: GET + PUT the singleton ConsultationSettings row. SITE_OWNER /
//           SITE_ADMIN only. The customer-facing subset is exposed separately
//           at /api/customer/consultation-settings.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { getConsultationSettings } from "@/lib/consultation/settings";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/schemas/helpers";
import { updateConsultationSettingsSchema } from "@/lib/schemas/consultation-settings.schemas";

function ensureAdmin(role: string | null | undefined) {
  if (role !== "SITE_OWNER" && role !== "SITE_ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    const gate = ensureAdmin(user.role);
    if (gate) return gate;

    const settings = await getConsultationSettings();

    // Never leak the raw tokens to the client. Expose only a safe summary of
    // whether Google is connected + which account.
    const {
      googleAccessToken: _a,
      googleRefreshToken: _r,
      googleTokenExpiresAt: _e,
      ...safe
    } = settings;
    void _a;
    void _r;
    void _e;

    return NextResponse.json({
      settings: {
        ...safe,
        googleConnected: Boolean(settings.googleRefreshToken),
      },
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/consultation-settings] GET error", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const gate = ensureAdmin(user.role);
    if (gate) return gate;

    const parsed = await parseBody(req, updateConsultationSettingsSchema);
    if (!parsed.success) return parsed.response;

    // Make sure the row exists before updating.
    const current = await getConsultationSettings();

    const updated = await prisma.consultationSettings.update({
      where: { id: current.id },
      data: {
        ...parsed.data,
        updatedById: user.id,
      },
    });

    const {
      googleAccessToken: _a,
      googleRefreshToken: _r,
      googleTokenExpiresAt: _e,
      ...safe
    } = updated;
    void _a;
    void _r;
    void _e;

    return NextResponse.json({
      settings: { ...safe, googleConnected: Boolean(updated.googleRefreshToken) },
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/consultation-settings] PUT error", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
