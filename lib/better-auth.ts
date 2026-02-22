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

const baseUrl =
  process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const auth = betterAuth({
  baseURL: baseUrl,
  secret: process.env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
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
