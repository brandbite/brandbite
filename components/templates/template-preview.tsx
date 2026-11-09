// -----------------------------------------------------------------------------
// @file: components/templates/template-preview.tsx
// @purpose: Preview of a downloadable template: a rendered page for documents
//           and decks, and a small live mock-up for the content calendar.
// -----------------------------------------------------------------------------

import Image from "next/image";

import type { FreeTemplate } from "@/lib/templates";

// Date, format, size, status: the columns that show what the sheet does.
const CALENDAR_ROWS = [
  ["Mar 3", "Instagram · Portrait post", "1080 × 1350", "In design"],
  ["Mar 4", "LinkedIn · Landscape post", "1200 × 627", "Brief ready"],
  ["Mar 5", "Instagram · Story", "1080 × 1920", "Approved"],
  ["Mar 6", "TikTok · Video", "1080 × 1920", "Idea"],
  ["Mar 9", "YouTube · Video thumbnail", "3840 × 2160", "Idea"],
];

const STATUS_FILL: Record<string, string> = {
  Idea: "#EEEEEE",
  "Brief ready": "#ECE4FF",
  "In design": "#FFF1D6",
  Approved: "#DDF3E4",
};

function CalendarMock() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-[var(--cs-border)] bg-white"
      aria-hidden="true"
    >
      <table className="w-full table-fixed border-collapse text-left text-[11px] leading-4">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[40%]" />
          <col className="w-[22%]" />
          <col className="w-[22%]" />
        </colgroup>
        <thead>
          <tr className="bg-[#2B2D33] text-white">
            {["Date", "Format", "Size (px)", "Status"].map((h) => (
              <th key={h} className="px-2 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CALENDAR_ROWS.map((row) => (
            <tr
              key={row[0] + row[1]}
              className="border-b border-[var(--cs-border)] last:border-b-0"
            >
              {row.map((cell, i) => (
                <td
                  key={i}
                  className="truncate px-2 py-2"
                  style={{
                    backgroundColor: i === 3 ? STATUS_FILL[cell] : i === 2 ? "#FFFFFF" : "#FFF7E6",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TemplatePreview({
  template,
  priority = false,
}: {
  template: FreeTemplate;
  priority?: boolean;
}) {
  if (template.preview.kind === "calendar") return <CalendarMock />;
  const { src, width, height, alt } = template.preview;
  return (
    <Image
      src={src}
      width={width}
      height={height}
      alt={alt}
      priority={priority}
      className="h-auto w-full rounded-xl border border-[var(--cs-border)] bg-white"
    />
  );
}
