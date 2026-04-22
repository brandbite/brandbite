// -----------------------------------------------------------------------------
// @file: app/api/admin/mfa/status/route.ts
// @purpose: Tiny read-only check for the TOTP enrolment state of the caller.
//           Used by /admin/settings/mfa to decide whether to render the
//           "enrol now" or "disable" UI. SITE_OWNER only.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteOwnerRole } from "@/lib/roles";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteOwnerRole(user.role)) {
      return NextResponse.json({ error: "Site owners only." }, { status: 403 });
    }

    const account = await prisma.userAccount.findUnique({
      where: { id: user.id },
      select: { totpSecret: true, totpEnrolledAt: true },
    });

    return NextResponse.json({
      enrolled: Boolean(account?.totpSecret),
      enrolledAt: account?.totpEnrolledAt?.toISOString() ?? null,
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/mfa/status] GET error", error);
    return NextResponse.json({ error: "Failed to load MFA status" }, { status: 500 });
  }
}
