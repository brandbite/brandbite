// -----------------------------------------------------------------------------
// @file: lib/designer-availability.ts
// @purpose: Designer pause/availability logic for auto-assign filtering
// @version: v1.0.0
// @status: active
// -----------------------------------------------------------------------------

/**
 * Pause type options for designer availability control.
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
 * Determines if a designer is currently paused.
 * Handles auto-expiry at read time: if pauseExpiresAt has passed,
 * the designer is NOT considered paused — no cron job needed.
 */
export function isDesignerPaused(designer: PauseFields): boolean {
  if (!designer.isPaused) return false;
  // Manual pause (no expiry) — designer stays paused indefinitely
  if (!designer.pauseExpiresAt) return true;
  // Timed pause — check if expiry is in the future
  return designer.pauseExpiresAt > new Date();
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
export function formatPauseStatus(designer: FullPauseFields): {
  isPaused: boolean;
  pausedAt: string | null;
  pauseExpiresAt: string | null;
  pauseType: string | null;
  remainingMs: number | null;
} {
  const paused = isDesignerPaused(designer);

  return {
    isPaused: paused,
    pausedAt: paused ? (designer.pausedAt?.toISOString() ?? null) : null,
    pauseExpiresAt: paused
      ? (designer.pauseExpiresAt?.toISOString() ?? null)
      : null,
    pauseType: paused ? designer.pauseType : null,
    remainingMs:
      paused && designer.pauseExpiresAt
        ? Math.max(0, designer.pauseExpiresAt.getTime() - Date.now())
        : null,
  };
}
