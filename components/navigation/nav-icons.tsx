// -----------------------------------------------------------------------------
// @file: components/navigation/nav-icons.tsx
// @purpose: Inline stroke SVGs for sidebar nav items. One per route so the
//           sidebar can render a matching glyph next to each label without
//           pulling in an icon package.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
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
};

// ---- Admin ----------------------------------------------------------------

export function IconDashboard(p: Props) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

export function IconCompanies(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M3 21V7a2 2 0 0 1 2-2h5v16" />
      <path d="M10 21V11h9a2 2 0 0 1 2 2v8" />
      <path d="M6 9h0M6 13h0M6 17h0M14 15h0M14 19h0M18 15h0M18 19h0" />
    </svg>
  );
}

export function IconBoard(p: Props) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="10" y="3" width="5" height="10" rx="1" />
      <rect x="17" y="3" width="4" height="14" rx="1" />
    </svg>
  );
}

export function IconCatalog(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  );
}

export function IconFinance(p: Props) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </svg>
  );
}

export function IconPeople(p: Props) {
  return (
    <svg {...base} {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 13.5c3 0 5 2 6 5" />
    </svg>
  );
}

export function IconConsultations(p: Props) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function IconContent(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

export function IconAiSettings(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="m12 3 2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
      <path d="M19 15l.8 1.6L21.5 17l-1.7.4L19 19l-.8-1.6L16.5 17l1.7-.4z" />
    </svg>
  );
}

export function IconSettings(p: Props) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.1a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.1a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.1a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.1a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ---- Customer -------------------------------------------------------------

export function IconOverview(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M3 12 12 3l9 9" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

export function IconServices(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="m21 16-9 5-9-5V8l9-5 9 5z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  );
}

export function IconTokens(p: Props) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 10c0-1.5 1.5-2.5 3-2.5 1 0 2 .5 2.5 1.5" />
      <path d="M14.5 14c0 1.5-1.5 2.5-3 2.5-1 0-2-.5-2.5-1.5" />
      <path d="M12 7v2M12 15v2" />
    </svg>
  );
}

export function IconMoodboards(p: Props) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="5" rx="1" />
      <rect x="13" y="10" width="8" height="11" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
    </svg>
  );
}

export function IconAiTools(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M6 3v4M4 5h4" />
      <path d="M19 17v4M17 19h4" />
      <path d="m13 3 2.5 5.5L21 11l-5.5 2.5L13 19l-2.5-5.5L5 11l5.5-2.5z" />
    </svg>
  );
}

export function IconConsultation(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function IconMembers(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconFaq(p: Props) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// ---- Creative -------------------------------------------------------------

export function IconPortfolio(p: Props) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconBalance(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M2 7h20l-2 14H4z" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}

export function IconWithdrawals(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

// ---- Utility --------------------------------------------------------------

export function IconBell(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function IconSun(p: Props) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export function IconLogout(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function IconChevronsLeft(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="m11 17-5-5 5-5" />
      <path d="m18 17-5-5 5-5" />
    </svg>
  );
}

export function IconMenu(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function IconX(p: Props) {
  return (
    <svg {...base} {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
