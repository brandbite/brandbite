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

import type { AdminActionLog, AdminActionOutcome, AdminActionType, UserRole } from "@prisma/client";

import { sendNotificationEmail } from "@/lib/email";
import { ADMIN_SUBJECT_PREFIX } from "@/lib/email-templates";
import { renderSimpleEmail, type SimpleEmailCard } from "@/lib/email-templates/simple";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

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
  TICKET_FINANCIAL_OVERRIDE: "overrode a request's token cost",
  USER_PROMOTE_TO_ADMIN: "changed someone's admin role",
  USER_HARD_DELETE: "hard-deleted a user account",
  AI_PRICING_EDIT: "changed AI tool pricing",
  CONSULTATION_PRICING_EDIT: "changed consultation pricing",
  GOOGLE_OAUTH_CONFIG_EDIT: "changed the Google Calendar connection",
  COMPANY_AUTO_ASSIGN_EDIT: "changed a company's auto-assign setting",
  APP_SETTING_EDIT: "changed a platform setting",
  TICKET_BULK_STATUS_CHANGE: "changed request statuses in bulk",
  ADMIN_MFA_DISABLE: "turned off authenticator two-factor",
  TALENT_APPLICATION_ACCEPTED: "accepted a talent application",
  TALENT_APPLICATION_DECLINED: "declined a talent application",
  TALENT_INTERVIEW_HELD: "marked a talent interview as held",
  TALENT_INTERVIEW_MISSED: "marked a talent interview as missed (no-show)",
  TALENT_HIRED: "hired a talent applicant",
  TALENT_REJECTED_AFTER_INTERVIEW: "declined a talent applicant after the interview",
  TALENT_ONBOARDED: "onboarded a hired talent applicant as a creative",
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

