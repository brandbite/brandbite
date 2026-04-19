// -----------------------------------------------------------------------------
// @file: app/api/admin/consultation-settings/google/disconnect/route.ts
// @purpose: Revoke Google tokens and clear them from the settings row.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { getConsultationSettings } from "@/lib/consultation/settings";
import { revokeToken } from "@/lib/google/oauth";
import { prisma } from "@/lib/prisma";
import { isSiteAdminRole } from "@/lib/roles";

export async function POST() {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const settings = await getConsultationSettings();

    // Best-effort revoke on Google's side.
    if (settings.googleRefreshToken) await revokeToken(settings.googleRefreshToken);
    if (settings.googleAccessToken) await revokeToken(settings.googleAccessToken);

    await prisma.consultationSettings.update({
      where: { id: settings.id },
      data: {
        googleAccountEmail: null,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiresAt: null,
        googleConnectedAt: null,
        updatedById: user.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[google/disconnect] POST error", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
