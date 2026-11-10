// -----------------------------------------------------------------------------
// @file: lib/email-templates/account.ts
// @purpose: Account and security emails on the shared frame: admin security
//           codes, team invites, password resets, email-change confirmation.
//           These used to be hand-written HTML strings that interpolated
//           names unescaped; the frame escapes every value.
// -----------------------------------------------------------------------------

import { renderSimpleEmail } from "./simple";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://brandbite.studio").replace(/\/$/, "");
}

function hi(name: string | null | undefined): string {
  return name ? `Hi ${name},` : "Hi,";
}

export async function renderSecurityCodeEmail(input: {
  name: string | null;
  code: string;
  minutesValid: number;
}): Promise<{ subject: string; html: string }> {
  const html = await renderSimpleEmail({
    role: "admin",
    previewText: `Your brandbite security code. It expires in ${input.minutesValid} minutes.`,
    reason:
      "You received this email because someone started a money action with your admin account.",
    title: "Your security code",
    intro: [
      hi(input.name),
      "Enter this code in the brandbite admin panel to confirm the money action you started:",
    ],
    code: input.code,
    note: {
      text: `It expires in ${input.minutesValid} minutes and works once.`,
    },
    footnote:
      "If you didn't just start a money action, someone has your password. Change it now and check the audit log.",
    secondary: { href: `${appUrl()}/admin/audit-log`, label: "Open the audit log" },
  });
  // The code stays in the subject so it shows in notifications (as before).
  return { subject: `[brandbite admin] Security code ${input.code}`, html };
}

export async function renderTeamInviteEmail(input: {
  inviterName: string;
  companyName: string;
  roleInCompany: string;
  inviteUrl: string;
}): Promise<{ subject: string; html: string }> {
  const role = input.roleInCompany === "PM" ? "project manager" : input.roleInCompany.toLowerCase();
  const html = await renderSimpleEmail({
    role: "customer",
    previewText: `${input.inviterName} invited you to join ${input.companyName} on brandbite.`,
    reason: `You received this email because ${input.inviterName} invited this address to brandbite.`,
    title: `Join ${input.companyName} on brandbite`,
    intro: [
      "Hi,",
      `${input.inviterName} invited you to join ${input.companyName} on brandbite as a ${role}.`,
    ],
    action: { href: input.inviteUrl, label: "Accept invite" },
    footnote: "If you weren't expecting this invitation, you can ignore this email.",
  });
  return { subject: `You've been invited to join ${input.companyName} on brandbite`, html };
}

export async function renderResetPasswordEmail(input: {
  name: string | null;
  url: string;
}): Promise<{ subject: string; html: string }> {
  const html = await renderSimpleEmail({
    role: null,
    previewText: "Choose a new password for your brandbite account.",
    reason: "You received this email because someone asked to reset the password for this address.",
    title: "Reset your password",
    intro: [
      hi(input.name),
      "We received a request to reset your password. Use the button below to choose a new one.",
    ],
    action: { href: input.url, label: "Reset password" },
    footnote:
      "This link expires in 1 hour. If you didn't ask for a reset, you can ignore this email.",
  });
  return { subject: "Reset your brandbite password", html };
}

export async function renderChangeEmailEmail(input: {
  name: string | null;
  currentEmail: string;
  newEmail: string;
  url: string;
}): Promise<{ subject: string; html: string }> {
  const html = await renderSimpleEmail({
    role: null,
    previewText: "Confirm the new email address for your brandbite account.",
    reason:
      "You received this email because someone asked to move a brandbite account to this address.",
    title: "Confirm your new email",
    intro: [
      hi(input.name),
      `We received a request to change your brandbite account email from ${input.currentEmail} to ${input.newEmail}.`,
    ],
    action: { href: input.url, label: "Confirm new email" },
    footnote:
      "This link expires in 1 hour. If you didn't ask for this, ignore this email; your account email only changes if the link is used.",
  });
  return { subject: "Confirm your new brandbite email", html };
}
