import { describe, expect, it, vi } from "vitest";

// admin-action-email reaches Prisma; never start a real client in unit tests.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { buildBlockedEmail, buildEmail } from "@/lib/admin-action-email";
import { renderAdminEventEmail } from "@/lib/admin-event-email";
import { buildNotificationEmailHtml, getSubjectForType } from "@/lib/email-templates";
import {
  renderResetPasswordEmail,
  renderSecurityCodeEmail,
  renderTeamInviteEmail,
} from "@/lib/email-templates/account";
import { renderTalentDeclineEmail } from "@/lib/email-templates/talent/decline";
import { ROLE_COLORS } from "@/lib/role-colors";

const ticket = {
  code: "WEB-101",
  title: "Logo redesign",
  companyName: "Acme Studio",
  serviceName: "Logo",
  dueDate: new Date(Date.UTC(2026, 10, 19)),
  tokens: 18,
};

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ");

describe("role colours", () => {
  it("are the pairs decided on 2026-11-10", () => {
    expect(ROLE_COLORS).toEqual({
      admin: { label: "Admin", bg: "#FFE9DF", text: "#8F310D" },
      creative: { label: "Creative Workspace", bg: "#EEE9FF", text: "#49368D" },
      customer: { label: "Customer Workspace", bg: "#E7F3EA", text: "#24543A" },
    });
  });
});

describe("notification emails", () => {
  it("show the creative's badge, the request card with payout, and both links", async () => {
    const html = await buildNotificationEmailHtml({
      recipientName: "Ada",
      type: "TICKET_ASSIGNED",
      title: "Logo redesign",
      message: "A new request was assigned to you.",
      ticketId: "t1",
      actorName: null,
      recipientRole: "creative",
      ticket,
    });
    expect(html).toContain(ROLE_COLORS.creative.bg);
    const t = text(html);
    expect(t).toContain("Creative Workspace");
    expect(t).toContain("New request assigned");
    expect(t).toContain("WEB-101 Logo redesign");
    expect(t).toMatch(/Company Acme Studio .*Service Logo .*Due Nov 19, 2026 .*Payout 18 tokens/);
    expect(html).toContain("/creative/tickets/t1");
    expect(html).toContain("/creative/board");
    expect(t).toContain("You received this email because a request was assigned to you.");
  });

  it("call the customer's amount Tokens and leave out their own company", async () => {
    const t = text(
      await buildNotificationEmailHtml({
        recipientName: "Sam",
        type: "REVISION_SUBMITTED",
        title: "Logo redesign",
        message: "Ada delivered revision 2.",
        ticketId: "t1",
        actorName: null,
        recipientRole: "customer",
        ticket: { ...ticket, tokens: 30 },
      }),
    );
    expect(t).toContain("Customer Workspace");
    expect(t).toContain("Tokens 30 tokens");
    expect(t).not.toContain("Company Acme Studio");
    expect(t).not.toContain("Payout");
  });

  it("list the files about to be deleted and offer both storage providers", async () => {
    const t = text(
      await buildNotificationEmailHtml({
        recipientName: "Sam",
        type: "SOURCE_FILES_EXPIRING",
        title: "Source files deleted in 14 days",
        message: "",
        ticketId: "t1",
        actorName: null,
        recipientRole: "customer",
        ticket,
        sourceFiles: {
          deleteAfter: new Date(Date.UTC(2027, 1, 8)),
          files: [
            { name: "Logo-master.ai", sizeBytes: 46 * 1024 * 1024 },
            { name: "Poster-print.psd", sizeBytes: 2 * 1024 ** 3 },
          ],
        },
      }),
    );
    expect(t).toContain("2 source files on WEB-101 will be deleted from brandbite on Feb 8, 2027.");
    expect(t).toContain("Logo-master.ai 46 MB");
    expect(t).toContain("Poster-print.psd 2.0 GB");
    expect(t).toContain("Connect Google Drive or Dropbox");
  });

  it("prefix admin subjects only", () => {
    expect(getSubjectForType("SUPPORT_GUIDE_CHANGED", "Board", "admin")).toBe(
      "[brandbite admin] A Support guide you edited changed in code: Board",
    );
    expect(getSubjectForType("TICKET_ASSIGNED", "Logo", "creative")).toBe(
      "New request assigned to you: Logo",
    );
  });
});

