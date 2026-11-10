// -----------------------------------------------------------------------------
// @file: app/api/customer/integrations/route.ts
// @purpose: The active company's connected accounts (Google Drive, Dropbox,
//           Slack): what is connected and whether this user may change it.
//           Never returns tokens or webhook URLs.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { listCompanyIntegrations } from "@/lib/integrations/company-integrations";
import { countFilesToMove } from "@/lib/source-files/move-to-connected-storage";
import { canManageIntegrations, normalizeCompanyRole } from "@/lib/permissions/companyRoles";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customer accounts have integrations." },
        { status: 403 },
      );
    }
    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company selected." }, { status: 400 });
    }
    const integrations = await listCompanyIntegrations(user.activeCompanyId);
    return NextResponse.json({
      integrations,
      // Source files still on brandbite storage that will move into a
      // connected Drive or Dropbox.
      filesToMove: await countFilesToMove(user.activeCompanyId),
      canManage: canManageIntegrations(normalizeCompanyRole(user.companyRole)),
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    console.error("[customer.integrations] GET error", error);
    return NextResponse.json({ error: "Could not load integrations." }, { status: 500 });
  }
}
