// -----------------------------------------------------------------------------
// @file: components/brand/brand-guide-progress.tsx
// @purpose: The band at the top of the brand guide page: how many of the five
//           essentials are filled in, and a link to the next one that isn't.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

import Image from "next/image";

import { IconArrowRight } from "@/components/admin/v2/icons";
import type { BrandEssential, BrandGuideTab } from "@/lib/brand/brand-essentials";

const GREEN_TEXT = "text-[#1f6b3a] dark:text-[#7fd396]";

export function BrandGuideProgress({
  essentials,
  onGo,
}: {
  essentials: BrandEssential[];
  /** Opens the tab where the next essential is filled in. Leave out for read-only members. */
  onGo?: (tab: BrandGuideTab) => void;
}) {
  const done = essentials.filter((essential) => essential.done).length;
  const next = essentials.find((essential) => !essential.done);

  return (
    <section
      aria-label="Brand guide progress"
      className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-[var(--av2-fill-green)]/50 bg-[var(--av2-success-bg)] px-6 py-4"
    >
      <div className="flex min-w-0 flex-[1_1_22rem] items-center gap-5">
        <Image
          src="/home/brand-guide-bb.webp"
          alt=""
          width={104}
          height={100}
          className="-my-2 h-[100px] w-[104px] shrink-0 object-contain max-sm:hidden"
        />
        <div className="min-w-0">
          <h2 className={`text-2xl leading-8 font-bold tracking-tight ${GREEN_TEXT}`}>
            {next ? "Brand guide progress" : "Your brand guide is ready"}
          </h2>
          <p className="mt-1 max-w-md text-base text-[var(--av2-text-2)]">
            Give your creative team a head start with clearer briefs and fewer rounds of revisions.
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-[1_1_18rem]">
        <p className={`text-base font-semibold ${GREEN_TEXT}`}>
          {done} of {essentials.length} essentials complete
        </p>
        <div aria-hidden className="mt-2 flex gap-1.5">
          {essentials.map((essential) => (
            <span
              key={essential.key}
              className={
                "h-3 flex-1 rounded-full " +
                (essential.done
                  ? "bg-[#1f6b3a] dark:bg-[#5fb071]"
                  : "bg-[#d5d9d3] dark:bg-[var(--av2-track)]")
              }
            />
          ))}
        </div>
        {next && onGo && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => onGo(next.tab)}
              className={`inline-flex items-center gap-1 rounded text-base font-semibold underline underline-offset-4 hover:no-underline focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none ${GREEN_TEXT}`}
            >
              {next.action}
              <IconArrowRight width={16} height={16} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
