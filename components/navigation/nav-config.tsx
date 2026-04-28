// -----------------------------------------------------------------------------
// @file: components/navigation/nav-config.tsx
// @purpose: Role-specific sidebar nav definitions. Kept separate from the
//           sidebar component so reordering / renaming / adding items is a
//           data-only change.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
// -----------------------------------------------------------------------------

import type { ComponentType, SVGProps } from "react";
import {
  IconAiSettings,
  IconAiTools,
  IconBalance,
  IconBoard,
  IconCatalog,
  IconCompanies,
  IconConsultation,
  IconConsultations,
  IconContent,
  IconDashboard,
  IconFaq,
  IconFinance,
  IconMembers,
  IconMoodboards,
  IconOverview,
  IconPeople,
  IconPortfolio,
  IconServices,
  IconSettings,
  IconTokens,
  IconWithdrawals,
} from "./nav-icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type NavLeaf = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Additional paths that should keep this item in the active state. */
  highlightOnPaths?: string[];
  /** If true, only render this item for SITE_OWNER. SITE_ADMIN + others
   *  never see it — the underlying page is expected to also enforce the
   *  guard server-side (defence in depth). */
  ownerOnly?: boolean;
};

export type NavSection = {
  label: string | null; // null = no visible section header
  items: NavLeaf[];
};

export type NavRole = "admin" | "customer" | "creative";

export type NavConfig = {
  brand: string;
  roleLabel?: string;
  homeHref: string;
  sections: NavSection[];
};

// ---------------------------------------------------------------------------
// Admin — regrouped so every sidebar section makes sense read top-down
// ---------------------------------------------------------------------------

export const ADMIN_NAV: NavConfig = {
  brand: "Brandbite",
  roleLabel: "Admin",
  homeHref: "/admin",
  sections: [
    {
      label: null,
      items: [
        { href: "/admin", label: "Dashboard", icon: IconDashboard },
        { href: "/admin/companies", label: "Companies", icon: IconCompanies },
        {
          href: "/admin/board",
          label: "Board",
          icon: IconBoard,
          highlightOnPaths: ["/admin/tickets"],
        },
        { href: "/admin/consultations", label: "Consultations", icon: IconConsultations },
      ],
    },
    {
      label: "Catalog",
      items: [
        { href: "/admin/plans", label: "Plans", icon: IconCatalog },
        { href: "/admin/job-types", label: "Job Types", icon: IconCatalog },
        { href: "/admin/job-type-categories", label: "Categories", icon: IconCatalog },
      ],
    },
    {
      label: "Finance",
      items: [
        { href: "/admin/payout-rules", label: "Payout Rules", icon: IconFinance },
        { href: "/admin/ledger", label: "Ledger", icon: IconFinance },
        { href: "/admin/token-analytics", label: "Analytics", icon: IconFinance },
        { href: "/admin/withdrawals", label: "Withdrawals", icon: IconWithdrawals },
      ],
    },
    {
      label: "People",
      items: [
        { href: "/admin/creative-analytics", label: "Creatives", icon: IconPeople },
        { href: "/admin/time-tracking", label: "Time tracking", icon: IconPeople },
        { href: "/admin/users", label: "Users", icon: IconPeople },
      ],
    },
    {
      label: "Content",
      items: [
        { href: "/admin/landing", label: "Landing page", icon: IconContent },
        { href: "/admin/pages", label: "Pages", icon: IconContent },
        { href: "/admin/showcase", label: "Showcase", icon: IconContent },
        { href: "/admin/blog", label: "Blog", icon: IconContent },
        { href: "/admin/news", label: "News", icon: IconContent },
        { href: "/admin/docs", label: "Docs", icon: IconContent },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/admin/ai-settings", label: "AI Settings", icon: IconAiSettings },
        {
          href: "/admin/audit-log",
          label: "Audit Log",
          icon: IconSettings,
          ownerOnly: true,
        },
        {
          href: "/admin/settings/mfa",
          label: "Two-factor",
          icon: IconSettings,
          ownerOnly: true,
        },
        { href: "/admin/settings", label: "Settings", icon: IconSettings },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Customer — THE big fix. 10 flat items → 3 natural sections.
// ---------------------------------------------------------------------------

export const CUSTOMER_NAV: NavConfig = {
  brand: "Brandbite",
  homeHref: "/customer/board",
  sections: [
    {
      label: "Workspace",
      items: [
        { href: "/customer", label: "Overview", icon: IconOverview },
        {
          href: "/customer/board",
          label: "Board",
          icon: IconBoard,
          highlightOnPaths: ["/customer/tickets"],
        },
        { href: "/customer/moodboards", label: "Moodboards", icon: IconMoodboards },
        { href: "/customer/ai-tools", label: "AI Tools", icon: IconAiTools },
      ],
    },
    {
      label: "Billing",
      items: [
        { href: "/customer/services", label: "Services", icon: IconServices },
        { href: "/customer/tokens", label: "Tokens", icon: IconTokens },
        { href: "/customer/consultation", label: "Consultation", icon: IconConsultation },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/customer/members", label: "Members", icon: IconMembers },
        { href: "/customer/settings", label: "Settings", icon: IconSettings },
        { href: "/customer/faq", label: "FAQ", icon: IconFaq },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Creative — small enough to stay in a single section
// ---------------------------------------------------------------------------

export const CREATIVE_NAV: NavConfig = {
  brand: "Brandbite",
  roleLabel: "Creative",
  homeHref: "/creative/board",
  sections: [
    {
      label: null,
      items: [
        { href: "/creative", label: "Overview", icon: IconOverview },
        {
          href: "/creative/board",
          label: "Board",
          icon: IconBoard,
          highlightOnPaths: ["/creative/tickets"],
        },
        { href: "/creative/portfolio", label: "Portfolio", icon: IconPortfolio },
        { href: "/creative/balance", label: "Balance", icon: IconBalance },
        { href: "/creative/withdrawals", label: "Withdrawals", icon: IconWithdrawals },
      ],
    },
    {
      label: "Help",
      items: [
        { href: "/creative/faq", label: "FAQ", icon: IconFaq },
        { href: "/creative/settings", label: "Settings", icon: IconSettings },
      ],
    },
  ],
};

export function getNavConfig(role: NavRole): NavConfig {
  switch (role) {
    case "admin":
      return ADMIN_NAV;
    case "customer":
      return CUSTOMER_NAV;
    case "creative":
      return CREATIVE_NAV;
  }
}
