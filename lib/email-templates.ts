// -----------------------------------------------------------------------------
// @file: lib/email-templates.ts
// @purpose: Subject, links and HTML for the email that goes with an in-app
//           notification. The HTML is the shared 2026-11 frame
//           (lib/email-templates/notification.tsx).
// -----------------------------------------------------------------------------

import * as React from "react";
import type { NotificationType } from "@prisma/client";
import { render } from "@react-email/render";

import {
  NotificationEmail,
  type NotificationSourceFilesContext,
  type NotificationTicketContext,
} from "@/lib/email-templates/notification";

export type { NotificationSourceFilesContext, NotificationTicketContext };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailTemplateParams = {
  recipientName: string | null;
  type: NotificationType;
  title: string;
  message: string;
  ticketId: string | null;
  /** Moodboard notifications link to the board. */
  moodboardId?: string | null;
  actorName: string | null;
  recipientRole: "customer" | "creative" | "admin";
  /** Facts about the request, for the card. */
  ticket?: NotificationTicketContext | null;
  /** Files about to be deleted (SOURCE_FILES_EXPIRING). */
  sourceFiles?: NotificationSourceFilesContext | null;
};

// ---------------------------------------------------------------------------
// Subject lines and headings
// ---------------------------------------------------------------------------

const SUBJECT_MAP: Record<NotificationType, string> = {
  REVISION_SUBMITTED: "New revision ready for review",
  FEEDBACK_SUBMITTED: "New feedback on your request",
  TICKET_COMPLETED: "Request marked complete",
  TICKET_ASSIGNED: "New request assigned to you",
  TICKET_STATUS_CHANGED: "Request status updated",
  PIN_RESOLVED: "Feedback note resolved",
  WITHDRAWAL_UPDATED: "Withdrawal update",
  CREATIVE_SCHEDULE_UPDATED: "A creative changed their working hours",
  MOODBOARD_SHARED: "Your creative shared a moodboard",
  MOODBOARD_COMMENT: "New moodboard comment",
  SUPPORT_GUIDE_CHANGED: "A Support guide you edited changed in code",
  SOURCE_FILES_EXPIRING: "Your source files will be deleted soon",
  THANKS_RECEIVED: "A customer thanked you",
};

const HEADINGS: Partial<Record<NotificationType, string>> = {
  TICKET_ASSIGNED: "New request assigned",
  FEEDBACK_SUBMITTED: "New feedback",
};

/** Admin emails carry a prefix so they're easy to filter (decided 2026-11-10). */
export const ADMIN_SUBJECT_PREFIX = "[brandbite admin]";

export function getSubjectForType(
  type: NotificationType,
  title: string,
  recipientRole?: "customer" | "creative" | "admin",
): string {
  const base = SUBJECT_MAP[type] || "Notification from brandbite";
  const subject = title ? `${base}: ${title}` : base;
  return recipientRole === "admin" ? `${ADMIN_SUBJECT_PREFIX} ${subject}` : subject;
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

function getCTAUrl(
  baseUrl: string,
  type: NotificationType,
  ticketId: string | null,
  recipientRole: "customer" | "creative" | "admin",
  moodboardId: string | null = null,
): string {
  if (type === "MOODBOARD_COMMENT" && moodboardId) {
    return `${baseUrl}/${recipientRole}/moodboards/${moodboardId}?comments=1`;
  }
  if (type === "MOODBOARD_SHARED" && moodboardId) {
    return `${baseUrl}/${recipientRole}/moodboards/${moodboardId}`;
  }
  if (type === "WITHDRAWAL_UPDATED" && recipientRole === "creative") {
    return `${baseUrl}/creative/withdrawals`;
  }
  if (type === "SUPPORT_GUIDE_CHANGED" && recipientRole === "admin") {
    return `${baseUrl}/admin/support-content?filter=review`;
  }
  if (type === "CREATIVE_SCHEDULE_UPDATED" && recipientRole === "admin") {
    return `${baseUrl}/admin/users`;
  }
  if (ticketId) {
    return `${baseUrl}/${recipientRole}/tickets/${ticketId}`;
  }
  if (recipientRole === "creative") return `${baseUrl}/creative/board`;
  if (recipientRole === "admin") return `${baseUrl}/admin/tickets`;
  return `${baseUrl}/customer`;
}

const CTA_LABELS: Record<NotificationType, string> = {
  REVISION_SUBMITTED: "Review the revision",
  FEEDBACK_SUBMITTED: "View feedback",
  TICKET_COMPLETED: "View request",
  TICKET_ASSIGNED: "View request",
  TICKET_STATUS_CHANGED: "View request",
  PIN_RESOLVED: "View request",
  WITHDRAWAL_UPDATED: "View withdrawals",
  CREATIVE_SCHEDULE_UPDATED: "View users",
  MOODBOARD_SHARED: "Open the moodboard",
  MOODBOARD_COMMENT: "View the comment",
  SUPPORT_GUIDE_CHANGED: "Review the guide",
  SOURCE_FILES_EXPIRING: "Download your files",
  THANKS_RECEIVED: "View request",
};

function getSecondaryLink(
  baseUrl: string,
  type: NotificationType,
  ticketId: string | null,
  recipientRole: "customer" | "creative" | "admin",
): { href: string; label: string } | null {
  if (type === "SOURCE_FILES_EXPIRING") {
    return {
      href: `${baseUrl}/customer/settings?tab=integrations`,
      label: "Connect Google Drive or Dropbox",
    };
  }
  if (recipientRole === "creative" && ticketId) {
    return { href: `${baseUrl}/creative/board`, label: "Open your board" };
  }
  return null;
}

function getSettingsUrl(baseUrl: string, recipientRole: "customer" | "creative" | "admin"): string {
  if (recipientRole === "customer") return `${baseUrl}/customer/settings`;
  if (recipientRole === "creative") return `${baseUrl}/creative/settings`;
  return `${baseUrl}/admin/settings`;
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

export async function buildNotificationEmailHtml(params: EmailTemplateParams): Promise<string> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const { type, ticketId, recipientRole } = params;

  return render(
    React.createElement(NotificationEmail, {
      baseUrl,
      recipientName: params.recipientName,
      recipientRole,
      type,
      heading: HEADINGS[type] ?? SUBJECT_MAP[type] ?? "Notification from brandbite",
      title: params.title,
      message: params.message,
      actorName: params.actorName,
      cta: {
        href: getCTAUrl(baseUrl, type, ticketId, recipientRole, params.moodboardId ?? null),
        label: CTA_LABELS[type] || "Open brandbite",
      },
      secondary: getSecondaryLink(baseUrl, type, ticketId, recipientRole),
      preferencesUrl: getSettingsUrl(baseUrl, recipientRole),
      ticket: params.ticket ?? null,
      sourceFiles: params.sourceFiles ?? null,
    }),
  );
}
