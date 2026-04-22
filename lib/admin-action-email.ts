// -----------------------------------------------------------------------------
// @file: lib/admin-action-email.ts
// @purpose: Security Precaution Plan — L3. After every successful privileged
//           admin action we email all SITE_OWNERs a receipt. This is the
//           "loud alarm" that turns silent-compromise attempts into a
//           noticeable signal: a real owner who didn't perform the action
//           will see the email and investigate.
//
//           Recipient scope matches the audit-log UI scope: SITE_OWNER only.
//           The actor themselves is included — that's intentional, it acts as
//           a paper-trail receipt ("I did this thing at 14:33") independent
//           of who might have seen the audit log page.
//
//           Sending is best-effort: if Resend is down or rate-limited, we
//           console-warn but never throw. A broken email channel must not
//           block the action or the audit log write.
// -----------------------------------------------------------------------------

import type { AdminActionLog, AdminActionOutcome, AdminActionType } from "@prisma/client";

import { sendNotificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Subject lines. Phrased as "you did X" from the recipient's POV — works
// whether the recipient IS the actor or is a different SITE_OWNER reading
// the same event.
// ---------------------------------------------------------------------------

const ACTION_SUBJECT_FRAGMENT: Record<AdminActionType, string> = {
  WITHDRAWAL_APPROVE: "approved a withdrawal",
  WITHDRAWAL_MARK_PAID: "marked a withdrawal as paid",
  WITHDRAWAL_REJECT: "rejected a withdrawal",
  PLAN_CREATE: "created a new plan",
  PLAN_EDIT: "edited a plan",
  PLAN_DELETE: "deleted a plan",
  PLAN_ASSIGN: "assigned a plan to a company",
  COMPANY_TOKEN_GRANT: "adjusted a company's token balance",
  PAYOUT_RULE_EDIT: "changed a payout rule",
  TICKET_FINANCIAL_OVERRIDE: "overrode a ticket's token cost",
  USER_PROMOTE_TO_ADMIN: "changed someone's admin role",
  USER_HARD_DELETE: "hard-deleted a user account",
  AI_PRICING_EDIT: "changed AI tool pricing",
  CONSULTATION_PRICING_EDIT: "changed consultation pricing",
  GOOGLE_OAUTH_CONFIG_EDIT: "changed the Google Calendar connection",
};

// ---------------------------------------------------------------------------
// Demo mode guard. Sending one Resend email per test action during demo
// playthroughs would either spam the user's inbox or burn their free-tier
// quota. Mirrors lib/auth.ts isDemoMode().
// ---------------------------------------------------------------------------

function isDemoMode(): boolean {
  if (process.env.DEMO_MODE !== "true") return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_DEMO_IN_PROD === "true";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWhen(when: Date): string {
  return when.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function formatMetadata(meta: unknown): string {
  if (meta == null) return "";
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return "";
  }
}

type EmailableLogEntry = {
  actorEmail: string;
  actorRole: AdminActionLog["actorRole"];
  action: AdminActionType;
  outcome: AdminActionOutcome;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: Date;
};

function buildEmail(entry: EmailableLogEntry, appUrl: string) {
  const actionLabel = ACTION_SUBJECT_FRAGMENT[entry.action] ?? entry.action;
  const subject = `Brandbite admin — ${actionLabel}`;
  const when = formatWhen(entry.createdAt);
  const metaJson = formatMetadata(entry.metadata);

  const html = [
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">`,
    `<div style="background: #f15b2b; padding: 16px 24px; border-radius: 10px 10px 0 0;">`,
    `<span style="font-size: 16px; font-weight: 700; color: #fff;">brandbite · security</span>`,
    `</div>`,
    `<div style="background: #fff; padding: 24px; border: 1px solid #e3e1dc; border-top: none;">`,
    `<p style="margin: 0 0 12px; font-size: 14px; color: #424143;">An admin action just ran on Brandbite:</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin: 12px 0;">`,
    `<tr><td style="padding: 6px 0; font-size: 12px; color: #7a7a7a; width: 120px; vertical-align: top;">Actor</td><td style="padding: 6px 0; font-size: 13px; color: #2a2a2b;"><strong>${escapeHtml(entry.actorEmail)}</strong> · ${escapeHtml(entry.actorRole)}</td></tr>`,
    `<tr><td style="padding: 6px 0; font-size: 12px; color: #7a7a7a; vertical-align: top;">Action</td><td style="padding: 6px 0; font-size: 13px; color: #2a2a2b;">${escapeHtml(entry.action)} (${escapeHtml(entry.outcome)})</td></tr>`,
    `<tr><td style="padding: 6px 0; font-size: 12px; color: #7a7a7a; vertical-align: top;">When</td><td style="padding: 6px 0; font-size: 13px; color: #2a2a2b;">${escapeHtml(when)}</td></tr>`,
    entry.targetType && entry.targetId
      ? `<tr><td style="padding: 6px 0; font-size: 12px; color: #7a7a7a; vertical-align: top;">Target</td><td style="padding: 6px 0; font-size: 13px; color: #2a2a2b; font-family: ui-monospace, SFMono-Regular, monospace;">${escapeHtml(entry.targetType)} ${escapeHtml(entry.targetId)}</td></tr>`
      : "",
    entry.ipAddress
      ? `<tr><td style="padding: 6px 0; font-size: 12px; color: #7a7a7a; vertical-align: top;">IP</td><td style="padding: 6px 0; font-size: 13px; color: #2a2a2b; font-family: ui-monospace, SFMono-Regular, monospace;">${escapeHtml(entry.ipAddress)}</td></tr>`
      : "",
    `</table>`,
    metaJson
      ? `<details style="margin: 12px 0; font-size: 12px;"><summary style="cursor: pointer; color: #7a7a7a;">Details</summary><pre style="background: #faf9f7; padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 11px; color: #424143; margin: 6px 0 0;">${escapeHtml(metaJson)}</pre></details>`
      : "",
    `<p style="margin: 18px 0 0; font-size: 13px; color: #424143;">If this wasn't expected, review the full log at <a href="${appUrl}/admin/audit-log" style="color: #f15b2b;">${appUrl}/admin/audit-log</a>.</p>`,
    `</div>`,
    `<div style="background: #faf9f7; padding: 12px 24px; border-radius: 0 0 10px 10px; border: 1px solid #e3e1dc; border-top: none;">`,
    `<p style="margin: 0; font-size: 11px; color: #9a9892; text-align: center;">Brandbite security monitor — you received this because you are a site owner.</p>`,
    `</div>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html };
}

// Minimal HTML escape for the fields we interpolate. Nothing fancy — emails
// render in a separate client, and we're only guarding against subject-line
// / table-cell HTML injection from user-provided data (IPs / emails are
// controlled, but metadata can in theory contain anything).
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a receipt email for a successful privileged admin action to every
 * SITE_OWNER. Best-effort — swallows errors so broken email does not affect
 * the user-facing action. No-op in demo mode.
 *
 * Only called with outcome === "SUCCESS"; BLOCKED / ERROR are a different
 * audience and a different template (L5 email-on-blocked).
 */
export async function sendAdminActionReceipt(entry: EmailableLogEntry): Promise<void> {
  if (isDemoMode()) return;
  if (entry.outcome !== "SUCCESS") return;

  try {
    const owners = await prisma.userAccount.findMany({
      where: { role: "SITE_OWNER", deletedAt: null },
      select: { email: true },
    });

    if (owners.length === 0) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://brandbite.studio";
    const { subject, html } = buildEmail(entry, appUrl);

    // Fire per-recipient. sendNotificationEmail is itself best-effort; errors
    // are swallowed inside it. We still try/catch around the whole loop for
    // safety.
    await Promise.all(owners.map((o) => sendNotificationEmail(o.email, subject, html)));
  } catch (err) {
    console.warn("[admin-action-email] failed to send receipt:", {
      action: entry.action,
      actorEmail: entry.actorEmail,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
