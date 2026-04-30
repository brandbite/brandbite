// -----------------------------------------------------------------------------
// @file: components/blocks/FeatureGridBlock.tsx
// @purpose: Public-facing feature grid block. Renders a list of 1-12 items
//           with optional emoji prefix, optional supporting image, and
//           optional CTA below.
//
//           Matches the currently-shipped "Why Brandbite" section visually:
//             - With image: 2-column on lg+ (image left, content right).
//             - Without image: single column centered.
//           Each item without an emoji falls back to the brand-primary
//           check-circle so the seeded data renders identically to what
//           was hardcoded.
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-30
// -----------------------------------------------------------------------------

import Link from "next/link";

import type { FeatureGridData } from "@/lib/blocks/types";

type FeatureGridBlockProps = {
  data: FeatureGridData;
};

export function FeatureGridBlock({ data }: FeatureGridBlockProps) {
  const imageUrl = data.image?.url ?? null;
  const hasImage = Boolean(imageUrl);

  return (
    <section className="bg-white px-6 py-20 sm:py-24">
      <div
        className={
          hasImage
            ? "mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-2"
            : "mx-auto max-w-3xl"
        }
      >
        {hasImage && imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            className="aspect-[4/3] w-full overflow-hidden rounded-2xl object-cover"
          />
        ) : null}

        <div className={hasImage ? "" : "text-center"}>
          {data.title ? (
            <h2 className="font-brand text-3xl font-bold tracking-tight sm:text-4xl">
              {data.title}
            </h2>
          ) : null}
          {data.subtitle ? (
            <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">{data.subtitle}</p>
          ) : null}

          <ul className={`mt-6 space-y-3 ${hasImage ? "" : "mx-auto inline-block text-left"}`}>
            {data.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[var(--bb-secondary)]">
                <FeatureItemIcon emoji={item.emoji} />
                <span>
                  <span className="font-medium">{item.title}</span>
                  {item.body ? (
                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--bb-text-secondary)]">
                      {item.body}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          <FeatureGridCta data={data} />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Per-item leading icon. Custom emoji wins; otherwise the brand-primary
 * check-circle that the original "Why Brandbite" section used. Keeping
 * the fallback means seeded data without emojis renders identically to
 * the hardcoded version that shipped before this block existed.
 * ------------------------------------------------------------------------- */

function FeatureItemIcon({ emoji }: { emoji?: string }) {
  if (emoji && emoji.trim().length > 0) {
    return (
      <span aria-hidden="true" className="flex-shrink-0 text-lg leading-tight">
        {emoji}
      </span>
    );
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className="mt-0.5 flex-shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="var(--bb-primary)" fillOpacity="0.1" />
      <path
        d="M8 12l3 3 5-5"
        stroke="var(--bb-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * CTA below the grid. Matches the dark secondary pill style used by every
 * other section-level CTA on the landing page (Showcase, Why pre-block,
 * FAQ). Schema enforces label+href as a pair, so the renderer just
 * checks "both present" without worrying about a half-set state.
 * ------------------------------------------------------------------------- */

function FeatureGridCta({ data }: { data: FeatureGridData }) {
  const label = data.ctaLabel?.trim();
  const href = data.ctaHref?.trim();
  if (!label || !href) return null;

  return (
    <div className="mt-8">
      <Link
        href={href}
        className="inline-flex items-center gap-1 rounded-full bg-[var(--bb-secondary)] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#333]"
      >
        {label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
