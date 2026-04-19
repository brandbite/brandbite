// -----------------------------------------------------------------------------
// @file: lib/consultation/settings.ts
// @purpose: Fetch the singleton ConsultationSettings row, auto-creating it
//           on first call so call sites never need to handle a null case.
// -----------------------------------------------------------------------------

import type { ConsultationSettings } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Return the singleton ConsultationSettings row. If none exists yet (fresh
 * install or code path running before the seed migration), create one with
 * Prisma defaults. Safe to call concurrently — the unique constraint on
 * `singleton` makes a race a noop.
 */
export async function getConsultationSettings(): Promise<ConsultationSettings> {
  const existing = await prisma.consultationSettings.findUnique({
    where: { singleton: true },
  });
  if (existing) return existing;

  try {
    return await prisma.consultationSettings.create({
      data: { singleton: true },
    });
  } catch {
    // A concurrent caller won the race — fetch and return their row.
    const row = await prisma.consultationSettings.findUnique({
      where: { singleton: true },
    });
    if (!row) throw new Error("Failed to initialise ConsultationSettings.");
    return row;
  }
}

/** Subset of settings safe to expose to authenticated customers. */
export type PublicConsultationSettings = {
  enabled: boolean;
  tokenCost: number;
  durationMinutes: number;
  contactEmail: string | null;
  workingDays: number[];
  workingHourStart: number;
  workingHourEnd: number;
  minNoticeHours: number;
  maxBookingDays: number;
  companyTimezone: string | null;
};

export function toPublicSettings(s: ConsultationSettings): PublicConsultationSettings {
  return {
    enabled: s.enabled,
    tokenCost: s.tokenCost,
    durationMinutes: s.durationMinutes,
    contactEmail: s.contactEmail,
    workingDays: s.workingDays,
    workingHourStart: s.workingHourStart,
    workingHourEnd: s.workingHourEnd,
    minNoticeHours: s.minNoticeHours,
    maxBookingDays: s.maxBookingDays,
    companyTimezone: s.companyTimezone,
  };
}
