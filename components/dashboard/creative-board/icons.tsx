// -----------------------------------------------------------------------------
// @file: components/dashboard/creative-board/icons.tsx
// @purpose: Glyphs the board needs that the shared icon sets don't have. Same
//           24px grid and 1.75 stroke as components/admin/v2/icons.tsx.
// -----------------------------------------------------------------------------

import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

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

export function IconCalendar(p: Props) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

export function IconCheckSquare(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="m9 11 3 3 9-10" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

export function IconUpload(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}
