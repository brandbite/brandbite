// -----------------------------------------------------------------------------
// @file: lib/home/hero.ts
// @purpose: The Home greeting banner follows the time of day: which of the
//           four slots it is, and each slot's picture (public/dashboard/hero/)
//           with the colors that keep the text readable on it. Customers and
//           creatives see the same four pictures.
// -----------------------------------------------------------------------------

export type HeroSlot = "morning" | "afternoon" | "evening" | "night";

/** Morning 05–12, afternoon 12–17, evening 17–21, night 21–05, by the viewer's own clock. */
export function heroSlot(now: Date): HeroSlot {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const SLOTS: HeroSlot[] = ["morning", "afternoon", "evening", "night"];

/**
 * The slot to show: the time of day, unless the address asks for one with
 * `?hero=night` (so each picture can be looked at without waiting for the hour).
 */
export function resolveHeroSlot(now: Date, search: string): HeroSlot {
  const asked = new URLSearchParams(search).get("hero");
  return SLOTS.find((slot) => slot === asked) ?? heroSlot(now);
}

export const HERO_GREETING: Record<HeroSlot, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
  night: "Good evening",
};

export type HeroScene = {
  src: string;
  /** The picture's own wall color: the banner's background, so the picture fades into it. */
  wash: string;
  /** Text colors chosen against `wash`, whatever the dashboard theme is. */
  text: string;
  textMuted: string;
  link: string;
};

/** Pictures are 1983×793; the scene sits on the right, the left third is empty wall. */
export const HERO_IMAGE_SIZE = { width: 1983, height: 793 };

export const HERO_SCENES: Record<HeroSlot, HeroScene> = {
  morning: {
    src: "/dashboard/hero/morning.webp",
    wash: "#d6d3c2",
    text: "#292827",
    textMuted: "#4a4d54",
    link: "#1f5c2e",
  },
  afternoon: {
    src: "/dashboard/hero/afternoon.webp",
    wash: "#e4d6ca",
    text: "#292827",
    textMuted: "#4a4d54",
    link: "#1f5c2e",
  },
  evening: {
    src: "/dashboard/hero/evening.webp",
    wash: "#bb92a0",
    text: "#231f26",
    textMuted: "#33293a",
    link: "#231f26",
  },
  night: {
    src: "/dashboard/hero/night.webp",
    wash: "#50486a",
    text: "#ffffff",
    textMuted: "#e6e2f2",
    link: "#d6f5dd",
  },
};
