// -----------------------------------------------------------------------------
// @file: components/engagement/brief-strength-card.tsx
// @purpose: "Brief strength" on the new-request form: a meter and a checklist
//           of the three details that help a creative start (reference,
//           dimensions, moodboard). It only nudges; nothing is required.
//           Renders nothing while the owner's switch is off.
// -----------------------------------------------------------------------------

"use client";

import {
  BRIEF_DETAILS,
  briefStrengthCount,
  type BriefStrength,
} from "@/lib/engagement/brief-strength";
import { useEngagementSwitches } from "@/lib/hooks/use-engagement-switches";

const HINTS: Record<keyof BriefStrength, string> = {
  reference: "Attach a file or paste a link",
  dimensions: "Add a size, like 1080 × 1350 px",
  moodboard: "",
};

export function BriefStrengthCard({
  strength,
  onLinkMoodboard,
}: {
  strength: BriefStrength;
  /** Takes the customer to the moodboard picker. Omit when there's none to pick. */
  onLinkMoodboard?: () => void;
}) {
  const { briefStrength: enabled } = useEngagementSwitches();
  if (!enabled) return null;

  const total = BRIEF_DETAILS.length;
  const count = briefStrengthCount(strength);

  return (
    <section
      aria-labelledby="brief-strength-title"
      className="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-6"
    >
      <h2 id="brief-strength-title" className="text-xl leading-7 font-semibold">
        Brief strength
      </h2>

      <div className="mt-3 flex items-center gap-4">
        <span
          role="progressbar"
          aria-label="Brief strength"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={count}
          aria-valuetext={`${count} of ${total} details added`}
          className="block h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--av2-success-bg)]"
        >
          <span
            className="block h-full rounded-full bg-[#2f7a45] transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${(count / total) * 100}%` }}
          />
        </span>
        <span className="shrink-0 text-sm text-[var(--av2-text-2)] tabular-nums" aria-live="polite">
          {count} of {total} details added
        </span>
      </div>

      <ul className="mt-3 divide-y divide-[var(--av2-border)]">
        {BRIEF_DETAILS.map(({ key, label }) => {
          const done = strength[key];
          return (
            <li key={key} className="flex min-h-11 items-center gap-3 py-1.5">
              {done ? (
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
              <span className="min-w-0 flex-1">
                <span className="text-base">{label}</span>
                <span className="sr-only">{done ? " (added)" : " (not added yet)"}</span>
                {!done && HINTS[key] ? (
                  <span className="block text-sm text-[var(--av2-text-2)]">{HINTS[key]}</span>
                ) : null}
              </span>
              {key === "moodboard" && !done && onLinkMoodboard ? (
                <button
                  type="button"
                  onClick={onLinkMoodboard}
                  className="shrink-0 rounded-lg bg-[var(--av2-success-bg)] px-3 py-1.5 text-sm font-semibold text-[#256b3a] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none dark:text-[#7fd396]"
                >
                  Link moodboard
                </button>
              ) : key === "moodboard" && !done ? (
                // No moodboards yet: making one opens in a new tab so the brief isn't lost.
                <a
                  href="/customer/moodboards"
                  target="_blank"
                  rel="noopener"
                  className="shrink-0 rounded-lg bg-[var(--av2-success-bg)] px-3 py-1.5 text-sm font-semibold text-[#256b3a] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none dark:text-[#7fd396]"
                >
                  Create moodboard
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-sm text-[var(--av2-text-2)]">
        A clear brief helps your creative get started.
      </p>
    </section>
  );
}