describe("admin emails", () => {
  const entry = {
    actorEmail: "owner@brandbite.studio",
    actorRole: "SITE_OWNER" as const,
    outcome: "SUCCESS" as const,
    targetType: "Company",
    targetId: "cmp_1",
    ipAddress: "203.0.113.24",
    errorMessage: null,
    createdAt: new Date(Date.UTC(2026, 10, 10, 13, 31)),
  };

  it("show a token grant as a balance change with the note", async () => {
    const { subject, html } = await buildEmail(
      {
        ...entry,
        action: "COMPANY_TOKEN_GRANT",
        metadata: {
          direction: "CREDIT",
          amount: 80,
          notes: "For tests.",
          balanceBefore: 0,
          balanceAfter: 80,
        },
      },
      "https://brandbite.test",
    );
    expect(subject).toBe("[brandbite admin] An admin adjusted a company's token balance");
    expect(html).toContain(ROLE_COLORS.admin.bg);
    const t = text(html);
    expect(t).toContain("Company token balance adjusted");
    expect(t).toContain("+80 tokens");
    expect(t).toContain("Previous balance 0 tokens");
    expect(t).toContain("New balance 80 tokens");
    expect(t).toContain("For tests.");
    expect(t).toContain("IP address 203.0.113.24");
  });

  it("warn that a blocked attempt did not happen", async () => {
    const { subject, html } = await buildBlockedEmail(
      {
        ...entry,
        actorRole: "SITE_ADMIN",
        outcome: "BLOCKED",
        action: "WITHDRAWAL_APPROVE",
        metadata: null,
      },
      "https://brandbite.test",
    );
    expect(subject).toBe("[brandbite admin] Blocked attempt: approved a withdrawal");
    expect(text(html)).toContain("It was blocked and did not happen.");
  });

  it("render owner event emails on the frame", async () => {
    const { subject, html } = await renderAdminEventEmail({
      kind: "NEW_TICKET",
      ticketId: "t1",
      ticketCode: "WEB-101",
      title: "Logo redesign",
      companyName: "Acme Studio",
      createdByEmail: "sam@acme.test",
      jobTypeName: "Logo",
    });
    expect(subject).toBe("[brandbite admin] New request: Logo redesign");
    expect(text(html)).toContain("Admin");
    expect(text(html)).toContain("WEB-101 Logo redesign");
  });
});

describe("account emails", () => {
  it("escape names that used to be pasted into the HTML", async () => {
    const { html } = await renderTeamInviteEmail({
      inviterName: '<img src=x onerror="alert(1)">',
      companyName: "Acme <b>Studio</b>",
      roleInCompany: "PM",
      inviteUrl: "https://brandbite.test/invite/x",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>Studio</b>");
    expect(html).toContain("&lt;b&gt;Studio&lt;/b&gt;");
    expect(text(html)).toContain("as a project manager");
  });

  it("keep the security code in the subject and show it large", async () => {
    const { subject, html } = await renderSecurityCodeEmail({
      name: "Alper",
      code: "482913",
      minutesValid: 10,
    });
    expect(subject).toBe("[brandbite admin] Security code 482913");
    expect(text(html)).toContain("482913");
    expect(text(html)).toContain("It expires in 10 minutes and works once.");
  });

  it("leave out the role badge for people without a workspace", async () => {
    const reset = await renderResetPasswordEmail({ name: null, url: "https://brandbite.test/r" });
    const decline = await renderTalentDeclineEmail({
      candidateName: "Ada",
      showcaseUrl: "https://x",
    });
    for (const { html } of [reset, decline]) {
      for (const role of Object.values(ROLE_COLORS)) expect(html).not.toContain(role.bg);
    }
  });
});
