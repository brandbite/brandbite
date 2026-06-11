// -----------------------------------------------------------------------------
// @file: lib/google/connection-health.ts
// @purpose: Track the health of the Google Calendar OAuth connection on the
//           ConsultationSettings singleton.
//
//           "Broken" means Google permanently rejected the refresh token
//           (invalid_grant): revoked from the Google account, expired under
//           the consent screen's Testing-mode 7-day policy, or killed by an
//           account password reset. That's different from a transient API
//           hiccup — a dead refresh token never comes back on its own, so
//           it deserves a persistent admin banner + a one-shot owner email
//           (June 2026 incident: an expired token silently 502ed every
//           talent booking attempt until the candidate complained).
//
//           markGoogleConnectionBroken is idempotent per outage: the owner
//           email fires only on the null→set transition of
//           googleConnectionBrokenAt, so a retry storm (candidate mashing
//           the booking button) produces exactly one alert. The flag clears
//           on a successful refresh (self-heal), on reconnect, and on
//           explicit disconnect.
// -----------------------------------------------------------------------------

import { notifySiteOwnersOfEvent } from "@/lib/admin-event-email";
import { prisma } from "@/lib/prisma";

/** True when the error text carries Google's invalid_grant marker — the
 *  signature of a permanently dead refresh token. Transient failures
 *  (5xx, network) must NOT flip the broken flag. */
export function isInvalidGrantError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("invalid_grant");
}

function truncate(message: string, max = 300): string {
  return message.length > max ? `${message.slice(0, max)}…` : message;
}

/**
 * Flag the connection as broken and alert the owners — once per outage.
 * Best-effort: never throws (callers are already on an error path).
 *
 * @param detectedBy human-readable source for the alert email, e.g.
 *   "a live booking attempt" or "the daily calendar health check".
 */
export async function markGoogleConnectionBroken(args: {
  settingsId: string;
  errorMessage: string;
  detectedBy: string;
}): Promise<void> {
  const { settingsId, errorMessage, detectedBy } = args;
  try {
    // Conditional write doubles as the once-per-outage gate: count === 1
    // only for the caller that transitions null → set; concurrent losers
    // (and later retries) match zero rows and skip the email.
    const writeResult = await prisma.consultationSettings.updateMany({
      where: { id: settingsId, googleConnectionBrokenAt: null },
      data: {
        googleConnectionBrokenAt: new Date(),
        googleConnectionLastError: truncate(errorMessage),
      },
    });
    if (writeResult.count === 0) return;

    const row = await prisma.consultationSettings.findUnique({
      where: { id: settingsId },
      select: { googleAccountEmail: true },
    });
    await notifySiteOwnersOfEvent({
      kind: "GOOGLE_CALENDAR_DISCONNECTED",
      googleAccountEmail: row?.googleAccountEmail ?? null,
      errorDetail: truncate(errorMessage),
      detectedBy,
    });
  } catch (err) {
    console.error("[google-connection-health] mark broken failed", err);
  }
}

/** Clear the broken flag (successful refresh / reconnect / health-check
 *  pass). No-op when already clear; never throws. */
export async function clearGoogleConnectionBroken(settingsId: string): Promise<void> {
  try {
    await prisma.consultationSettings.updateMany({
      where: { id: settingsId, googleConnectionBrokenAt: { not: null } },
      data: {
        googleConnectionBrokenAt: null,
        googleConnectionLastError: null,
      },
    });
  } catch (err) {
    console.error("[google-connection-health] clear broken failed", err);
  }
}
