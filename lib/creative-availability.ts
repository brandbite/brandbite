// -----------------------------------------------------------------------------
// @file: lib/creative-availability.ts
// @purpose: Creative pause/availability logic for auto-assign filtering
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-02-20
// -----------------------------------------------------------------------------

/**
 * Pause type options for creative availability control.
 */
export type PauseType = "1_HOUR" | "7_DAYS" | "MANUAL";

/**
 * Minimum shape required to check pause status.
 */
type PauseFields = {
  isPaused: boolean;
  pauseExpiresAt: Date | null;
};

/**
 * Full pause fields for formatting API responses.
 */
type FullPauseFields = PauseFields & {
  pausedAt: Date | null;
  pauseType: string | null;
};

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Determines if a creative is currently paused.
 * Handles auto-expiry at read time: if pauseExpiresAt has passed,
 * the creative is NOT considered paused — no cron job needed.
 */
export function isCreativePaused(creative: PauseFields): boolean {
  if (!creative.isPaused) return false;
  // Manual pause (no expiry) — creative stays paused indefinitely
  if (!creative.pauseExpiresAt) return true;
  // Timed pause — check if expiry is in the future
  return creative.pauseExpiresAt > new Date();
}

/**
 * Calculate the expiry date for a given pause type.
 * Returns null for MANUAL (indefinite) pause.
 */
export function calculatePauseExpiry(pauseType: PauseType): Date | null {
  const now = new Date();
  switch (pauseType) {
    case "1_HOUR":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "7_DAYS":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "MANUAL":
      return null;
  }
}

/**
 * Validates that a string is a known PauseType.
 */
export function isValidPauseType(value: string): value is PauseType {
  return value === "1_HOUR" || value === "7_DAYS" || value === "MANUAL";
}

// ---------------------------------------------------------------------------
// API response formatting
// ---------------------------------------------------------------------------

/**
 * Format pause fields for JSON API responses.
 * Includes computed `remainingMs` for timed pauses and
 * corrects stale `isPaused` flags for expired pauses.
 */
export function formatPauseStatus(creative: FullPauseFields): {
  isPaused: boolean;
  pausedAt: string | null;
  pauseExpiresAt: string | null;
  pauseType: string | null;
  remainingMs: number | null;
} {
  const paused = isCreativePaused(creative);

  return {
    isPaused: paused,
    pausedAt: paused ? (creative.pausedAt?.toISOString() ?? null) : null,
    pauseExpiresAt: paused
      ? (creative.pauseExpiresAt?.toISOString() ?? null)
      : null,
    pauseType: paused ? creative.pauseType : null,
    remainingMs:
      paused && creative.pauseExpiresAt
        ? Math.max(0, creative.pauseExpiresAt.getTime() - Date.now())
        : null,
  };
}
