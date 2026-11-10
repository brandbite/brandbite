// -----------------------------------------------------------------------------
// @file: lib/email-templates.ts
// @purpose: HTML email templates for notification emails. All 6 notification
//           types share a single branded layout with type-specific content.
// -----------------------------------------------------------------------------

import type { NotificationType } from "@prisma/client";

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
};

// ---------------------------------------------------------------------------
// Subject lines
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
};

export function getSubjectForType(type: NotificationType, title: string): string {
  const base = SUBJECT_MAP[type] || "Notification from brandbite";
  return title ? `${base}: ${title}` : base;
}

// ---------------------------------------------------------------------------
// CTA link builder
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

  // Customer-facing notifications link to the ticket detail
  if (ticketId && recipientRole === "customer") {
    return `${baseUrl}/customer/tickets/${ticketId}`;
  }

  if (type === "WITHDRAWAL_UPDATED" && recipientRole === "creative") {
    return `${baseUrl}/creative/withdrawals`;
  }

  // Creative-facing notifications link to the board
  if (recipientRole === "creative") {
    return `${baseUrl}/creative/board`;
  }

  if (type === "SUPPORT_GUIDE_CHANGED" && recipientRole === "admin") {
    return `${baseUrl}/admin/support-content?filter=review`;
  }
  if (type === "CREATIVE_SCHEDULE_UPDATED" && recipientRole === "admin") {
    return `${baseUrl}/admin/users`;
  }

  // Admin notifications link to admin tickets
  if (recipientRole === "admin") {
    return `${baseUrl}/admin/tickets`;
  }

  // Fallback
  return baseUrl;
}

const CTA_LABELS: Record<NotificationType, string> = {
  REVISION_SUBMITTED: "View Revision",
  FEEDBACK_SUBMITTED: "View Feedback",
  TICKET_COMPLETED: "View Request",
  TICKET_ASSIGNED: "View Request",
  TICKET_STATUS_CHANGED: "View Request",
  PIN_RESOLVED: "View Request",
  WITHDRAWAL_UPDATED: "View Withdrawals",
  CREATIVE_SCHEDULE_UPDATED: "View Users",
  MOODBOARD_SHARED: "View Request",
  MOODBOARD_COMMENT: "View the comment",
  SUPPORT_GUIDE_CHANGED: "Review the guide",
};

// ---------------------------------------------------------------------------
// Emoji icons per type
// ---------------------------------------------------------------------------

const TYPE_EMOJI: Record<NotificationType, string> = {
  REVISION_SUBMITTED: "\u{1F4E4}",
  FEEDBACK_SUBMITTED: "\u{1F4AC}",
  TICKET_COMPLETED: "\u2705",
  TICKET_ASSIGNED: "\u{1F4CB}",
  TICKET_STATUS_CHANGED: "\u{1F504}",
  PIN_RESOLVED: "\u{1F4CC}",
  WITHDRAWAL_UPDATED: "\u{1F4B8}",
  CREATIVE_SCHEDULE_UPDATED: "\u{1F552}",
  MOODBOARD_SHARED: "\u{1F3A8}",
  MOODBOARD_COMMENT: "\u{1F4AC}",
  SUPPORT_GUIDE_CHANGED: "\u{1F4D8}",
};

// ---------------------------------------------------------------------------
// Settings / unsubscribe URL
// ---------------------------------------------------------------------------

function getSettingsUrl(baseUrl: string, recipientRole: "customer" | "creative" | "admin"): string {
  if (recipientRole === "customer") return `${baseUrl}/customer/settings`;
  if (recipientRole === "creative") return `${baseUrl}/creative/settings`;
  return `${baseUrl}/admin/settings`;
}

// ---------------------------------------------------------------------------
// HTML template builder
// ---------------------------------------------------------------------------

export function buildNotificationEmailHtml(params: EmailTemplateParams): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { recipientName, type, title, message, ticketId, actorName, recipientRole } = params;

  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,";
  const emoji = TYPE_EMOJI[type] || "";
  const ctaUrl = getCTAUrl(baseUrl, type, ticketId, recipientRole, params.moodboardId ?? null);
  const ctaLabel = CTA_LABELS[type] || "View in brandbite";
  const settingsUrl = getSettingsUrl(baseUrl, recipientRole);
  const actorLine = actorName
    ? `<p style="margin:0 0 12px;font-size:13px;color:#7a7a7a;">By ${actorName}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${SUBJECT_MAP[type]}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#f15b2b;padding:20px 24px;border-radius:12px 12px 0 0;">
              <span style="font-size:20px;font-weight:700;color:#ffffff;font-family:'Plus Jakarta Sans',sans-serif;letter-spacing:0.5px;">
                brandbite
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:28px 24px;">
              <p style="margin:0 0 16px;font-size:14px;color:#424143;">${greeting}</p>

              <div style="margin:0 0 20px;padding:16px;background-color:#fff0ea;border-left:4px solid #f15b2b;border-radius:0 8px 8px 0;">
                <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#424143;">
                  ${emoji} ${title}
                </p>
                ${actorLine}
                <p style="margin:0;font-size:13px;color:#424143;line-height:1.5;">${message}</p>
              </div>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:8px;background-color:#f15b2b;">
                    <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#faf9f7;padding:16px 24px;border-radius:0 0 12px 12px;border-top:1px solid #e3e1dc;">
              <p style="margin:0;font-size:11px;color:#9a9892;text-align:center;">
                You received this email because of your notification settings on brandbite.
                <br />
                <a href="${settingsUrl}" style="color:#f15b2b;text-decoration:underline;">Manage email preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
