// -----------------------------------------------------------------------------
// @file: app/api/admin/consultation-settings/google/disconnect/route.ts
// @purpose: Revoke Google tokens and clear them from the settings row.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { AdminActionType } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { getConsultationSettings } from "@/lib/consultation/settings";
import { revokeToken } from "@/lib/google/oauth";
import { prisma } from "@/lib/prisma";
import { canEditConsultationSettings } from "@/lib/roles";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const auditCtx = extractAuditContext(req);

    if (!canEditConsultationSettings(user.role)) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.GOOGLE_OAUTH_CONFIG_EDIT,
        outcome: "BLOCKED",
        metadata: { op: "disconnect-attempt" },
        errorMessage: "Admin only",
        context: auditCtx,
      });
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

    await logAdminAction({
      actor: user,
      action: AdminActionType.GOOGLE_OAUTH_CONFIG_EDIT,
      outcome: "SUCCESS",
      metadata: {
        op: "disconnect",
        previouslyConnectedEmail: settings.googleAccountEmail,
      },
      context: auditCtx,
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
