// -----------------------------------------------------------------------------
// @file: lib/engagement/switches.ts
// @purpose: The site owner's on/off switches for the engagement features
//           (live progress, creative progress, thank-yous, brief strength,
//           brand profile, soundtracks, monthly recap, playlist tool).
//
//           One AppSetting row per feature, edited in /admin/settings →
//           Engagement. Everything is OFF until switched on, and reads fail
//           to OFF, so a database hiccup can never surprise people with a
//           feature the owner turned off. Switching one off hides it and
//           keeps its data.
//
//           This file has no server imports, so client components can share
//           the keys and types. Reading the settings: ./switches.server.ts.
// -----------------------------------------------------------------------------

export const ENGAGEMENT_SWITCHES = {
  liveProgress: "ENGAGEMENT_LIVE_PROGRESS",
  creativeProgress: "ENGAGEMENT_CREATIVE_PROGRESS",
  thankYous: "ENGAGEMENT_THANK_YOUS",
  briefStrength: "ENGAGEMENT_BRIEF_STRENGTH",
  brandProfile: "ENGAGEMENT_BRAND_PROFILE",
  brandSoundtrack: "ENGAGEMENT_BRAND_SOUNDTRACK",
  focusPlaylist: "ENGAGEMENT_FOCUS_PLAYLIST",
  monthlyRecap: "ENGAGEMENT_MONTHLY_RECAP",
  playlistTool: "ENGAGEMENT_PLAYLIST_TOOL",
} as const;

export type EngagementFeature = keyof typeof ENGAGEMENT_SWITCHES;
export type EngagementSwitches = Record<EngagementFeature, boolean>;

export const ENGAGEMENT_SETTING_KEYS = Object.values(ENGAGEMENT_SWITCHES);

export const ALL_ENGAGEMENT_OFF: EngagementSwitches = Object.fromEntries(
  Object.keys(ENGAGEMENT_SWITCHES).map((k) => [k, false]),
) as EngagementSwitches;
