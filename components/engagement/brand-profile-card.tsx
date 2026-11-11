// -----------------------------------------------------------------------------
// @file: components/engagement/brand-profile-card.tsx
// @purpose: "Brand profile" on the customer overview: how ready the brand
//           setup is (colors, moodboard, file storage, soundtrack) with the
//           next step to take. Loads itself; renders nothing while the
//           owner's switch is off or once everything is done and dismissed.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonClass, Card, IconTile } from "@/components/admin/v2/ui";
import type { BrandProfile } from "@/lib/engagement/brand-profile";

function LayersIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 3 9 4.5-9 4.5-9-4.500z" />
      <path d="m3 12 9 4.5 9-4.500M3 16.500 12 21l9-4.500" />
    </svg>
  );
}

export function BrandProfileCard() {
  const [profile, setProfile] = useState<BrandProfile | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/customer/brand-profile", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (live && json?.enabled) setProfile(json.profile as BrandProfile);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!profile) return null;
  const next = profile.steps.find((s) => !s.done);

  return (
    <Card>
      <div className="flex items-center gap-4">
        <IconTile tone="green" round>
          <LayersIcon />
        </IconTile>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl leading-7 font-semibold">Brand profile</h2>
          <div className="mt-1.5 flex items-center gap-4">
            <span
              role="progressbar"
              aria-label="Brand profile"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={profile.percent}
              aria-valuetext={`${profile.percent}% ready`}
              className="block h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--av2-track)]"
            >
              <span
                className="block h-full rounded-full bg-[#2f7a45]"
                style={{ width: `${profile.percent}%` }}
              />
            </span>
            <span className="shrink-0 text-base text-[#256b3a] tabular-nums dark:text-[#7fd396]">
              {profile.percent}% ready
            </span>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-1">
        {profile.steps.map((step) => (
          <li key={step.key} className="flex min-h-11 flex-wrap items-center gap-3">
            {step.done ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2f7a45] text-white">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M5 12.5 10 17 19 7.5"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            ) : (
              <span
                aria-hidden
                className="h-5 w-5 shrink-0 rounded-full border-2 border-[var(--av2-text-2)]/60"
              />
            )}
            <span className="min-w-0 flex-1 text-base">
              {step.label}
              <span className="sr-only">{step.done ? " (done)" : " (not done yet)"}</span>
            </span>
            {/* One button at a time: the next thing to do. */}
            {step === next ? (
              <Link href={step.action.href} className={buttonClass("secondary", "sm")}>
                {step.action.label}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      {!next ? (
        <p className="mt-2 text-sm text-[var(--av2-text-2)]">
          All set. Your creatives have everything they need to stay on brand.
        </p>
      ) : null}
    </Card>
  );
}
