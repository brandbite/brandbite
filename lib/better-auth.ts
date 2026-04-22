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
  // a verification link before they can sign in. Reuses the same Resend
  // helper as password reset.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendNotificationEmail(
        user.email,
        "Verify your Brandbite email",
        [
          "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto;\">",
          '<div style="background: #f15b2b; padding: 20px 24px; border-radius: 12px 12px 0 0;">',
          '<span style="font-size: 20px; font-weight: 700; color: #fff;">brandbite</span>',
          "</div>",
          '<div style="background: #fff; padding: 28px 24px; border: 1px solid #e3e1dc; border-top: none;">',
          `<p style="margin: 0 0 16px; font-size: 14px; color: #424143;">Welcome${user.name ? ` ${user.name}` : ""},</p>`,
          '<p style="margin: 0 0 16px; font-size: 14px; color: #424143;">Confirm your email address to finish setting up your Brandbite account:</p>',
          '<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">',
          "<tr>",
          '<td style="border-radius: 8px; background: #f15b2b;">',
          `<a href="${url}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 600; color: #fff; text-decoration: none; border-radius: 8px;">Verify email</a>`,
          "</td>",
          "</tr>",
          "</table>",
          '<p style="margin: 0; font-size: 13px; color: #7a7a7a;">This link expires in 24 hours. If you didn\'t create this account, you can safely ignore this email.</p>',
          "</div>",
          '<div style="background: #faf9f7; padding: 16px 24px; border-radius: 0 0 12px 12px; border: 1px solid #e3e1dc; border-top: none;">',
          '<p style="margin: 0; font-size: 11px; color: #9a9892; text-align: center;">Brandbite &mdash; Creative-as-a-service platform</p>',
          "</div>",
          "</div>",
        ].join("\n"),
      );
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
    },
  },

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
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
      },
    }),
    nextCookies(), // must be last plugin
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
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
