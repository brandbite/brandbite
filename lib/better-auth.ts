// -----------------------------------------------------------------------------
// @file: lib/better-auth.ts
// @purpose: BetterAuth server configuration — Prisma adapter, email+password,
//           magic link via Resend. Only loaded when DEMO_MODE !== "true".
// @version: v1.1.0
// @status: active
// @lastUpdate: 2026-04-23
// -----------------------------------------------------------------------------

import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/email";
import { renderVerifyEmail } from "@/lib/email-templates/auth/verify-email";
import { validatePasswordStrength } from "@/lib/password-policy";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Hosts where we emit `Secure` cookies. Anything non-production (localhost
// dev, http:// previews) sets `secure: false` so the session cookie still
// attaches in plain HTTP — production deploys are always HTTPS via Vercel.
const isProd = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  baseURL: baseUrl,
  secret: process.env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // Email verification — users who sign up with email+password must click
  // a verification link before they can sign in. Template lives in
  // lib/email-templates/auth/verify-email.tsx so the HTML stays brand-
  // consistent with other transactional emails.
  //
  // Each email-sender hook below is wrapped in its own try/catch. The
  // sign-up flow on demo was failing with empty 500s because a render
  // or send error was bubbling up to BetterAuth's pipeline in a way the
  // library didn't surface as a structured error. With the wrapper, the
  // hooks NEVER throw — auth always completes, email is best-effort.
  // Failures are logged for ops; the user is told to "check email" and
  // can request a resend if it didn't actually go out.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        const { subject, html } = await renderVerifyEmail({
          name: user.name,
          url,
        });
        await sendNotificationEmail(user.email, subject, html);
      } catch (err) {
        console.error("[better-auth] sendVerificationEmail failed", err);
      }
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // Bump min length from the BetterAuth default of 8. Complexity rules
    // (uppercase, digit, symbol) enforced in the before-hook below, which
    // runs for both sign-up and reset-password.
    minPasswordLength: 12,
    // On successful password reset, revoke every existing session for
    // the user so an attacker holding a compromised password can't keep
    // their stolen session alive for up to 7 days.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendNotificationEmail(
          user.email,
          "Reset your Brandbite password",
          [
            "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto;\">",
            '<div style="background: #f15b2b; padding: 20px 24px; border-radius: 12px 12px 0 0;">',
            '<span style="font-size: 20px; font-weight: 700; color: #fff;">brandbite</span>',
            "</div>",
            '<div style="background: #fff; padding: 28px 24px; border: 1px solid #e3e1dc; border-top: none;">',
            `<p style="margin: 0 0 16px; font-size: 14px; color: #424143;">Hi${user.name ? ` ${user.name}` : ""},</p>`,
            '<p style="margin: 0 0 16px; font-size: 14px; color: #424143;">We received a request to reset your password. Click the button below to choose a new one:</p>',
            '<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">',
            "<tr>",
            '<td style="border-radius: 8px; background: #f15b2b;">',
            `<a href="${url}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 600; color: #fff; text-decoration: none; border-radius: 8px;">Reset Password</a>`,
            "</td>",
            "</tr>",
            "</table>",
            '<p style="margin: 0; font-size: 13px; color: #7a7a7a;">This link expires in 1 hour. If you didn\'t request a password reset, you can safely ignore this email.</p>',
            "</div>",
            '<div style="background: #faf9f7; padding: 16px 24px; border-radius: 0 0 12px 12px; border: 1px solid #e3e1dc; border-top: none;">',
            '<p style="margin: 0; font-size: 11px; color: #9a9892; text-align: center;">Brandbite &mdash; Creative-as-a-service platform</p>',
            "</div>",
            "</div>",
          ].join("\n"),
        );
      } catch (err) {
        console.error("[better-auth] sendResetPassword failed", err);
      }
    },
  },

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        try {
          await sendNotificationEmail(
            email,
            "Sign in to Brandbite",
            [
              '<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">',
              '<h2 style="color: #111;">Sign in to Brandbite</h2>',
              "<p>Click the button below to sign in to your account:</p>",
              '<p style="text-align: center; margin: 32px 0;">',
              `<a href="${url}" style="display: inline-block; padding: 12px 32px; background: #111; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">`,
              "Sign in",
              "</a>",
              "</p>",
              '<p style="color: #666; font-size: 13px;">This link expires in 5 minutes. If you didn\'t request this, you can safely ignore this email.</p>',
              "</div>",
            ].join("\n"),
          );
        } catch (err) {
          console.error("[better-auth] sendMagicLink failed", err);
        }
      },
    }),
    nextCookies(), // must be last plugin
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },

  // --------------------------------------------------------------------
  // Error surfacing
  //
  // BetterAuth's default onError silently swallows any error whose
  // message contains "column" / "relation" / "table" / "does not exist"
  // (its naive Postgres-schema-mismatch detector at
  // node_modules/better-auth/dist/api/index.mjs:185-190). When that
  // happens the framework returns an empty 500 — which is what surfaced
  // on the demo /login as "Sign up failed." with no detail and a 0-byte
  // body that no amount of route-level catch wrapping could see.
  //
  // `onAPIError.throw: true` makes BetterAuth throw the underlying error
  // instead of swallowing it. Our catch-all in app/api/auth/[...all]/
  // route.ts then catches the real exception, logs the message + stack,
  // and returns a structured JSON 500 the /login UI can surface. Schema
  // mismatches turn into "ERROR: column ... does not exist" — the
  // operator sees what's wrong and can run the missing migration.
  // --------------------------------------------------------------------
  onAPIError: {
    throw: true,
  },

  // --------------------------------------------------------------------
  // Rate limiting — BetterAuth's built-in limiter.
  //
  // BetterAuth ships a DB-backed limiter with a default special rule
  // for auth paths of 3 requests / 10 seconds. That threshold fires
  // WAY before our custom per-IP (10/60s) + per-email (5/15min) gate
  // in `app/api/auth/[...all]/route.ts`, which means users see
  // BetterAuth's generic "Too many requests. Please try again later."
  // instead of our more actionable messages like
  // "Too many attempts for this email. Wait 15 minutes and try again.
  // If you didn't request this, you can ignore it."
  //
  // We keep BetterAuth's limiter enabled as defense-in-depth — if our
  // Upstash-backed gate ever has a bug or misses a new endpoint, this
  // is a backstop. But we loosen every auth path so our gate trips
  // first under normal conditions.
  // --------------------------------------------------------------------
  rateLimit: {
    enabled: true,
    // Global default — deliberately loose. Our gate handles real limits.
    window: 60,
    max: 120,
    // Override the library's aggressive 3/10s special-rule defaults for
    // every auth path our gate already covers. Our gate trips at 10/60s
    // (per-IP) or 5/15min (per-email); 50/60s here means BetterAuth's
    // backstop only matters in extreme bursts where our Upstash layer
    // has somehow failed open.
    customRules: {
      "/sign-in/email": { window: 60, max: 50 },
      "/sign-in/magic-link": { window: 60, max: 50 },
      "/sign-up/email": { window: 60, max: 50 },
      "/forget-password": { window: 60, max: 50 },
      "/reset-password": { window: 60, max: 50 },
      "/change-password": { window: 60, max: 50 },
      "/change-email": { window: 60, max: 50 },
      "/send-verification-email": { window: 60, max: 50 },
    },
  },

  // Explicit cookie attributes. BetterAuth defaults are already sensible
  // (httpOnly + secure + sameSite=lax) but making them explicit means a
  // future library-default flip can't silently weaken them.
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
    },
  },

  // Intercept sign-up / reset-password / change-password / set-password to
  // enforce the password policy (length + uppercase + digit + symbol).
  // BetterAuth handles minPasswordLength itself, but complexity rules are
  // not built-in — this before-hook is the idiomatic extension point.
  // Throwing APIError short-circuits the endpoint with a structured 400.
  hooks: {
    before: async (ctx) => {
      // BetterAuth's runtime attaches endpoint `path` to the hook
      // context (see node_modules/better-auth/dist/api/to-auth-endpoints),
      // but the exported middleware type doesn't surface it. Cast to
      // read it safely at runtime.
      const hookCtx = ctx as unknown as {
        path?: string;
        body?: { password?: unknown; newPassword?: unknown };
      };
      const path = hookCtx.path ?? "";
      const isPasswordPath =
        path === "/sign-up/email" ||
        path === "/reset-password" ||
        path === "/change-password" ||
        path === "/set-password";
      if (!isPasswordPath) return;

      const body = hookCtx.body ?? {};
      const candidate =
        typeof body.newPassword === "string"
          ? body.newPassword
          : typeof body.password === "string"
            ? body.password
            : null;
      if (!candidate) return; // let BetterAuth surface its own "missing" error

      const check = validatePasswordStrength(candidate);
      if (!check.ok) {
        throw new APIError("BAD_REQUEST", { message: check.error });
      }
    },
  },
});
