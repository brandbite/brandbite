// -----------------------------------------------------------------------------
// @file: components/dashboard/help/guide-meta.tsx
// @purpose: Presentation helpers shared by the customer and creative help center:
//           the icon for each guide, anchors and the "still stuck" copy.
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
import type { Tone } from "@/components/admin/v2/ui";
import {
  IconAiTools,
  IconBalance,
  IconBell,
  IconBoard,
  IconConsultation,
  IconMembers,
  IconMoodboards,
  IconOverview,
  IconPortfolio,
  IconServices,
  IconSettings,
  IconWithdrawals,
} from "@/components/navigation/nav-icons";

export type HelpRole = "customer" | "creative";

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

const TONES: Tone[] = ["peach", "lavender", "green"];

export function guideIcon(slug: string): ReactNode {
  return GUIDE_ICONS[slug] ?? <IconDocument {...S} />;
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
