// -----------------------------------------------------------------------------
// @file: components/dashboard/customer-board/board-icons.tsx
// @purpose: Glyphs the board needs that the shared icon sets don't have. Same
//           24px grid and 1.75 stroke as components/admin/v2/icons.tsx.
// -----------------------------------------------------------------------------

import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconKanban(p: Props) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M15 4v16" />
    </svg>
  );
}

export function IconList(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

export function IconShare(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M14 5l6 6-6 6M20 11h-8a8 8 0 0 0-8 8" />
    </svg>
  );
}

export function IconFilter(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

export function IconPlus(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconDownload(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M12 4v11M7.5 11 12 15.5 16.5 11M4 20h16" />
    </svg>
  );
}

export function IconDots(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={2.5} />
    </svg>
  );
}

export function IconPencil(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14 8l3 3" />
    </svg>
  );
}

export function IconTrash(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
    </svg>
  );
}

export function IconExternal(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function IconCheck(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
