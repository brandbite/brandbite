// -----------------------------------------------------------------------------
// @file: app/api/notifications/preferences/route.ts
// @purpose: GET + PATCH notification preferences for current user
//           Supports both in-app (enabled) and email (emailEnabled) channels
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
// Returns: { preferences: [{ type, enabled, emailEnabled }] }
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
// Body: { type: NotificationType, enabled?: boolean, emailEnabled?: boolean }
// At least one of enabled or emailEnabled must be provided.
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const body = (await req.json()) as Record<string, unknown>;

    const type = body.type as string | undefined;
    const enabled = body.enabled;
    const emailEnabled = body.emailEnabled;

    if (!type || !VALID_TYPES.includes(type as NotificationType)) {
      return NextResponse.json(
        { error: "Invalid notification type" },
        { status: 400 },
      );
    }

    // At least one channel toggle must be provided
    const hasEnabled = typeof enabled === "boolean";
    const hasEmailEnabled = typeof emailEnabled === "boolean";

    if (!hasEnabled && !hasEmailEnabled) {
      return NextResponse.json(
        { error: "At least one of enabled or emailEnabled must be a boolean" },
        { status: 400 },
      );
    }

    const updates: { enabled?: boolean; emailEnabled?: boolean } = {};
    if (hasEnabled) updates.enabled = enabled as boolean;
    if (hasEmailEnabled) updates.emailEnabled = emailEnabled as boolean;

    await setUserPreference(user.id, type as NotificationType, updates);

    return NextResponse.json({
      success: true,
      type,
      ...(hasEnabled ? { enabled } : {}),
      ...(hasEmailEnabled ? { emailEnabled } : {}),
    });
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
