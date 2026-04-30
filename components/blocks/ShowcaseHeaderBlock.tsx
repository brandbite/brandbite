// -----------------------------------------------------------------------------
// @file: components/blocks/ShowcaseHeaderBlock.tsx
// @purpose: Public-facing showcase-section header band — title + subtitle on
//           the left, optional "View the full gallery" CTA on the right.
//           Sits above the gallery grid in app/page.tsx ShowcaseSection.
//
//           Named "ShowcaseHeaderBlock" instead of "ShowcaseBlock" because
//           the gallery items themselves come from /api/showcase (managed
//           via /admin/showcase) — this block only owns the framing.
//           Mirrors the PricingHeaderBlock split.
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-30
// -----------------------------------------------------------------------------

import Link from "next/link";

import type { ShowcaseData } from "@/lib/blocks/types";

type ShowcaseHeaderBlockProps = {
  data: ShowcaseData;
};

export function ShowcaseHeaderBlock({ data }: ShowcaseHeaderBlockProps) {
  const hasLeft = Boolean(data.title?.trim() || data.subtitle?.trim());
  const hasCta = Boolean(data.ctaLabel?.trim() && data.ctaHref?.trim());

  // Empty header — admin cleared every field. ShowcaseSection skips the
  // header entirely so the gallery grid sits at the top of its section.
  if (!hasLeft && !hasCta) return null;

  return (
    <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      {hasLeft ? (
        <div>
          {data.title ? (
            <h2 className="font-brand text-3xl font-bold tracking-tight">{data.title}</h2>
          ) : null}
          {data.subtitle ? (
            <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">{data.subtitle}</p>
          ) : null}
        </div>
      ) : (
        <span />
      )}

      {hasCta ? (
        <Link
          href={data.ctaHref!}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--bb-secondary)] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#333]"
        >
          {data.ctaLabel}
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
      ) : null}
    </div>
  );
}
