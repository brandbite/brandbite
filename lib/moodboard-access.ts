// -----------------------------------------------------------------------------
// @file: lib/moodboard-access.ts
// @purpose: Who can do what with a moodboard, in one place. Every moodboard route
//           goes through this.
//
//   Company board (companyId set):
//     - its company's customers view it; members who can manage moodboards edit
//     - the creative assigned to its job views it
//   Creative board (companyId null):
//     - its creator has full control; it's theirs alone until shared
//     - when shared and tied to a job, that job's company views it
//   brandbite admins view every board and never edit, so nobody's work is changed
//   by accident from the admin area.
// -----------------------------------------------------------------------------

import type { AppUserRole } from "@/lib/roles";
import { isSiteAdminRole } from "@/lib/roles";
import { canManageMoodboards, isCompanyAdminRole } from "@/lib/permissions/companyRoles";
import type { CompanyRole } from "@prisma/client";

export type MoodboardViewer = {
  id: string;
  role: AppUserRole;
  activeCompanyId?: string | null;
  companyRole?: CompanyRole | null;
};

export type MoodboardAccessTarget = {
  companyId: string | null;
  createdById: string;
  ticketId: string | null;
  sharedWithCustomer: boolean;
  ticket: { companyId: string; creativeId: string | null } | null;
};

export type MoodboardAccess = {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Tie the board to a job and share it with the customer. */
  canShare: boolean;
};

const NONE: MoodboardAccess = { canView: false, canEdit: false, canDelete: false, canShare: false };

/** Add to a Prisma query to get what moodboardAccess needs. */
export const MOODBOARD_ACCESS_SELECT = {
  companyId: true,
  createdById: true,
  ticketId: true,
  sharedWithCustomer: true,
  ticket: { select: { companyId: true, creativeId: true } },
} as const;

export function moodboardAccess(
  viewer: MoodboardViewer,
  board: MoodboardAccessTarget,
): MoodboardAccess {
  if (isSiteAdminRole(viewer.role)) return { ...NONE, canView: true };

  const isCreativeBoard = board.companyId === null;

  if (viewer.role === "DESIGNER") {
    if (isCreativeBoard) {
      return board.createdById === viewer.id
        ? { canView: true, canEdit: true, canDelete: true, canShare: true }
        : NONE;
    }
    return board.ticket?.creativeId === viewer.id ? { ...NONE, canView: true } : NONE;
  }

  if (viewer.role === "CUSTOMER") {
    if (!viewer.activeCompanyId) return NONE;

    if (isCreativeBoard) {
      const shared = board.sharedWithCustomer && board.ticket?.companyId === viewer.activeCompanyId;
      return shared ? { ...NONE, canView: true } : NONE;
    }

    if (board.companyId !== viewer.activeCompanyId) return NONE;
    return {
      canView: true,
      canEdit: canManageMoodboards(viewer.companyRole ?? null),
      canDelete: board.createdById === viewer.id || isCompanyAdminRole(viewer.companyRole ?? null),
      canShare: false,
    };
  }

  return NONE;
}