export type EmailableLogEntry = {
  actorEmail: string;
  actorRole: AdminActionLog["actorRole"];
  action: AdminActionType;
  outcome: AdminActionOutcome;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

// Email titles: "<thing> <past tense>", like the design's "Company token
// balance adjusted".
const ACTION_TITLE: Record<AdminActionType, string> = {
  WITHDRAWAL_APPROVE: "Withdrawal approved",
  WITHDRAWAL_MARK_PAID: "Withdrawal marked as paid",
  WITHDRAWAL_REJECT: "Withdrawal rejected",
  PLAN_CREATE: "Plan created",
  PLAN_EDIT: "Plan edited",
  PLAN_DELETE: "Plan deleted",
  PLAN_ASSIGN: "Plan assigned to a company",
  COMPANY_TOKEN_GRANT: "Company token balance adjusted",
  PAYOUT_RULE_EDIT: "Payout rule changed",
  TICKET_FINANCIAL_OVERRIDE: "Request token cost overridden",
  USER_PROMOTE_TO_ADMIN: "Admin role changed",
  USER_HARD_DELETE: "User account hard-deleted",
  AI_PRICING_EDIT: "AI tool pricing changed",
  CONSULTATION_PRICING_EDIT: "Consultation pricing changed",
  GOOGLE_OAUTH_CONFIG_EDIT: "Google Calendar connection changed",
  COMPANY_AUTO_ASSIGN_EDIT: "Company auto-assign changed",
  APP_SETTING_EDIT: "Platform setting changed",
  TICKET_BULK_STATUS_CHANGE: "Request statuses changed in bulk",
  ADMIN_MFA_DISABLE: "Authenticator two-factor turned off",
  TALENT_APPLICATION_ACCEPTED: "Talent application accepted",
  TALENT_APPLICATION_DECLINED: "Talent application declined",
  TALENT_INTERVIEW_HELD: "Talent interview marked as held",
  TALENT_INTERVIEW_MISSED: "Talent interview marked as missed",
  TALENT_HIRED: "Talent applicant hired",
  TALENT_REJECTED_AFTER_INTERVIEW: "Talent applicant declined after interview",
  TALENT_ONBOARDED: "Talent applicant onboarded as a creative",
};

const OWNER_REASON = "You received this email because you're a brandbite site owner.";

function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function asRecord(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

function tokens(n: number): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? "token" : "tokens"}`;
}

/** Plain metadata values as rows ("balanceBefore" -> "Balance before"). */
function metadataRows(
  meta: Record<string, unknown>,
  skip: string[],
): { label: string; value: string }[] {
  return Object.entries(meta)
    .filter(([key, value]) => !skip.includes(key) && value != null && value !== "")
    .slice(0, 10)
    .map(([key, value]) => ({
      label: key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase()),
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
    }));
}

function auditRows(
  entry: EmailableLogEntry,
  actorLabel: string,
): { label: string; value: string }[] {
  return [
    { label: actorLabel, value: `${entry.actorEmail} · ${roleLabel(entry.actorRole)}` },
    { label: "Action", value: entry.action },
    { label: "Recorded at", value: formatWhen(entry.createdAt) },
    ...(entry.targetType && entry.targetId
      ? [{ label: "Target", value: `${entry.targetType} ${entry.targetId}` }]
      : []),
    ...(entry.ipAddress ? [{ label: "IP address", value: entry.ipAddress }] : []),
  ];
}

/** Exported for previews and tests. */
export async function buildEmail(entry: EmailableLogEntry, appUrl: string) {
  const actionLabel = ACTION_SUBJECT_FRAGMENT[entry.action] ?? entry.action;
  const subject = `${ADMIN_SUBJECT_PREFIX} An admin ${actionLabel}`;
  const title = ACTION_TITLE[entry.action] ?? "Admin action recorded";
  const meta = asRecord(entry.metadata);
  const cards: SimpleEmailCard[] = [];
  let intro = `${entry.actorEmail} ${actionLabel}.`;
  let skip: string[] = [];

  if (entry.action === "COMPANY_TOKEN_GRANT" && typeof meta.amount === "number") {
    const debit = meta.direction === "DEBIT";
    const amount = meta.amount;
    const before = typeof meta.balanceBefore === "number" ? meta.balanceBefore : null;
    const after =
      typeof meta.balanceAfter === "number"
        ? meta.balanceAfter
        : before != null
          ? before + (debit ? -amount : amount)
          : null;
    const company = typeof meta.companyName === "string" ? meta.companyName : null;
    intro = `${entry.actorEmail} ${debit ? "removed" : "added"} ${tokens(amount)}${
      company ? ` ${debit ? "from" : "to"} ${company}` : ""
    }.`;
    cards.push({
      icon: "coins",
      label: "Balance change",
      title: `${debit ? "-" : "+"}${tokens(amount)}`,
      pill: "Success",
      filled: true,
      tiles:
        before != null && after != null
          ? [
              { label: "Previous balance", value: tokens(before) },
              { label: "New balance", value: tokens(after) },
            ]
          : [],
    });
    skip = ["amount", "direction", "balanceBefore", "balanceAfter", "companyName"];
  }

  cards.push({
    icon: "file-text",
    title: "Audit details",
    tone: "neutral",
    rows: [...auditRows(entry, "Actor"), ...metadataRows(meta, ["notes", ...skip])],
  });

  const notes = typeof meta.notes === "string" ? meta.notes.trim() : "";
  const html = await renderSimpleEmail({
    role: "admin",
    previewText: intro,
    reason: OWNER_REASON,
    title,
    intro: [intro],
    cards,
    note: notes ? { title: "Note", text: notes } : undefined,
    action: { href: `${appUrl}/admin/audit-log`, label: "View audit log" },
    footnote: "If you didn't expect this, review the full entry.",
  });
  return { subject, html };
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
    const { subject, html } = await buildEmail(entry, appUrl);

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

// ---------------------------------------------------------------------------
// L5 — email on BLOCKED attempt
//
// Triggered when a non-owner (SITE_ADMIN, or in weird states anyone else who
// slipped past the proxy) hits an owner-only route and gets 403. Most common
// real-world case: a compromised or disgruntled SITE_ADMIN trying to
// self-promote or approve a withdrawal.
//
// Explicitly skipped: BLOCKED entries where the actor IS a SITE_OWNER. Those
// are almost always a typoed confirmation phrase during a legitimate action
// (L2 safeguard doing its job) — alerting on them is noise, not signal.
//
// Rate-limited to 1 alert per {actorId, action} per hour. A flood of 403s
// from a brute-force tool shouldn't flood the inbox.
// ---------------------------------------------------------------------------

/** Exported for previews and tests. */
export async function buildBlockedEmail(entry: EmailableLogEntry, appUrl: string) {
  const actionLabel = ACTION_SUBJECT_FRAGMENT[entry.action] ?? entry.action;
  const subject = `${ADMIN_SUBJECT_PREFIX} Blocked attempt: ${actionLabel}`;
  const html = await renderSimpleEmail({
    role: "admin",
    previewText: `${entry.actorEmail} tried to run a privileged action. It was blocked.`,
    reason: OWNER_REASON,
    title: "Blocked admin attempt",
    warning:
      "Someone without the right permissions tried a privileged action. It was blocked and did not happen.",
    cards: [
      {
        icon: "lock",
        title: "What was tried",
        tone: "neutral",
        rows: [
          ...auditRows(entry, "Who tried"),
          { label: "Tried to", value: actionLabel },
          ...(entry.errorMessage ? [{ label: "Reason", value: entry.errorMessage }] : []),
        ],
      },
    ],
    note: {
      text: "If this person shouldn't have tried this, end their session, remove their admin role, or look into it further. Repeats of the same attempt send at most one alert per hour.",
    },
    action: { href: `${appUrl}/admin/audit-log`, label: "View audit log" },
  });
  return { subject, html };
}

/**
 * Send a blocked-attempt alert to every SITE_OWNER. Only fires when:
 *   - entry.outcome === "BLOCKED", AND
 *   - entry.actorRole is NOT "SITE_OWNER" (owner-on-owner BLOCKED is almost
 *     always a typoed confirmation phrase from L2; alerting is noise)
 *
 * Rate-limited to 1 alert per {actorId, action} per hour so a brute-force
 * tool can't DoS the owner's inbox.
 */
export async function sendAdminActionBlockedAlert(
  entry: EmailableLogEntry & { actorId: string },
): Promise<void> {
  if (isDemoMode()) return;
  if (entry.outcome !== "BLOCKED") return;
  if ((entry.actorRole as UserRole) === "SITE_OWNER") return;

  try {
    // Rate limit: 1 email per hour per {actor, action}. `allowed=false`
    // means we've already sent one in the current hour window → skip.
    const limitKey = `admin-blocked-email:${entry.actorId}:${entry.action}`;
    const rl = await rateLimit(limitKey, { limit: 1, windowSeconds: 60 * 60 });
    if (!rl.allowed) return;

    const owners = await prisma.userAccount.findMany({
      where: { role: "SITE_OWNER", deletedAt: null },
      select: { email: true },
    });
    if (owners.length === 0) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://brandbite.studio";
    const { subject, html } = await buildBlockedEmail(entry, appUrl);

    await Promise.all(owners.map((o) => sendNotificationEmail(o.email, subject, html)));
  } catch (err) {
    console.warn("[admin-action-email] failed to send blocked-attempt alert:", {
      action: entry.action,
      actorEmail: entry.actorEmail,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// L6 — co-approval request on large withdrawals
//
// Fires when the first SITE_OWNER signs a large withdrawal and a second
// signer is needed. Notifies every OTHER non-deleted SITE_OWNER so one of
// them can step in and co-approve. The initial signer is excluded — they
// already know they just signed.
// ---------------------------------------------------------------------------

type CoApprovalRequestInput = {
  withdrawalId: string;
  amountTokens: number;
  creativeEmail?: string;
  firstApproverEmail: string;
  /** Owner IDs that have already signed — don't re-notify. */
  alreadyApproverIds: string[];
};

export async function sendCoApprovalRequest(input: CoApprovalRequestInput): Promise<void> {
  if (isDemoMode()) return;

  try {
    const owners = await prisma.userAccount.findMany({
      where: {
        role: "SITE_OWNER",
        deletedAt: null,
        id: { notIn: input.alreadyApproverIds },
      },
      select: { email: true },
    });
    if (owners.length === 0) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://brandbite.studio";
    const subject = `${ADMIN_SUBJECT_PREFIX} Withdrawal awaiting your co-approval`;
    const html = await renderSimpleEmail({
      role: "admin",
      previewText: `A ${tokens(input.amountTokens)} withdrawal needs a second site owner.`,
      reason: OWNER_REASON,
      title: "Withdrawal awaiting your co-approval",
      intro: [
        `${input.firstApproverEmail} approved a large withdrawal. A second site owner has to approve it before it's paid out.`,
      ],
      cards: [
        {
          icon: "coins",
          label: "Withdrawal",
          title: tokens(input.amountTokens),
          filled: true,
          tiles: [
            ...(input.creativeEmail ? [{ label: "Creative", value: input.creativeEmail }] : []),
            { label: "Already approved by", value: input.firstApproverEmail },
          ],
        },
      ],
      note: {
        text: `If this wasn't expected, for example if ${input.firstApproverEmail} shouldn't be approving withdrawals, don't approve it. Check the audit log first.`,
      },
      action: { href: `${appUrl}/admin/withdrawals`, label: "Review withdrawals" },
      secondary: { href: `${appUrl}/admin/audit-log`, label: "Open the audit log" },
    });

    await Promise.all(owners.map((o) => sendNotificationEmail(o.email, subject, html)));
  } catch (err) {
    console.warn("[admin-action-email] failed to send co-approval request:", {
      withdrawalId: input.withdrawalId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
