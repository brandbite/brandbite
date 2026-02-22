// -----------------------------------------------------------------------------
// @file: lib/better-auth.ts
// @purpose: BetterAuth server configuration — Prisma adapter, email+password,
//           magic link via Resend. Only loaded when DEMO_MODE !== "true".
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-22
// -----------------------------------------------------------------------------

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/email";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const auth = betterAuth({
  baseURL: baseUrl,
  secret: process.env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
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
});
