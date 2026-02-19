// -----------------------------------------------------------------------------
// @file: app/api/notifications/preferences/route.ts
// @purpose: GET + PATCH notification preferences for current user
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { getUserPreferences, setUserPreference } from "@/lib/notifications";
import type { NotificationType } from "@prisma/client";

const VALID_TYPES: NotificationType[] = [
  "REVISION_SUBMITTED",
  "FEEDBACK_SUBMITTED",
  "TICKET_COMPLETED",
  "TICKET_ASSIGNED",
  "TICKET_STATUS_CHANGED",
  "PIN_RESOLVED",
];

// ---------------------------------------------------------------------------
// GET /api/notifications/preferences
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    const preferences = await getUserPreferences(user.id);
    return NextResponse.json({ preferences });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[notification-prefs] GET error", err);
    return NextResponse.json(
      { error: "Failed to load preferences" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/notifications/preferences
// Body: { type: NotificationType, enabled: boolean }
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const body = (await req.json()) as Record<string, unknown>;

    const type = body.type as string | undefined;
    const enabled = body.enabled;

    if (!type || !VALID_TYPES.includes(type as NotificationType)) {
      return NextResponse.json(
        { error: "Invalid notification type" },
        { status: 400 },
      );
    }

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 },
      );
    }

    await setUserPreference(user.id, type as NotificationType, enabled);

    return NextResponse.json({ success: true, type, enabled });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[notification-prefs] PATCH error", err);
    return NextResponse.json(
      { error: "Failed to update preference" },
      { status: 500 },
    );
  }
}
