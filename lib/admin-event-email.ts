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

function shell(title: string, body: string): string {
  return [
    "<div style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;\">",
    '<div style="background:#f15b2b;padding:20px 24px;border-radius:12px 12px 0 0;">',
    '<span style="font-size:20px;font-weight:700;color:#fff;">brandbite</span>',
    "</div>",
    '<div style="background:#fff;padding:24px;border:1px solid #e3e1dc;border-top:none;">',
    `<h2 style="margin:0 0 12px;font-size:16px;color:#1f2126;">${title}</h2>`,
    body,
    "</div>",
    '<div style="background:#faf9f7;padding:14px 24px;border-radius:0 0 12px 12px;border:1px solid #e3e1dc;border-top:none;">',
    '<p style="margin:0;font-size:11px;color:#9a9892;">Sent automatically because you\'re a Brandbite SITE_OWNER. Mute everything via /admin/settings → ADMIN_EVENT_EMAILS_ENABLED.</p>',
    "</div></div>",
  ].join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ctaButton(href: string, label: string): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">',
    '<tr><td style="border-radius:8px;background:#f15b2b;">',
    `<a href="${href}" target="_blank" style="display:inline-block;padding:11px 22px;font-size:13px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;">${label}</a>`,
    "</td></tr></table>",
  ].join("");
}

function render(event: AdminEvent): Rendered {
  switch (event.kind) {
    case "NEW_FEEDBACK": {
      const typeLabel = {
        BUG: "Bug report",
        FEATURE: "Feature request",
        PRAISE: "Praise",
        QUESTION: "Question",
      }[event.type];
      const subject = `[Brandbite] New ${typeLabel.toLowerCase()} from ${event.submitterEmail}`;
      const body = [
        `<p style="font-size:13px;color:#424143;margin:0 0 6px;"><strong>${typeLabel}</strong> from ${escapeHtml(event.submitterEmail)} (${escapeHtml(event.submitterRole)})</p>`,
        event.subject
          ? `<p style="font-size:14px;color:#1f2126;margin:8px 0 4px;font-weight:600;">${escapeHtml(event.subject)}</p>`
          : "",
        `<p style="font-size:13px;color:#424143;white-space:pre-wrap;margin:6px 0;">${escapeHtml(event.message)}</p>`,
        event.pageUrl
          ? `<p style="font-size:11px;color:#7a7a7a;margin:10px 0 0;">From <code style="font-size:11px;background:#faf9f7;padding:1px 4px;border-radius:3px;">${escapeHtml(event.pageUrl)}</code></p>`
          : "",
        ctaButton(`${ADMIN_BASE}/admin/feedback`, "Open feedback queue"),
      ].join("");
      return { subject, html: shell(typeLabel, body) };
    }

    case "NEW_TICKET": {
      const subject = `[Brandbite] New ticket: ${event.title}`;
      const body = [
        `<p style="font-size:13px;color:#424143;margin:0 0 6px;"><strong>${escapeHtml(event.companyName)}</strong> opened a new task.</p>`,
        `<p style="font-size:14px;color:#1f2126;margin:8px 0 4px;font-weight:600;">${escapeHtml(event.title)}</p>`,
        `<p style="font-size:12px;color:#7a7a7a;margin:6px 0;">Created by ${escapeHtml(event.createdByEmail)}${event.jobTypeName ? ` · ${escapeHtml(event.jobTypeName)}` : ""}${event.ticketCode ? ` · ${escapeHtml(event.ticketCode)}` : ""}</p>`,
        ctaButton(`${ADMIN_BASE}/admin/board?ticket=${event.ticketId}`, "Open in admin board"),
      ].join("");
      return { subject, html: shell("New ticket", body) };
    }

    case "NEW_COMPANY": {
      const subject = `[Brandbite] New company signed up: ${event.companyName}`;
      const body = [
        `<p style="font-size:13px;color:#424143;margin:0 0 6px;">A new customer just finished onboarding.</p>`,
        `<p style="font-size:14px;color:#1f2126;margin:8px 0 4px;font-weight:600;">${escapeHtml(event.companyName)}</p>`,
        `<p style="font-size:12px;color:#7a7a7a;margin:6px 0;">Owner: ${escapeHtml(event.ownerEmail)}</p>`,
        ctaButton(`${ADMIN_BASE}/admin/companies/${event.companyId}`, "Open company"),
      ].join("");
      return { subject, html: shell("New company", body) };
    }

    case "NEW_PAYMENT": {
      const subject = `[Brandbite] Payment received: ${event.amountFormatted}`;
      const body = [
        `<p style="font-size:13px;color:#424143;margin:0 0 6px;"><strong>${escapeHtml(event.companyName)}</strong> just paid.</p>`,
        `<p style="font-size:14px;color:#1f2126;margin:8px 0 4px;font-weight:600;">${escapeHtml(event.amountFormatted)}${event.planName ? ` · ${escapeHtml(event.planName)}` : ""}</p>`,
        event.stripeCustomerEmail
          ? `<p style="font-size:12px;color:#7a7a7a;margin:6px 0;">Stripe customer: ${escapeHtml(event.stripeCustomerEmail)}</p>`
          : "",
        ctaButton(`${ADMIN_BASE}/admin/companies`, "View companies"),
      ].join("");
      return { subject, html: shell("Payment received", body) };
    }

    case "NEW_TALENT_APPLICATION": {
      const subject = `[Brandbite] New talent application from ${event.candidateName}`;
      const body = [
        `<p style="font-size:13px;color:#424143;margin:0 0 6px;">A new candidate applied at /talent.</p>`,
        `<p style="font-size:14px;color:#1f2126;margin:8px 0 4px;font-weight:600;">${escapeHtml(event.candidateName)}</p>`,
        `<p style="font-size:12px;color:#7a7a7a;margin:6px 0;">${escapeHtml(event.candidateEmail)} · ${escapeHtml(event.country)}</p>`,
        ctaButton(`${ADMIN_BASE}/admin/talent-applications`, "Open talent queue"),
      ].join("");
      return { subject, html: shell("New talent application", body) };
    }

    case "NEW_WITHDRAWAL_REQUEST": {
      const subject = `[Brandbite] Withdrawal request: ${event.amountTokens.toLocaleString()} tokens`;
      const body = [
        `<p style="font-size:13px;color:#424143;margin:0 0 6px;"><strong>${escapeHtml(event.creativeEmail)}</strong> requested a payout.</p>`,
        `<p style="font-size:14px;color:#1f2126;margin:8px 0 4px;font-weight:600;">${event.amountTokens.toLocaleString()} tokens</p>`,
        ctaButton(`${ADMIN_BASE}/admin/withdrawals`, "Open withdrawals queue"),
      ].join("");
      return { subject, html: shell("Withdrawal request", body) };
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
    rendered = render(event);
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
