// -----------------------------------------------------------------------------
// Render every brandbite email with sample data to HTML files, plus an
// index.html that shows them side by side, for a visual check.
//
// Usage:
//   JITI_JSX=1 NEXT_PUBLIC_APP_URL=http://localhost:3000 \
//     npx jiti scripts/render-email-previews.mts <out-dir>
// -----------------------------------------------------------------------------

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import type { NotificationType } from "@prisma/client";
import { render } from "@react-email/render";

import { buildBlockedEmail, buildEmail } from "../lib/admin-action-email";
import { renderAdminEventEmail } from "../lib/admin-event-email";
import { buildNotificationEmailHtml, getSubjectForType } from "../lib/email-templates";
import {
  renderChangeEmailEmail,
  renderResetPasswordEmail,
  renderSecurityCodeEmail,
  renderTeamInviteEmail,
} from "../lib/email-templates/account";
import { renderVerifyEmail } from "../lib/email-templates/auth/verify-email";
import { renderConsultationUpdateEmail } from "../lib/email-templates/consultation/update";
import { renderMeetingEmail } from "../lib/email-templates/meeting/update";
import { renderWelcomeEmail } from "../lib/email-templates/onboarding/welcome";
import {
  AdminSample,
  CreativeSample,
  CustomerSample,
} from "../lib/email-templates/previews/design-samples";
import { renderTalentAcceptEmail } from "../lib/email-templates/talent/accept";
import { renderTalentBookingFailureNotificationEmail } from "../lib/email-templates/talent/booking-failure-notification";
import { renderTalentDeclineEmail } from "../lib/email-templates/talent/decline";
import { renderTalentDeclinePostInterviewEmail } from "../lib/email-templates/talent/decline-post-interview";
import { renderTalentFinalConfirmationEmail } from "../lib/email-templates/talent/final-confirmation";
import { renderTalentOnboardedEmail } from "../lib/email-templates/talent/onboarded";
import { renderTalentProposedTimeNotificationEmail } from "../lib/email-templates/talent/proposed-time-notification";

const out = process.argv[2] ?? "email-previews";
mkdirSync(out, { recursive: true });
const APP = process.env.NEXT_PUBLIC_APP_URL || "https://brandbite.studio";
const SOON = new Date(Date.UTC(2026, 10, 19, 14, 0)).toISOString();

const ticket = {
  code: "WEB-101",
  title: "Logo redesign",
  companyName: "Acme Studio",
  serviceName: "Logo",
  dueDate: new Date(Date.UTC(2026, 10, 19)),
  tokens: 18,
};

type Item = { name: string; subject: string; html: string };
const items: Item[] = [];
const add = (name: string, email: { subject: string; html: string }) =>
  items.push({ name, ...email });

add("design-creative", {
  subject: "(design sample)",
  html: await render(React.createElement(CreativeSample)),
});
add("design-customer", {
  subject: "(design sample)",
  html: await render(React.createElement(CustomerSample)),
});
add("design-admin", {
  subject: "(design sample)",
  html: await render(React.createElement(AdminSample)),
});

const notifications: [NotificationType, "customer" | "creative" | "admin", string, string][] = [
  ["TICKET_ASSIGNED", "creative", "Logo redesign", "A new request was assigned to you."],
  ["REVISION_SUBMITTED", "customer", "Logo redesign", "Ada delivered revision 2 on WEB-101."],
  ["FEEDBACK_SUBMITTED", "creative", "Logo redesign", "The customer asked for changes on WEB-101."],
  [
    "TICKET_COMPLETED",
    "creative",
    "Logo redesign",
    "WEB-101 was marked done. Your payout is on its way.",
  ],
  ["TICKET_STATUS_CHANGED", "customer", "Logo redesign", "WEB-101 moved to In review."],
  ["PIN_RESOLVED", "customer", "Logo redesign", "Ada resolved your note on revision 2."],
  [
    "WITHDRAWAL_UPDATED",
    "creative",
    "Withdrawal approved",
    "Your withdrawal of 120 tokens was approved.",
  ],
  [
    "CREATIVE_SCHEDULE_UPDATED",
    "admin",
    "Ada changed working hours",
    "Ada now works Mon–Thu, 09:00–17:00.",
  ],
  ["MOODBOARD_SHARED", "customer", "Spring campaign", "Ada shared a moodboard with you."],
  ["MOODBOARD_COMMENT", "creative", "Spring campaign", "Sam commented: Love the second palette."],
  [
    "SUPPORT_GUIDE_CHANGED",
    "admin",
    "Board guide",
    "The Board guide changed in code since you edited it.",
  ],
  ["SOURCE_FILES_EXPIRING", "customer", "Source files deleted in 14 days", ""],
];
for (const [type, role, title, message] of notifications) {
  const isTicket = ![
    "WITHDRAWAL_UPDATED",
    "CREATIVE_SCHEDULE_UPDATED",
    "MOODBOARD_SHARED",
    "MOODBOARD_COMMENT",
    "SUPPORT_GUIDE_CHANGED",
  ].includes(type);
  add(`notification-${type.toLowerCase()}`, {
    subject: getSubjectForType(type, title, role),
    html: await buildNotificationEmailHtml({
      recipientName: role === "creative" ? "Ada" : role === "admin" ? "Alper" : "Sam",
      type,
      title,
      message,
      ticketId: isTicket ? "t1" : null,
      moodboardId: type.startsWith("MOODBOARD") ? "m1" : null,
      actorName: null,
      recipientRole: role,
      ticket: isTicket ? { ...ticket, tokens: role === "creative" ? 18 : 30 } : null,
      sourceFiles:
        type === "SOURCE_FILES_EXPIRING"
          ? {
              deleteAfter: new Date(Date.UTC(2027, 1, 8)),
              files: [
                { name: "Logo-master.ai", sizeBytes: 46 * 1024 * 1024 },
                { name: "Poster-print.psd", sizeBytes: 2.0 * 1024 ** 3 },
              ],
            }
          : null,
    }),
  });
}

