// -----------------------------------------------------------------------------
// @file: components/sizes/size-guide-parts.tsx
// @purpose: Server-rendered pieces of the size guide: the section menu, the
//           at-a-glance table and the "last checked" line. Tables are plain
//           HTML so search engines and screen readers read every number.
// -----------------------------------------------------------------------------

import Link from "next/link";

import { ToolNav } from "@/components/colors/studio/tool-nav";
import { stackedTable as st } from "@/components/ui/stacked-table";
import { SIZE_NAV, SIZE_NAV_MORE } from "@/lib/sizes";
import type { SizeFormat, SizePlatform } from "@/lib/sizes/types";

export const SIZE_GUIDE_LABEL = "SIZE GUIDE";
export const SIZE_GUIDE_CTA = {
  ctaHeading: "Right size.",
  ctaHeadingAccent: "Better creative.",
  ctaBlurb: "Skip the resizing. brandbite designs every format for one simple subscription.",
};

export function SizeNav() {
  return (
    <ToolNav
      items={SIZE_NAV}
      moreTools={SIZE_NAV_MORE}
      saved={null}
      overviewHref="/sizes"
      ariaLabel="Size guide platforms"
      moreLabel="More platforms"
    />
  );
}

export function formatCheckedOn(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

type Row = { platform?: SizePlatform; format: SizeFormat };

export function SizeTable({
  caption,
  rows,
  showPlatform = false,
}: {
  caption: string;
  rows: Row[];
  showPlatform?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)]">
      <table
        className={`w-full min-w-[520px] border-collapse text-left text-sm leading-5 ${st.table}`}
      >
        <caption
          className={`px-5 pt-5 pb-3 text-left text-lg leading-7 font-semibold ${st.caption}`}
        >
          {caption}
        </caption>
        <thead className={st.head}>
          <tr className="border-y border-[var(--cs-border)] text-[var(--cs-muted)]">
            {showPlatform ? (
              <th scope="col" className="px-5 py-3 font-medium">
                Platform
              </th>
            ) : null}
            <th scope="col" className="px-5 py-3 font-medium">
              Format
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Size (px)
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Ratio
            </th>
          </tr>
        </thead>
        <tbody className={st.body}>
          {rows.map(({ platform, format }) => {
            const href = platform ? `/sizes/${platform.slug}#${format.id}` : `#${format.id}`;
            return (
              <tr
                key={`${platform?.slug ?? ""}-${format.id}`}
                className={`border-b border-[var(--cs-border)] last:border-b-0 ${st.row}`}
              >
                {showPlatform && platform ? (
                  <td data-label="Platform" className={`px-5 py-3 ${st.cell}`}>
                    <Link
                      href={`/sizes/${platform.slug}`}
                      className="font-medium text-[var(--cs-brand-strong)] hover:underline"
                    >
                      {platform.name}
                    </Link>
                  </td>
                ) : null}
                <th scope="row" className={`px-5 py-3 font-medium ${st.rowHeader}`}>
                  <Link href={href} className="hover:underline">
                    {format.name}
                  </Link>
                </th>
                <td data-label="Size (px)" className={`px-5 py-3 whitespace-nowrap ${st.cell}`}>
                  {format.width} × {format.height}
                </td>
                <td data-label="Ratio" className={`px-5 py-3 ${st.cell}`}>
                  {format.ratio}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
