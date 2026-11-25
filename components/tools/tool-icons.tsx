// -----------------------------------------------------------------------------
// @file: components/tools/tool-icons.tsx
// @purpose: The glyph for each hub tool (lib/tools/registry.ts). Tools that
//           already have a sidebar icon reuse it; the rest are drawn here in
//           the same stroke style.
// -----------------------------------------------------------------------------

import type { SVGProps } from "react";

import {
  IconAiTools,
  IconBrandGuide,
  IconColorStudio,
  IconMoodboards,
} from "@/components/navigation/nav-icons";
import type { ToolIconKey } from "@/lib/tools/registry";

type Props = SVGProps<SVGSVGElement>;
type Icon = (p: Props) => React.ReactElement;

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** A single-path glyph in the sidebar's stroke style. */
function glyph(d: string): Icon {
  const Glyph = (p: Props) => (
    <svg {...base} {...p}>
      <path d={d} />
    </svg>
  );
  return Glyph;
}

/** Four squares: the "All tools" entry. */
export const IconTools = glyph("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z");

/** Bars: the creative "Stats" page. */
export const IconStats = glyph("M4 20V10M10 20V4M16 20v-7M22 20H2");

export const TOOL_ICONS: Record<ToolIconKey, Icon> = {
  brandGuide: IconBrandGuide,
  colorStudio: IconColorStudio,
  moodboards: IconMoodboards,
  ai: IconAiTools,
  brandKit: glyph("M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"),
  playlist: glyph(
    "M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  ),
  gradient: glyph("M4 5h16v14H4zM4 19L20 5"),
  typeScale: glyph("M5 6h14M12 6v13M9 19h6"),
  logoPack: glyph("M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"),
  signature: glyph("M4 6h16v12H4zM4 7l8 6 8-6"),
  qr: glyph("M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z"),
  mockup: glyph("M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2"),
  copy: glyph("M4 20l4-1 11-11-3-3L5 16zM14 7l3 3"),
  resizer: glyph("M7 3v14h14M3 7h14v14"),
  postPreview: glyph(
    "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  ),
  converter: glyph("M4 8h13l-3-3M20 16H7l3 3"),
  sizes: glyph("M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4"),
  templates: glyph("M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z"),
  comments: glyph("M5 5h14v10H10l-5 4zM12 8v4M10 10h4"),
  compare: glyph("M12 3v18M4 6h6v12H4zM14 6h6v12h-6z"),
  delivery: glyph("M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"),
  animation: glyph("M4 5h16v14H4zM10 9l5 3-5 3z"),
  brief: glyph("M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5"),
  calculator: glyph(
    "M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01",
  ),
};
