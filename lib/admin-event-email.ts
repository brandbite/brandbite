// -----------------------------------------------------------------------------
// @file: lib/admin-event-email.ts
// @purpose: Fan-out helper that emails every SITE_OWNER when meaningful
//           system events happen — new feedback, new ticket, new company,
//           new payment, new talent application, new withdrawal request.
//
//           Distinct from lib/admin-action-email.ts which fires ON
//           privileged ADMIN actions (the actor receives a receipt-style
//           email of what they themselves did + every other owner gets the
//           "loud alarm" copy). This helper fires on AUTONOMOUS user
//           events the owners might otherwise miss.
//
//           Single master switch via AppSetting `ADMIN_EVENT_EMAILS_ENABLED`
//           — default unset = on, set "false" to mute everything globally
//           when the inbox gets too loud during demos / data imports / etc.
//           Per-event opt-outs can land later as separate AppSettings if
//           the master switch is too coarse.
//
//           Best-effort end-to-end: a failure here never breaks the
//           triggering write. Demo-mode aware (no real Resend key, so
//           emails would silently no-op anyway).
// -----------------------------------------------------------------------------

import { getAppSetting } from "@/lib/app-settings";
import { sendNotificationEmail } from "@/lib/email";
import { ADMIN_SUBJECT_PREFIX } from "@/lib/email-templates";
import { renderSimpleEmail } from "@/lib/email-templates/simple";
import { prisma } from "@/lib/prisma";

const ADMIN_BASE = process.env.NEXT_PUBLIC_APP_URL || "https://brandbite.studio";

// ---------------------------------------------------------------------------
// Event type definitions
//
// Discriminated union — each variant carries the metadata its template
// needs and nothing more. Adding a new event = add a member here, a case
// in render() below, and a call site.
// ---------------------------------------------------------------------------

export type AdminEvent =
  | {
      kind: "NEW_FEEDBACK";
      feedbackId: string;
      type: "BUG" | "FEATURE" | "PRAISE" | "QUESTION";
      submitterEmail: string;
      submitterRole: string;
      subject: string | null;
      message: string;
      pageUrl: string | null;
    }
  | {
      kind: "NEW_TICKET";
      ticketId: string;
      ticketCode: string | null;
      title: string;
      companyName: string;
      createdByEmail: string;
      jobTypeName: string | null;
    }
  | {
      kind: "NEW_COMPANY";
      companyId: string;
      companyName: string;
      ownerEmail: string;
    }
  | {
      kind: "NEW_PAYMENT";
      companyName: string;
      amountFormatted: string; // e.g. "USD 49.00"
      planName: string | null;
      stripeCustomerEmail: string | null;
    }
  | {
      kind: "NEW_TALENT_APPLICATION";
      applicationId: string;
      candidateName: string;
      candidateEmail: string;
      country: string;
    }
  | {
      kind: "NEW_WITHDRAWAL_REQUEST";
      withdrawalId: string;
      creativeEmail: string;
      amountTokens: number;
    }
  | {
      kind: "NEW_CONTACT_MESSAGE";
      contactMessageId: string;
      name: string;
      email: string;
      company: string | null;
      topic: string | null;
      message: string;
    }
  | {
      kind: "GOOGLE_CALENDAR_DISCONNECTED";
      /** Google account that was connected, for "reconnect as X" guidance. */
      googleAccountEmail: string | null;
      /** Short technical detail (the refresh failure message), pre-truncated. */
      errorDetail: string | null;
      /** Where the failure was noticed — live request vs health-check cron. */
      detectedBy: string;
    };

// ---------------------------------------------------------------------------
// Demo-mode + master-switch guards
// ---------------------------------------------------------------------------

function isDemoMode(): boolean {
  if (process.env.DEMO_MODE !== "true") return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_DEMO_IN_PROD === "true";
}

