// -----------------------------------------------------------------------------
// @file: lib/engagement/switches.server.ts
// @purpose: Server-side reads of the engagement switches (see ./switches.ts).
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

import {
  ALL_ENGAGEMENT_OFF,
  ENGAGEMENT_SETTING_KEYS,
  ENGAGEMENT_SWITCHES,
  type EngagementFeature,
  type EngagementSwitches,
} from "./switches";

/** Every switch, in one query. Off on any error. */
export async function getEngagementSwitches(): Promise<EngagementSwitches> {
  try {
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: [...ENGAGEMENT_SETTING_KEYS] } },
      select: { key: true, value: true },
    });
    const on = new Set(rows.filter((r) => r.value === "true").map((r) => r.key));
    const out = { ...ALL_ENGAGEMENT_OFF };
    for (const feature of Object.keys(ENGAGEMENT_SWITCHES) as EngagementFeature[]) {
      out[feature] = on.has(ENGAGEMENT_SWITCHES[feature]);
    }
    return out;
  } catch (err) {
    console.error("[engagement] switches read failed", err);
    return { ...ALL_ENGAGEMENT_OFF };
  }
}

/** One switch. Off on any error. */
export async function isEngagementOn(feature: EngagementFeature): Promise<boolean> {
  return (await getEngagementSwitches())[feature];
}
