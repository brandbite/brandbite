// -----------------------------------------------------------------------------
// @file: app/colors/hex/page.tsx
// @purpose: Color library: every named color grouped by family, linking to each
//           color's page.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { StudioShell, WorkspacePanel } from "@/components/colors/studio/studio-shell";
import { describeColor, formatHex } from "@/lib/colors";
import { COLOR_FAMILIES } from "@/lib/colors/color-families";
import { NAMED_COLORS } from "@/lib/colors/named-colors";

export const metadata: Metadata = {
  title: "Color Names and Hex Codes",
  description:
    "Browse color names with their hex codes, shades, contrast and pairings, grouped by color family.",
  alternates: { canonical: "/colors/hex" },
};

export default function ColorLibraryPage() {
  const groups = COLOR_FAMILIES.map((family) => ({
    family,
    colors: NAMED_COLORS.filter((color) => describeColor(color.hex).family === family.slug),
  })).filter((group) => group.colors.length > 0);

  return (
    <StudioShell
      title="Every color,"
      accent="by name."
      blurb="Browse color names and hex codes, then open any color for its shades, contrast and pairings."
      breadcrumb="Color library"
    >
      {groups.map(({ family, colors }) => (
        <WorkspacePanel key={family.slug}>
          <h2 className="mb-4 text-2xl leading-8 font-semibold">{family.name}</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
            {colors.map((color) => (
              <li key={color.hex}>
                <Link
                  href={`/colors/hex/${color.hex.slice(1)}`}
                  className="flex min-h-11 items-center gap-2 rounded-[10px] border border-[var(--cs-border)] p-2 hover:border-[var(--cs-text)]"
                >
                  <span
                    className="h-8 w-8 shrink-0 rounded-md border border-[var(--cs-border)]"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm leading-5 font-medium">
                      {color.name}
                    </span>
                    <span className="block font-mono text-xs leading-4 text-[var(--cs-muted)]">
                      {formatHex(color.hex)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </WorkspacePanel>
      ))}
    </StudioShell>
  );
}
