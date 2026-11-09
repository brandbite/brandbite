// -----------------------------------------------------------------------------
// @file: components/dashboard/help/guide-meta.tsx
// @purpose: Presentation helpers shared by the Support pages of all three
//           dashboards: the icon for each guide, the name of the page a guide
//           opens, anchors and the "still stuck" copy.
// -----------------------------------------------------------------------------

import type { ReactNode } from "react";

import {
  IconClock,
  IconCoins,
  IconDocument,
  IconTicket,
  IconUsers,
  IconWallet,
} from "@/components/admin/v2/icons";
import { getAdminPageIndex } from "@/components/admin/v2/admin-nav";
import type { Tone } from "@/components/admin/v2/ui";
import { getDashboardPageIndex } from "@/components/dashboard/dashboard-nav";
import {
  IconAiSettings,
  IconAiTools,
  IconBalance,
  IconBell,
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
  IconWithdrawals,
} from "@/components/navigation/nav-icons";
import type { SupportRole } from "@/lib/support";

export type HelpRole = SupportRole;

const S = { width: 22, height: 22 };

const GUIDE_ICONS: Record<string, ReactNode> = {
  "getting-around": <IconOverview {...S} />,
  "how-requests-work": <IconCoins {...S} />,
  "how-work-works": <IconTicket {...S} />,
  "getting-assigned": <IconUsers {...S} />,
  "roles-and-permissions": <IconUsers {...S} />,
  overview: <IconOverview {...S} />,
  board: <IconBoard {...S} />,
  "create-request": <IconDocument {...S} />,
  "deliver-work": <IconDocument {...S} />,
  "review-and-approve": <IconClock {...S} />,
  "handle-feedback": <IconClock {...S} />,
  "requests-table": <IconTicket {...S} />,
  "tickets-table": <IconTicket {...S} />,
  "ticket-details": <IconTicket {...S} />,
  projects: <IconMoodboards {...S} />,
  moodboards: <IconMoodboards {...S} />,
  "ai-tools": <IconAiTools {...S} />,
  services: <IconServices {...S} />,
  tokens: <IconCoins {...S} />,
  "plans-and-top-ups": <IconWallet {...S} />,
  consultation: <IconConsultation {...S} />,
  earnings: <IconCoins {...S} />,
  balance: <IconBalance {...S} />,
  withdrawals: <IconWithdrawals {...S} />,
  portfolio: <IconPortfolio {...S} />,
  profile: <IconUsers {...S} />,
  notifications: <IconBell {...S} />,
  members: <IconMembers {...S} />,
  settings: <IconSettings {...S} />,
};

/** Admin guides whose slug means something else (or nothing) elsewhere. */
const ADMIN_GUIDE_ICONS: Record<string, ReactNode> = {
  "roles-and-safeguards": <IconUsers {...S} />,
  dashboard: <IconDashboard {...S} />,
  companies: <IconCoins {...S} />,
  "request-drafts": <IconDocument {...S} />,
  "board-and-tickets": <IconBoard {...S} />,
  "ticket-detail": <IconTicket {...S} />,
  consultations: <IconConsultations {...S} />,
  meetings: <IconConsultations {...S} />,
  "consultation-settings": <IconSettings {...S} />,
  plans: <IconCatalog {...S} />,
  "plan-assignment": <IconCompanies {...S} />,
  "job-types": <IconCatalog {...S} />,
  "job-type-categories": <IconCatalog {...S} />,
  payouts: <IconFinance {...S} />,
  withdrawals: <IconWallet {...S} />,
  ledger: <IconFinance {...S} />,
  "completed-jobs": <IconCoins {...S} />,
  creatives: <IconPeople {...S} />,
  "talent-applications": <IconPeople {...S} />,
  "content-overview": <IconContent {...S} />,
  faq: <IconFaq {...S} />,
  "support-content": <IconFaq {...S} />,
  "blog-news-showcase": <IconContent {...S} />,
  docs: <IconDocument {...S} />,
  "color-content": <IconContent {...S} />,
  "site-and-pages": <IconContent {...S} />,
  "ai-settings": <IconAiSettings {...S} />,
  inboxes: <IconFaq {...S} />,
  "audit-log": <IconSettings {...S} />,
  "two-factor": <IconSettings {...S} />,
  profile: <IconMembers {...S} />,
};

const TONES: Tone[] = ["lavender", "peach", "green"];

export function guideIcon(slug: string, role?: SupportRole): ReactNode {
  return (
    (role === "admin" ? ADMIN_GUIDE_ICONS[slug] : undefined) ??
    GUIDE_ICONS[slug] ?? <IconDocument {...S} />
  );
}

/** The sidebar name of a dashboard page, e.g. /admin/board → "Board". */
export function pageLabel(role: SupportRole, href: string): string | undefined {
  const pages = role === "admin" ? getAdminPageIndex(true) : getDashboardPageIndex(role);
  return pages.find((p) => p.href === href)?.label;
}

/** Cycles tile colours by position so a row of cards reads as a set. */
export function guideTone(index: number): Tone {
  return TONES[index % TONES.length];
}

/** Heading or category → anchor, e.g. "Getting started" → "getting-started". */
export function toAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function StillStuckText() {
  return (
    <>
      Use the feedback button in the bottom-right corner and pick{" "}
      <span className="font-semibold text-[var(--av2-text)]">
        I&rsquo;m not sure how this works
      </span>
      .
    </>
  );
}
