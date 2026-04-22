// -----------------------------------------------------------------------------
// @file: lib/mfa.ts
// @purpose: Email-code second factor for money-moving admin actions (Security
//           Precaution Plan — L4). When a SITE_OWNER tries a money action
//           and hasn't completed MFA in the last 30 minutes, the route calls
//           `requireFreshMfa`. That helper either returns ok or issues a new
//           challenge (sends email, records the code hash) and returns a 202
//           payload the route can short-circuit to the client.
//
//           Design:
//             - Code is 6 numeric digits. Stored as SHA-256 only; plaintext
//               is sent in the email and never persisted server-side.
//             - One action tag today: "MONEY_ACTION". Covers every L2-
//               protected route. Single MFA unlocks the whole category for
//               the trust window.
//             - Challenges expire in 10 min (short-lived code).
//             - Trust window is 30 min after successful verify. Within that
//               window, further money actions don't re-challenge.
//             - 5-attempt cap per challenge — at the 5th wrong code,
//               `attempts` freezes the challenge and a new one must be
//               issued.
//             - Demo mode: MFA is disabled entirely (ALLOW_DEMO_IN_PROD on
//               demo.brandbite.studio means emails aren't sent reliably +
//               testing money actions on demo would be blocked). Production
//               (real NEXT_PUBLIC_APP_URL, DEMO_MODE=false) enforces the
//               flow.
// -----------------------------------------------------------------------------

import { createHash, randomInt } from "node:crypto";

import { NextResponse } from "next/server";

import { sendNotificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const MFA_ACTION_TAG_MONEY = "MONEY_ACTION";

// ---------------------------------------------------------------------------
// Tunables. Keep as constants so they show up in one place for review.
// ---------------------------------------------------------------------------
const CODE_LENGTH = 6;
const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes to enter the code
const TRUST_WINDOW_MS = 30 * 60 * 1000; // 30 minutes of free money actions after verify
const MAX_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Demo-mode guard. Mirrors the check in lib/auth.ts — MFA is disabled when
// DEMO_MODE is on (and allowed in prod via ALLOW_DEMO_IN_PROD).
// ---------------------------------------------------------------------------
function isDemoMode(): boolean {
  if (process.env.DEMO_MODE !== "true") return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_DEMO_IN_PROD === "true";
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function generateNumericCode(length: number): string {
  const max = 10 ** length;
  const n = randomInt(0, max);
  return String(n).padStart(length, "0");
}

// ---------------------------------------------------------------------------
// Recent-MFA check
// ---------------------------------------------------------------------------

/**
 * True iff this user has successfully completed an MFA challenge for this
 * action tag within the trust window. Ignores unconsumed + expired rows.
 */
export async function hasRecentSuccessfulMfa(userId: string, actionTag: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - TRUST_WINDOW_MS);
  const match = await prisma.mfaChallenge.findFirst({
    where: {
      userId,
      actionTag,
      consumedAt: { gte: cutoff },
    },
    select: { id: true },
  });
  return Boolean(match);
}

// ---------------------------------------------------------------------------
// Challenge issue
// ---------------------------------------------------------------------------

type IssueChallengeContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type IssueChallengeResult = {
  challengeId: string;
  expiresAt: Date;
};

/**
 * Issue a fresh challenge: generate a 6-digit code, hash it, persist the
 * hash, email the plaintext code. Returns the challenge id + expiry so
 * the caller can hand them back to the client. Never returns the plaintext.
 */
export async function issueChallenge(
  userId: string,
  userEmail: string,
  userName: string | null,
  actionTag: string,
  context: IssueChallengeContext = {},
): Promise<IssueChallengeResult> {
  const code = generateNumericCode(CODE_LENGTH);
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  const challenge = await prisma.mfaChallenge.create({
    data: {
      userId,
      actionTag,
      codeHash,
      expiresAt,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
    select: { id: true, expiresAt: true },
  });

  // Email the plaintext code. Best-effort: sendNotificationEmail never
  // throws, but we still double-wrap in case of a deeper failure we want
  // to swallow.
  try {
    const subject = `Brandbite admin — security code ${code}`;
    const minutesValid = Math.round(CHALLENGE_TTL_MS / 60_000);
    const html = [
      `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto;">`,
      `<div style="background: #2a2a2b; padding: 16px 24px; border-radius: 10px 10px 0 0;">`,
      `<span style="font-size: 16px; font-weight: 700; color: #fff;">brandbite · security code</span>`,
      `</div>`,
      `<div style="background: #fff; padding: 24px; border: 1px solid #e3e1dc; border-top: none;">`,
      `<p style="margin: 0 0 12px; font-size: 14px; color: #424143;">Hi${userName ? " " + escapeHtml(userName) : ""},</p>`,
      `<p style="margin: 0 0 16px; font-size: 14px; color: #424143;">Enter this code in the Brandbite admin panel to confirm a money-moving action:</p>`,
      `<div style="text-align: center; margin: 20px 0;">`,
      `<span style="display: inline-block; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 32px; letter-spacing: 8px; font-weight: 700; color: #2a2a2b; background: #faf9f7; padding: 14px 24px; border-radius: 10px; border: 1px solid #e3e1dc;">${code}</span>`,
      `</div>`,
      `<p style="margin: 0 0 8px; font-size: 13px; color: #7a7a7a;">This code expires in ${minutesValid} minutes and can only be used once.</p>`,
      `<p style="margin: 0; font-size: 13px; color: #b4232e;">If you did NOT just try to perform a money action, someone has your password. <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/admin/audit-log" style="color: #b4232e;">Review the audit log</a> and change your password immediately.</p>`,
      `</div>`,
      `<div style="background: #faf9f7; padding: 12px 24px; border-radius: 0 0 10px 10px; border: 1px solid #e3e1dc; border-top: none;">`,
      `<p style="margin: 0; font-size: 11px; color: #9a9892; text-align: center;">Brandbite security monitor</p>`,
      `</div>`,
      `</div>`,
    ].join("\n");
    await sendNotificationEmail(userEmail, subject, html);
  } catch (err) {
    console.warn("[mfa] failed to email challenge code:", {
      userEmail,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return { challengeId: challenge.id, expiresAt: challenge.expiresAt };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Challenge verify
// ---------------------------------------------------------------------------

export type VerifyResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Verify a challenge. On success, sets consumedAt (unlocking the trust
 * window). On failure, increments attempts. After MAX_ATTEMPTS, the
 * challenge is locked — further attempts reject, new challenge must be
 * issued.
 */
export async function verifyChallenge(
  userId: string,
  challengeId: string,
  code: string,
): Promise<VerifyResult> {
  if (!challengeId || typeof challengeId !== "string") {
    return { ok: false, status: 400, error: "Missing challenge id." };
  }
  if (!code || typeof code !== "string" || !/^\d+$/.test(code.trim())) {
    return { ok: false, status: 400, error: "Enter the numeric code from the email." };
  }

  const challenge = await prisma.mfaChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge || challenge.userId !== userId) {
    return { ok: false, status: 404, error: "Challenge not found." };
  }
  if (challenge.consumedAt) {
    return {
      ok: false,
      status: 400,
      error: "This code was already used. Request a new one.",
    };
  }
  if (challenge.expiresAt <= new Date()) {
    return { ok: false, status: 400, error: "Code expired. Request a new one." };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return {
      ok: false,
      status: 400,
      error: "Too many wrong attempts. Request a new code.",
    };
  }

  const hash = sha256(code.trim());
  if (hash !== challenge.codeHash) {
    await prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = MAX_ATTEMPTS - (challenge.attempts + 1);
    return {
      ok: false,
      status: 400,
      error:
        remaining > 0
          ? `Wrong code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
          : "Too many wrong attempts. Request a new code.",
    };
  }

  await prisma.mfaChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Route helper — the thing every money route calls
// ---------------------------------------------------------------------------

type RequireMfaUser = {
  id: string;
  email: string;
  name?: string | null;
};

export type RequireFreshMfaResult = { ok: true } | { ok: false; response: NextResponse };

/**
 * The route-level check. Either returns ok (proceed with the action) or an
 * already-formed NextResponse the route should return directly. The 202
 * response includes `requiresMfa: true` + `challengeId` so the client can
 * prompt for the code + retry.
 *
 * Skipped entirely in demo mode — owners on demo.brandbite.studio cannot
 * receive real emails, so MFA would make money actions untestable there.
 */
export async function requireFreshMfa(
  user: RequireMfaUser,
  actionTag: string,
  context: IssueChallengeContext = {},
): Promise<RequireFreshMfaResult> {
  if (isDemoMode()) return { ok: true };

  const recent = await hasRecentSuccessfulMfa(user.id, actionTag);
  if (recent) return { ok: true };

  const { challengeId, expiresAt } = await issueChallenge(
    user.id,
    user.email,
    user.name ?? null,
    actionTag,
    context,
  );

  // 202 Accepted. The action did not run; the client should prompt for a
  // code and retry the original request once MFA is verified.
  return {
    ok: false,
    response: NextResponse.json(
      {
        requiresMfa: true,
        actionTag,
        challengeId,
        expiresAt: expiresAt.toISOString(),
        // maskedEmail helps the client say "we sent a code to a****@…" without
        // re-fetching the user record client-side.
        maskedEmail: maskEmail(user.email),
      },
      { status: 202 },
    ),
  };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}…@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local.slice(-1)}@${domain}`;
}
