// -----------------------------------------------------------------------------
// @file: components/support/screenshot-view.tsx
// @purpose: A guide screenshot that can have a second, phone-sized version.
//           Phones (below 640px) get the phone version when there is one, with
//           a switch to look at the desktop version instead. Wider screens
//           always get the desktop version. Used by the dashboard Support
//           guides and the public guides.
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import { IconExpand } from "@/components/admin/v2/icons";

/** Below this width a screen counts as a phone (Tailwind's `sm`). */
const PHONE_MEDIA = "(max-width: 639.98px)";

type Tone = "dashboard" | "public";

const TONE: Record<
  Tone,
  { group: string; on: string; off: string; focus: string; expand: string }
> = {
  dashboard: {
    group: "border-[var(--av2-border)] bg-[var(--av2-surface)]",
    on: "bg-[var(--av2-text)] text-[var(--av2-surface)]",
    off: "text-[var(--av2-text-2)]",
    focus: "focus-visible:ring-[var(--av2-accent)]",
    expand:
      "border-[var(--av2-border)] bg-[var(--av2-surface)] text-[var(--av2-text)] hover:bg-[var(--av2-bg)]",
  },
  public: {
    group: "border-[var(--cs-border)] bg-[var(--cs-surface)]",
    on: "bg-[var(--cs-text)] text-[var(--cs-surface)]",
    off: "text-[var(--cs-muted)]",
    focus: "focus-visible:ring-[var(--cs-text)]",
    expand:
      "border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text)] hover:bg-[var(--cs-soft)]",
  },
};

export function ScreenshotView({
  image,
  mobileImage,
  alt,
  caption,
  tone,
  frameClassName,
  expandable = false,
}: {
  image: string;
  /** The same screen on a phone. Optional. */
  mobileImage?: string;
  alt: string;
  /** Names the picture in the "open full size" and switch labels. */
  caption: string;
  tone: Tone;
  frameClassName: string;
  /** Adds an "open full size" button over the picture. */
  expandable?: boolean;
}) {
  // Only phones see the switch, so this only ever changes what a phone shows.
  const [desktopOnPhone, setDesktopOnPhone] = useState(false);
  const phoneVersion = mobileImage && !desktopOnPhone ? mobileImage : null;
  const colors = TONE[tone];
  const focus = `focus-visible:ring-2 focus-visible:outline-none ${colors.focus}`;
  const expandClass = `absolute top-3 right-3 h-9 w-9 items-center justify-center rounded-lg border shadow-sm ${colors.expand} ${focus}`;

  return (
    <>
      <div className={`relative overflow-hidden ${frameClassName}`}>
        <picture>
          {phoneVersion && <source media={PHONE_MEDIA} srcSet={phoneVersion} />}
          <img src={image} alt={alt} loading="lazy" className="block h-auto w-full" />
        </picture>
        {expandable && phoneVersion && (
          <a
            href={phoneVersion}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open full size, phone view: ${caption}`}
            className={`flex sm:hidden ${expandClass}`}
          >
            <IconExpand />
          </a>
        )}
        {expandable && (
          <a
            href={image}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open full size: ${caption}`}
            className={`${phoneVersion ? "hidden sm:flex" : "flex"} ${expandClass}`}
          >
            <IconExpand />
          </a>
        )}
      </div>
      {mobileImage && (
        <div
          role="group"
          aria-label={`Screenshot version: ${caption}`}
          className={`inline-flex self-start rounded-full border p-1 sm:hidden ${colors.group}`}
        >
          {(
            [
              { label: "Phone", desktop: false },
              { label: "Desktop", desktop: true },
            ] as const
          ).map((option) => {
            const active = option.desktop === desktopOnPhone;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={active}
                onClick={() => setDesktopOnPhone(option.desktop)}
                className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                  active ? colors.on : colors.off
                } ${focus}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
