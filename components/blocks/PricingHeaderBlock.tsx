// -----------------------------------------------------------------------------
// @file: components/blocks/PricingHeaderBlock.tsx
// @purpose: Public-facing pricing-section header (eyebrow + title + optional
//           subtitle + optional right-side contact prompt). Sits above the
//           plan-card grid in app/page.tsx PricingSection.
//
//           Named "PricingHeaderBlock" instead of "PricingBlock" because the
//           plan cards themselves render from the Plan table directly — this
//           component only owns the framing copy.
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-30
// -----------------------------------------------------------------------------

import type { PricingData } from "@/lib/blocks/types";

type PricingHeaderBlockProps = {
  data: PricingData;
};

export function PricingHeaderBlock({ data }: PricingHeaderBlockProps) {
  const hasContact = Boolean(
    data.contactNote?.trim() && data.contactLabel?.trim() && data.contactHref?.trim(),
  );
  const hasLeft = Boolean(data.eyebrow?.trim() || data.title?.trim() || data.subtitle?.trim());

  // Nothing to render — admin cleared every field and disabled the contact
  // prompt. PricingSection skips this header entirely in that case so the
  // plan grid can sit at the top of its own section without an empty band.
  if (!hasLeft && !hasContact) return null;

  return (
    <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      {hasLeft ? (
        <div>
          {data.eyebrow ? (
            <p className="text-sm text-[var(--bb-text-secondary)]">{data.eyebrow}</p>
          ) : null}
          {data.title ? (
            <h2 className="font-brand text-3xl font-bold tracking-tight sm:text-4xl">
              {data.title}
            </h2>
          ) : null}
          {data.subtitle ? (
            <p className="mt-2 max-w-xl text-sm text-[var(--bb-text-secondary)]">{data.subtitle}</p>
          ) : null}
        </div>
      ) : (
        <span />
      )}

      {hasContact ? (
        <div className="text-right text-sm">
          <span className="text-[var(--bb-text-secondary)]">{data.contactNote}</span>{" "}
          <a
            href={data.contactHref}
            className="font-semibold text-[var(--bb-primary)] hover:underline"
          >
            {data.contactLabel}
          </a>
        </div>
      ) : null}
    </div>
  );
}
