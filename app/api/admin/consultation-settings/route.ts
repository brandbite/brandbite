// -----------------------------------------------------------------------------
// @file: app/api/admin/consultation-settings/route.ts
// @purpose: GET + PUT the singleton ConsultationSettings row. SITE_OWNER /
//           SITE_ADMIN only. The customer-facing subset is exposed separately
//           at /api/customer/consultation-settings.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { AdminActionType } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { getConsultationSettings } from "@/lib/consultation/settings";
import { prisma } from "@/lib/prisma";
import { canEditConsultationSettings, isSiteAdminRole } from "@/lib/roles";
import type { UserRole } from "@prisma/client";
import { parseBody } from "@/lib/schemas/helpers";
import { updateConsultationSettingsSchema } from "@/lib/schemas/consultation-settings.schemas";

function ensureAdminCanRead(role: UserRole) {
  if (!isSiteAdminRole(role)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    const gate = ensureAdminCanRead(user.role);
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
    const auditCtx = extractAuditContext(req);

    if (!canEditConsultationSettings(user.role)) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.CONSULTATION_PRICING_EDIT,
        outcome: "BLOCKED",
        errorMessage: "Only site owners can edit consultation settings.",
        context: auditCtx,
      });
      return NextResponse.json(
        { error: "Only site owners can edit consultation settings." },
        { status: 403 },
      );
    }

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

    await logAdminAction({
      actor: user,
      action: AdminActionType.CONSULTATION_PRICING_EDIT,
      outcome: "SUCCESS",
      targetType: "ConsultationSettings",
      targetId: updated.id,
      metadata: { changedFields: Object.keys(parsed.data) },
      context: auditCtx,
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
