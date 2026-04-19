// -----------------------------------------------------------------------------
// @file: app/api/customer/consultation-settings/route.ts
// @purpose: Expose the customer-facing subset of ConsultationSettings so the
//           booking form can render working-hours, min-notice, token cost etc.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { getConsultationSettings, toPublicSettings } from "@/lib/consultation/settings";

export async function GET() {
  try {
    await getCurrentUserOrThrow();
    const settings = await getConsultationSettings();
    return NextResponse.json({ settings: toPublicSettings(settings) });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[customer/consultation-settings] GET error", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}