const logEntry = {
  actorEmail: "owner@brandbite.studio",
  actorRole: "SITE_OWNER" as const,
  outcome: "SUCCESS" as const,
  targetType: "Company",
  targetId: "cmp_123",
  ipAddress: "203.0.113.24",
  errorMessage: null,
  createdAt: new Date(Date.UTC(2026, 10, 10, 13, 31)),
};
add(
  "admin-token-grant",
  await buildEmail(
    {
      ...logEntry,
      action: "COMPANY_TOKEN_GRANT",
      metadata: {
        direction: "CREDIT",
        amount: 80,
        notes: "For Google Drive and other feature tests.",
        balanceBefore: 0,
        balanceAfter: 80,
      },
    },
    APP,
  ),
);
add(
  "admin-plan-edit",
  await buildEmail(
    {
      ...logEntry,
      action: "PLAN_EDIT",
      targetType: "Plan",
      targetId: "plan_full",
      metadata: { planName: "Full", monthlyTokens: 300 },
    },
    APP,
  ),
);
add(
  "admin-blocked",
  await buildBlockedEmail(
    {
      ...logEntry,
      actorEmail: "admin@brandbite.studio",
      actorRole: "SITE_ADMIN",
      outcome: "BLOCKED",
      action: "WITHDRAWAL_APPROVE",
      metadata: null,
      errorMessage: "Owner-only action",
    },
    APP,
  ),
);

add(
  "admin-event-new-ticket",
  await renderAdminEventEmail({
    kind: "NEW_TICKET",
    ticketId: "t1",
    ticketCode: "WEB-101",
    title: "Logo redesign",
    companyName: "Acme Studio",
    createdByEmail: "sam@acme.test",
    jobTypeName: "Logo",
  }),
);
add(
  "admin-event-feedback",
  await renderAdminEventEmail({
    kind: "NEW_FEEDBACK",
    feedbackId: "f1",
    type: "BUG",
    submitterEmail: "sam@acme.test",
    submitterRole: "CUSTOMER",
    subject: "Board doesn't scroll",
    message: "On my phone the board won't scroll sideways.",
    pageUrl: "/customer/board",
  }),
);
add(
  "admin-event-contact",
  await renderAdminEventEmail({
    kind: "NEW_CONTACT_MESSAGE",
    contactMessageId: "c1",
    name: "Jo Doe",
    email: "jo@example.com",
    company: "Example Co",
    topic: "Pricing",
    message: "Hi, do you do packaging design?",
  }),
);
add(
  "admin-event-calendar",
  await renderAdminEventEmail({
    kind: "GOOGLE_CALENDAR_DISCONNECTED",
    googleAccountEmail: "hello@brandbite.studio",
    errorDetail: "invalid_grant",
    detectedBy: "health check",
  }),
);
add(
  "admin-event-withdrawal",
  await renderAdminEventEmail({
    kind: "NEW_WITHDRAWAL_REQUEST",
    withdrawalId: "w1",
    creativeEmail: "ada@brandbite.studio",
    amountTokens: 120,
  }),
);

