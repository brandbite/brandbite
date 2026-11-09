// -----------------------------------------------------------------------------
// @file: components/admin/v2/icons.tsx
// @purpose: Thin-stroke glyphs for the admin design language v1. Same 24px
//           grid / 1.75 stroke as components/navigation/nav-icons.tsx so the
//           two sets read as one icon family. Default render size 20px.
// -----------------------------------------------------------------------------

import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconBuilding(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <path d="M15 9h3a2 2 0 0 1 2 2v10" />
      <path d="M3 21h18M8 7h3M8 11h3M8 15h3" />
    </svg>
  );
}

export function IconUsers(p: Props) {
  return (
    <svg {...base} {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </svg>
  );
}

export function IconTicket(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v8a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2z" />
    </svg>
  );
}

export function IconCoins(p: Props) {
  return (
    <svg {...base} {...p}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </svg>
  );
}

export function IconClock(p: Props) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconAlertCircle(p: Props) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </svg>
  );
}

export function IconWallet(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 7l11-3v3" />
      <path d="M15 13.5h2" />
    </svg>
  );
}

export function IconDocument(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

export function IconArrowUpRight(p: Props) {
  return (
    <svg {...base} width={14} height={14} {...p}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function IconChevronDown(p: Props) {
  return (
    <svg {...base} width={16} height={16} {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconSearch(p: Props) {
  return (
    <svg {...base} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconChevronRight(p: Props) {
  return (
    <svg {...base} width={18} height={18} {...p}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function IconArrowLeft(p: Props) {
  return (
    <svg {...base} width={18} height={18} {...p}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

/** A picture: frame, sun and hill. Marks screenshots and visual guides. */
export function IconImage(p: Props) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="9.5" r="1.75" />
      <path d="m21 16-4.5-4.5L7 20" />
    </svg>
  );
}

/** Two diagonal arrows: open something full size. */
export function IconExpand(p: Props) {
  return (
    <svg {...base} width={18} height={18} {...p}>
      <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
    </svg>
  );
}

export function IconArrowRight(p: Props) {
  return (
    <svg {...base} width={18} height={18} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
