// -----------------------------------------------------------------------------
// @file: lib/engagement/brand-profile.ts
// @purpose: What makes up a company's brand profile on the customer overview,
//           and how ready it is. Each step is something a creative can use:
//           saved brand colors, a moodboard, file storage for source files,
//           and (when that feature is on) a brand soundtrack.
//           No server imports, so the card shares the types.
// -----------------------------------------------------------------------------

export type BrandProfileStepKey = "colors" | "moodboard" | "storage" | "soundtrack";

export type BrandProfileStep = {
  key: BrandProfileStepKey;
  label: string;
  done: boolean;
  /** What to do next when it isn't done. */
  action: { label: string; href: string };
};

export type BrandProfile = {
  steps: BrandProfileStep[];
  /** 0–100, whole number. */
  percent: number;
};

const STEP_COPY: Record<BrandProfileStepKey, Omit<BrandProfileStep, "key" | "done">> = {
  colors: {
    label: "Brand colors",
    action: { label: "Save a palette", href: "/colors" },
  },
  moodboard: {
    label: "Moodboard",
    action: { label: "Create moodboard", href: "/customer/moodboards" },
  },
  storage: {
    label: "Google Drive or Dropbox",
    action: { label: "Connect storage", href: "/customer/settings?tab=integrations" },
  },
  soundtrack: {
    label: "Brand soundtrack",
    action: { label: "Add a playlist", href: "/customer/settings?tab=company#brand-soundtrack" },
  },
};

export function buildBrandProfile(
  done: Partial<Record<BrandProfileStepKey, boolean>>,
  /** Which steps apply, in order. Soundtrack only when that feature is on. */
  keys: BrandProfileStepKey[],
): BrandProfile {
  const steps = keys.map((key) => ({ key, ...STEP_COPY[key], done: done[key] === true }));
  const complete = steps.filter((s) => s.done).length;
  return {
    steps,
    percent: steps.length === 0 ? 0 : Math.round((complete / steps.length) * 100),
  };
}
