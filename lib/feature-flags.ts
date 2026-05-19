// -----------------------------------------------------------------------------
// @file: lib/feature-flags.ts
// @purpose: Small typed wrappers over AppSetting reads for product feature
//           flags. Distinct from app-settings.ts (raw key/value access) so
//           consumers don't sprinkle string keys + boolean parsing through
//           every route.
//
//           Each helper has one job: read its AppSetting row, return a
//           boolean with a documented default. Fail open in the direction
//           that preserves user-facing behaviour — e.g. tags currently
//           default OFF because we've decided to ship them disabled.
// -----------------------------------------------------------------------------

import { getAppSetting } from "@/lib/app-settings";

/** Tag system (TicketTag + TagMultiSelect + chips on cards) feature flag.
 *
 *  Why this exists: the tag UX added cognitive load at create time
 *  without paying it back — no filter UI consumed tags, so they were
 *  decorative chips. We agreed to hide them everywhere by default and
 *  re-enable later when the filter chip rows for /customer/board +
 *  /admin/board are built.
 *
 *  Default: false. Setting `TAGS_ENABLED = "true"` in AppSetting flips
 *  the entire surface back on without touching any existing data —
 *  the TicketTag and TicketTagAssignment rows are preserved so the
 *  re-enable is instant.
 *
 *  Fails open to false on any DB error so an outage can't surprise
 *  users with previously-hidden UI elements re-appearing. */
export async function isTagsEnabled(): Promise<boolean> {
  try {
    const v = await getAppSetting("TAGS_ENABLED");
    return v === "true";
  } catch {
    return false;
  }
}
