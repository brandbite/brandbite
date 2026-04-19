// -----------------------------------------------------------------------------
// @file: app/api/customer/consultations/availability/route.ts
// @purpose: Return the team's busy intervals within a given [timeMin, timeMax]
//           window, so the customer booking picker can grey out unavailable
//           30-min slots. Silently returns an empty array when Google is not
//           connected — the picker still works, it just doesn't filter.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { getConsultationSettings } from "@/lib/consultation/settings";
import { queryFreeBusy } from "@/lib/google/calendar";

export async function GET(req: NextRequest) {
  try {
    // Any authenticated user can query — they need this to make a booking.
    await getCurrentUserOrThrow();

    const url = new URL(req.url);
    const timeMin = url.searchParams.get("timeMin");
    const timeMax = url.searchParams.get("timeMax");

    if (!timeMin || !timeMax) {
      return NextResponse.json({ error: "timeMin and timeMax are required" }, { status: 400 });
    }
    if (Number.isNaN(Date.parse(timeMin)) || Number.isNaN(Date.parse(timeMax))) {
      return NextResponse.json(
        { error: "timeMin and timeMax must be ISO strings" },
        { status: 400 },
      );
    }
    if (new Date(timeMin).getTime() >= new Date(timeMax).getTime()) {
      return NextResponse.json({ error: "timeMin must be before timeMax" }, { status: 400 });
    }

    const settings = await getConsultationSettings();
    if (!settings.googleRefreshToken) {
      // Feature not connected — empty busy window, picker falls back to open.
      return NextResponse.json({ busy: [], googleConnected: false });
    }

    const busy = await queryFreeBusy(settings, timeMin, timeMax);
    return NextResponse.json({ busy, googleConnected: true });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[customer/consultations/availability] GET error", error);
    // Swallow calendar-side errors — booking flow should not block on a
    // freebusy failure. Caller treats empty busy as "no info".
    return NextResponse.json({ busy: [], googleConnected: false, error: "Lookup failed" });
  }
}