add(
  "account-security-code",
  await renderSecurityCodeEmail({ name: "Alper", code: "482913", minutesValid: 10 }),
);
add(
  "account-invite",
  await renderTeamInviteEmail({
    inviterName: "Sam Lee",
    companyName: "Acme Studio",
    roleInCompany: "PM",
    inviteUrl: `${APP}/invite/x`,
  }),
);
add(
  "account-reset-password",
  await renderResetPasswordEmail({ name: "Sam", url: `${APP}/reset/x` }),
);
add(
  "account-change-email",
  await renderChangeEmailEmail({
    name: "Sam",
    currentEmail: "sam@acme.test",
    newEmail: "sam@acme.studio",
    url: `${APP}/x`,
  }),
);
add("auth-verify-email", await renderVerifyEmail({ name: "Sam", url: `${APP}/verify/x` }));
add(
  "onboarding-welcome",
  await renderWelcomeEmail({
    name: "Sam",
    planName: "Full",
    ctaUrl: `${APP}/customer`,
    showcaseUrl: `${APP}/showcase`,
    docsUrl: `${APP}/guides`,
  }),
);
add(
  "consultation-booked",
  await renderConsultationUpdateEmail({
    kind: "scheduled",
    recipientName: "Sam",
    scheduledAt: SOON,
    timeZone: "Europe/Istanbul",
    videoLink: "https://meet.google.com/abc",
    consultationsUrl: `${APP}/customer/consultations`,
  }),
);
add(
  "meeting-visitor",
  await renderMeetingEmail({
    kind: "confirmed",
    audience: "visitor",
    visitorName: "Jo",
    visitorEmail: "jo@example.com",
    startsAt: SOON,
    timeZone: "Europe/Berlin",
    videoLink: "https://meet.google.com/abc",
    manageUrl: `${APP}/meet/x`,
  }),
);
add(
  "meeting-host",
  await renderMeetingEmail({
    kind: "confirmed",
    audience: "host",
    visitorName: "Jo",
    visitorEmail: "jo@example.com",
    company: "Example Co",
    note: "Packaging for 3 products",
    startsAt: SOON,
    timeZone: "Europe/Berlin",
    videoLink: "https://meet.google.com/abc",
  }),
);
add(
  "talent-accept",
  await renderTalentAcceptEmail({
    candidateName: "Ada",
    proposedSlotsIso: [SOON],
    candidateTimezone: "Europe/London",
    bookingUrl: `${APP}/talent/schedule/x`,
  }),
);
add(
  "talent-decline",
  await renderTalentDeclineEmail({ candidateName: "Ada", showcaseUrl: `${APP}/showcase` }),
);
add(
  "talent-decline-post-interview",
  await renderTalentDeclinePostInterviewEmail({
    candidateName: "Ada",
    showcaseUrl: `${APP}/showcase`,
  }),
);
add(
  "talent-final-confirmation",
  await renderTalentFinalConfirmationEmail({
    candidateName: "Ada",
    interviewStartIso: SOON,
    candidateTimezone: "Europe/London",
    meetLink: "https://meet.google.com/abc",
  }),
);
add(
  "talent-onboarded",
  await renderTalentOnboardedEmail({
    candidateName: "Ada",
    workingHours: "Mon–Fri, 09:00–17:00",
    approvedCategoryNames: ["Logo", "Social"],
    tasksPerWeekCap: 5,
  }),
);
add(
  "talent-booking-failure",
  await renderTalentBookingFailureNotificationEmail({
    candidateName: "Ada",
    candidateEmail: "ada@example.com",
    slotIso: SOON,
    candidateTimezone: "Europe/London",
    stage: "GOOGLE_NOT_CONNECTED",
    settingsUrl: `${APP}/admin/consultations/settings`,
    adminUrl: `${APP}/admin/talent-applications`,
  }),
);
add(
  "talent-proposed-time",
  await renderTalentProposedTimeNotificationEmail({
    candidateName: "Ada",
    candidateEmail: "ada@example.com",
    proposedIso: SOON,
    candidateTimezone: "Europe/London",
    note: "Mornings work best.",
    adminUrl: `${APP}/admin/talent-applications`,
  }),
);

for (const item of items) writeFileSync(join(out, `${item.name}.html`), item.html);
writeFileSync(
  join(out, "index.json"),
  JSON.stringify(
    items.map(({ name, subject }) => ({ name, subject })),
    null,
    2,
  ),
);
console.log(`rendered ${items.length} emails to ${out}`);
// Prisma and the rate limiter keep handles open; nothing else to wait for.
process.exit(0);