async function eventEmailsEnabled(): Promise<boolean> {
  // Fail open: if AppSetting lookup throws, we still try to send.
  // The user's intent is "by default, owners get notified".
  try {
    const v = await getAppSetting("ADMIN_EVENT_EMAILS_ENABLED");
    return v !== "false";
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Per-event template
// ---------------------------------------------------------------------------

type Rendered = { subject: string; html: string };

const REASON =
  "You received this email because you're a brandbite site owner. Turn these off in Admin settings (ADMIN_EVENT_EMAILS_ENABLED).";

function subjectLine(text: string): string {
  return `${ADMIN_SUBJECT_PREFIX} ${text}`;
}

/** Exported for previews and tests. */
export async function renderAdminEventEmail(event: AdminEvent): Promise<Rendered> {
  const base = {
    role: "admin" as const,
    reason: REASON,
    preferencesUrl: `${ADMIN_BASE}/admin/settings`,
  };
  switch (event.kind) {
    case "NEW_FEEDBACK": {
      const typeLabel = {
        BUG: "Bug report",
        FEATURE: "Feature request",
        PRAISE: "Praise",
        QUESTION: "Question",
      }[event.type];
      return {
        subject: subjectLine(`New ${typeLabel.toLowerCase()} from ${event.submitterEmail}`),
        html: await renderSimpleEmail({
          ...base,
          previewText: event.subject ?? event.message.slice(0, 90),
          title: `New ${typeLabel.toLowerCase()}`,
          intro: [`${event.submitterEmail} (${event.submitterRole}) sent feedback.`],
          cards: [
            {
              icon: "message",
              label: typeLabel,
              title: event.subject || "Feedback",
              rows: [
                { label: "Message", value: event.message },
                ...(event.pageUrl ? [{ label: "Page", value: event.pageUrl }] : []),
              ],
            },
          ],
          action: { href: `${ADMIN_BASE}/admin/feedback`, label: "Open feedback queue" },
        }),
      };
    }

    case "NEW_TICKET": {
      return {
        subject: subjectLine(`New request: ${event.title}`),
        html: await renderSimpleEmail({
          ...base,
          previewText: `${event.companyName} opened a new request.`,
          title: "New request",
          intro: [`${event.companyName} opened a new request.`],
          cards: [
            {
              icon: "ticket",
              label: "Request",
              title: [event.ticketCode, event.title].filter(Boolean).join(" "),
              tiles: [
                { label: "Company", value: event.companyName },
                ...(event.jobTypeName ? [{ label: "Service", value: event.jobTypeName }] : []),
                { label: "Created by", value: event.createdByEmail },
              ],
            },
          ],
          action: {
            href: `${ADMIN_BASE}/admin/board?ticket=${event.ticketId}`,
            label: "Open in admin board",
          },
        }),
      };
    }

    case "NEW_COMPANY": {
      return {
        subject: subjectLine(`New company signed up: ${event.companyName}`),
        html: await renderSimpleEmail({
          ...base,
          previewText: `${event.companyName} finished onboarding.`,
          title: "New company",
          intro: ["A new customer just finished onboarding."],
          cards: [
            {
              icon: "user",
              label: "Company",
              title: event.companyName,
              tiles: [{ label: "Owner", value: event.ownerEmail }],
            },
          ],
          action: {
            href: `${ADMIN_BASE}/admin/companies/${event.companyId}`,
            label: "Open company",
          },
        }),
      };
    }

    case "NEW_PAYMENT": {
      return {
        subject: subjectLine(`Payment received: ${event.amountFormatted}`),
        html: await renderSimpleEmail({
          ...base,
          previewText: `${event.companyName} paid ${event.amountFormatted}.`,
          title: "Payment received",
          intro: [`${event.companyName} just paid.`],
          cards: [
            {
              icon: "coins",
              label: "Payment",
              title: event.amountFormatted,
              pill: "Success",
              filled: true,
              tiles: [
                { label: "Company", value: event.companyName },
                ...(event.planName ? [{ label: "Plan", value: event.planName }] : []),
                ...(event.stripeCustomerEmail
                  ? [{ label: "Stripe customer", value: event.stripeCustomerEmail }]
                  : []),
              ],
            },
          ],
          action: { href: `${ADMIN_BASE}/admin/companies`, label: "View companies" },
        }),
      };
    }

    case "NEW_TALENT_APPLICATION": {
      return {
        subject: subjectLine(`New talent application from ${event.candidateName}`),
        html: await renderSimpleEmail({
          ...base,
          previewText: `${event.candidateName} applied to work with brandbite.`,
          title: "New talent application",
          intro: ["A new candidate applied on the talent page."],
          cards: [
            {
              icon: "user",
              label: "Candidate",
              title: event.candidateName,
              tiles: [
                { label: "Email", value: event.candidateEmail },
                { label: "Country", value: event.country },
              ],
            },
          ],
          action: { href: `${ADMIN_BASE}/admin/talent-applications`, label: "Open talent queue" },
        }),
      };
    }

    case "NEW_WITHDRAWAL_REQUEST": {
      const amount = `${event.amountTokens.toLocaleString("en-US")} tokens`;
      return {
        subject: subjectLine(`Withdrawal request: ${amount}`),
        html: await renderSimpleEmail({
          ...base,
          previewText: `${event.creativeEmail} requested a ${amount} payout.`,
          title: "Withdrawal request",
          intro: [`${event.creativeEmail} requested a payout.`],
          cards: [
            {
              icon: "coins",
              label: "Amount",
              title: amount,
              filled: true,
              tiles: [{ label: "Creative", value: event.creativeEmail }],
            },
          ],
          action: { href: `${ADMIN_BASE}/admin/withdrawals`, label: "Open withdrawals queue" },
        }),
      };
    }

    case "NEW_CONTACT_MESSAGE": {
      return {
        subject: subjectLine(`New contact message from ${event.name}`),
        html: await renderSimpleEmail({
          ...base,
          previewText: event.message.slice(0, 90),
          title: "New contact message",
          intro: ["Someone wrote in through the contact page."],
          cards: [
            {
              icon: "message",
              label: "From",
              title: event.name,
              rows: [
                { label: "Email", value: event.email },
                ...(event.company ? [{ label: "Company", value: event.company }] : []),
                ...(event.topic ? [{ label: "Topic", value: event.topic }] : []),
                { label: "Message", value: event.message },
              ],
            },
          ],
          action: { href: `${ADMIN_BASE}/admin/contact`, label: "Open contact inbox" },
          secondary: { href: `mailto:${event.email}`, label: `Reply to ${event.email}` },
        }),
      };
    }

    case "GOOGLE_CALENDAR_DISCONNECTED": {
      return {
        subject: subjectLine("Google Calendar disconnected: bookings can't be scheduled"),
        html: await renderSimpleEmail({
          ...base,
          previewText: "Reconnect Google Calendar so bookings can be scheduled again.",
          title: "Google Calendar disconnected",
          warning:
            "Until someone reconnects, consultation and talent interview bookings can't create calendar events.",
          intro: [
            "Google rejected the stored access (it was revoked or expired, or the account password changed).",
          ],
          cards: [
            {
              icon: "calendar",
              title: "Connection details",
              tone: "neutral",
              rows: [
                ...(event.googleAccountEmail
                  ? [{ label: "Connected as", value: event.googleAccountEmail }]
                  : []),
                { label: "Noticed by", value: event.detectedBy },
                ...(event.errorDetail ? [{ label: "Error", value: event.errorDetail }] : []),
              ],
            },
          ],
          note: {
            text: event.googleAccountEmail
              ? `Reconnect with ${event.googleAccountEmail} so events land on the same calendar. You get this email once per outage; the admin panel shows a banner until it's fixed.`
              : "You get this email once per outage; the admin panel shows a banner until it's fixed.",
          },
          action: {
            href: `${ADMIN_BASE}/admin/consultations/settings`,
            label: "Reconnect Google Calendar",
          },
        }),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Fan an admin event email out to every active SITE_OWNER. Best-effort:
 *  any failure here is logged and swallowed — the caller's primary work
 *  (creating the ticket / company / withdrawal / etc.) is unaffected. */
export async function notifySiteOwnersOfEvent(event: AdminEvent): Promise<void> {
  if (isDemoMode()) return;
  if (!(await eventEmailsEnabled())) return;

  let owners: { email: string }[] = [];
  try {
    owners = await prisma.userAccount.findMany({
      where: { role: "SITE_OWNER", deletedAt: null },
      select: { email: true },
    });
  } catch (err) {
    console.error("[admin-event-email] failed to resolve owners", err);
    return;
  }

  if (owners.length === 0) {
    console.warn(`[admin-event-email] no SITE_OWNER recipients — ${event.kind} skipped`);
    return;
  }

  let rendered: Rendered;
  try {
    rendered = await renderAdminEventEmail(event);
  } catch (err) {
    console.error("[admin-event-email] template render failed", event.kind, err);
    return;
  }

  for (const owner of owners) {
    try {
      await sendNotificationEmail(owner.email, rendered.subject, rendered.html);
    } catch (err) {
      console.error("[admin-event-email] send failed", owner.email, event.kind, err);
    }
  }
}
