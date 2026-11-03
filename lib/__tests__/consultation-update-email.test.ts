// -----------------------------------------------------------------------------
// @file: lib/__tests__/consultation-update-email.test.ts
// @purpose: The consultation email shows the time in the customer's
//           timezone, the video link, and the refund on cancellation.
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  formatConsultationTime,
  renderConsultationUpdateEmail,
} from "../email-templates/consultation/update";

const base = { consultationsUrl: "https://brandbite.studio/customer/consultation" };

describe("formatConsultationTime", () => {
  it("renders in the customer's timezone", () => {
    // 10:00 UTC is 13:00 in Istanbul (UTC+3).
    expect(formatConsultationTime("2026-11-10T10:00:00.000Z", "Europe/Istanbul")).toMatch(/13:00/);
  });

  it("falls back to UTC for an unknown timezone", () => {
    expect(formatConsultationTime("2026-11-10T10:00:00.000Z", "Not/AZone")).toMatch(/10:00/);
  });
});

describe("renderConsultationUpdateEmail", () => {
  it("scheduled: subject, time and video link", async () => {
    const { subject, html } = await renderConsultationUpdateEmail({
      ...base,
      kind: "scheduled",
      recipientName: "Jane",
      scheduledAt: "2026-11-10T10:00:00.000Z",
      timeZone: "Europe/Istanbul",
      videoLink: "https://meet.google.com/abc-defg-hij",
    });
    expect(subject).toBe("Your Brandbite consultation is booked");
    expect(html).toContain("13:00");
    expect(html).toContain("https://meet.google.com/abc-defg-hij");
    expect(html).toContain("Hi Jane,");
  });

  it("rescheduled: its own subject", async () => {
    const { subject } = await renderConsultationUpdateEmail({
      ...base,
      kind: "rescheduled",
      scheduledAt: "2026-11-10T10:00:00.000Z",
      videoLink: "https://meet.google.com/x",
    });
    expect(subject).toBe("Your Brandbite consultation has a new time");
  });

  it("canceled: mentions the refund", async () => {
    const { subject, html } = await renderConsultationUpdateEmail({
      ...base,
      kind: "canceled",
      refundedTokens: 50,
    });
    expect(subject).toBe("Your Brandbite consultation was cancelled");
    // React separates "{n}" and the text after it with <!-- --> markers.
    expect(html.replace(/<!--.*?-->/g, "")).toContain("50 tokens have been returned");
  });
});
