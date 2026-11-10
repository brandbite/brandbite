// -----------------------------------------------------------------------------
// @file: components/dashboard/creative-board/types.ts
// @purpose: Shapes the creative board reads from /api/creative/tickets and the
//           per-ticket endpoints, shared by the page and its dialogs.
// -----------------------------------------------------------------------------

import type { TicketPriority, TicketStatus } from "@/lib/board";

export type CreativeTicket = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  dueDate: string | null;
  companyTicketNumber: number | null;
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  project: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  jobType: {
    id: string;
    name: string;
    tokenCost: number;
    creativePayoutTokens: number;
    /** Service estimate, shown next to the timer. */
    estimatedHours?: number | null;
  } | null;
  revisionCount: number;
  /** Payout at the creative's current rate (server: computeCreativePayout). */
  estimatedPayout: number | null;
  latestRevisionHasFeedback: boolean;
  latestRevisionFeedbackSnippet: string | null;
};

export type CreativeTicketsStats = {
  byStatus: Record<TicketStatus, number>;
  total: number;
  openTotal: number;
  byPriority: Record<TicketPriority, number>;
  loadScore: number;
};

export type CreativeTicketsResponse = {
  stats: CreativeTicketsStats;
  tickets: CreativeTicket[];
  /** Whether a "Note to your customer" is saved for this creative. */
  revisionNotesEnabled?: boolean;
};

export type RevisionAsset = {
  id: string;
  url: string | null;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
  pinCount?: number;
  openPins?: number;
  resolvedPins?: number;
};

export type TicketRevisionEntry = {
  version: number;
  submittedAt: string | null;
  feedbackAt: string | null;
  feedbackMessage: string | null;
  creativeMessage?: string | null;
  assets?: RevisionAsset[];
};

export type BriefAsset = { id: string; url: string | null; originalName: string | null };

export type DetailTab = "current" | "brief" | "versions" | "comments";
