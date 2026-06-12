// -----------------------------------------------------------------------------
// @file: app/api/admin/companies/[companyId]/auto-assign/route.ts
// @purpose: Toggle a company's auto-assign default from /admin/companies.
//
//           `autoAssignDefaultEnabled` is what every INHERIT-mode project
//           resolves against when a new ticket looks for a creative
//           (lib/tickets/create-ticket.ts → isAutoAssignEnabled). Until
//           this route, the only write surface was the demo-only
//           /debug/auto-assign panel — real-prod admins had no switch at
//           all, even though the settings page claimed otherwise.
//
//           SITE_ADMIN+ gate (same as the companies overview GET). Not a
//           money action — no typed-phrase / MFA, but every flip lands in
//           the admin audit log with old → new values and fires the
//           standard receipt email pipeline.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdminRole } from "@/lib/roles";
import { parseBody } from "@/lib/schemas/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toggleSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;

  let user;
  try {
    user = await getCurrentUserOrThrow();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!isSiteAdminRole(user.role)) {
    return NextResponse.json(
      { error: "Only site admins can change auto-assign settings" },
      { status: 403 },
    );
  }

  const parsed = await parseBody(req, toggleSchema);
  if (!parsed.success) return parsed.response;
  const { enabled } = parsed.data;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, autoAssignDefaultEnabled: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (company.autoAssignDefaultEnabled !== enabled) {
    await prisma.company.update({
      where: { id: company.id },
      data: { autoAssignDefaultEnabled: enabled },
    });

    await logAdminAction({
      actor: { id: user.id, email: user.email, role: user.role },
      action: "COMPANY_AUTO_ASSIGN_EDIT",
      outcome: "SUCCESS",
      targetType: "Company",
      targetId: company.id,
      metadata: {
        companyName: company.name,
        from: company.autoAssignDefaultEnabled,
        to: enabled,
      },
      context: extractAuditContext(req),
    });
  }

  return NextResponse.json({ ok: true, autoAssignDefaultEnabled: enabled });
}
