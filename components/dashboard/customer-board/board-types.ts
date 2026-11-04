// -----------------------------------------------------------------------------
// @file: components/dashboard/customer-board/board-types.ts
// @purpose: Shapes shared by the customer board page and its card and dialogs.
// -----------------------------------------------------------------------------

import type { TicketPriority, TicketStatus } from "@prisma/client";

export type CustomerBoardTicket = {
  id: string;
  code: string | null;
  title: string;
  description?: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  projectId: string | null;
  projectName: string | null;
  projectCode: string | null;
  isAssigned: boolean;
  jobTypeId: string | null;
  jobTypeName: string | null;
  createdAt: string;
  updatedAt?: string;
  dueDate: string | null;
  thumbnailUrl?: string | null;
  thumbnailAssetId?: string | null;
  tags?: { id: string; name: string; color: string }[];
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
  assets?: RevisionAsset[];
};

export type BriefAsset = { id: string; url: string | null; originalName: string | null };

export type BoardProject = {
  id: string;
  name: string;
  code: string | null;
  ticketCount: number;
};

export type NewTicketMetadata = {
  companySlug: string;
  tokenBalance: number;
  projects: { id: string; name: string; code: string | null }[];
  jobTypes: {
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    tokenCost: number;
    hasQuantity?: boolean;
    quantityLabel?: string | null;
    defaultQuantity?: number;
  }[];
  tags?: { id: string; name: string; color: string }[];
  // Mirrors the global TAGS_ENABLED AppSetting. Falsy hides the tag row in the
  // edit panel and the new-ticket form's picker. Treated as `true` when missing
  // so older deploys keep working.
  tagsEnabled?: boolean;
};

export type TicketEditForm = {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  projectId: string;
  jobTypeId: string;
  tagIds: string[];
};
