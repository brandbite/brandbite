// -----------------------------------------------------------------------------
// @file: lib/consultation/config.ts
// @purpose: Fallback defaults for the consultation feature. Settings are now
//           persisted in ConsultationSettings and fetched at runtime via
//           getConsultationSettings() — these values are only used when no
//           row exists yet (e.g. fresh install, pre-migration code path).
// -----------------------------------------------------------------------------

export const CONSULTATION_TOKEN_COST_DEFAULT = 50;
export const CONSULTATION_DURATION_DEFAULT = 30;
export const CONSULTATION_MIN_NOTICE_HOURS_DEFAULT = 24;
export const CONSULTATION_MAX_BOOKING_DAYS_DEFAULT = 30;
export const CONSULTATION_WORKING_DAYS_DEFAULT = [1, 2, 3, 4, 5];
export const CONSULTATION_WORKING_HOUR_START_DEFAULT = 9;
export const CONSULTATION_WORKING_HOUR_END_DEFAULT = 17;

/** Back-compat export. Prefer settings.tokenCost from getConsultationSettings(). */
export const CONSULTATION_TOKEN_COST = CONSULTATION_TOKEN_COST_DEFAULT;
