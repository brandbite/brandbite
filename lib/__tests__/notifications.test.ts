// -----------------------------------------------------------------------------
// @file: lib/__tests__/notifications.test.ts
// @purpose: Unit tests for notification helpers (with Prisma + email mocked)
// -----------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures these run before vi.mock hoisting
// ---------------------------------------------------------------------------

const { mockPrisma, mockSendEmail, mockBuildHtml, mockGetSubject } = vi.hoisted(() => ({
  mockPrisma: {
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notif-1" }),
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    notificationPreference: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
    userAccount: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
  mockSendEmail: vi.fn().mockResolvedValue(undefined),
  mockBuildHtml: vi.fn().mockReturnValue("<html>test</html>"),
  mockGetSubject: vi.fn().mockReturnValue("Test Subject"),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/email", () => ({
  sendNotificationEmail: mockSendEmail,
}));

vi.mock("@/lib/email-templates", () => ({
  buildNotificationEmailHtml: mockBuildHtml,
  getSubjectForType: mockGetSubject,
}));

// Import after mocks are set up
import {
  createNotification,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getUserPreferences,
  setUserPreference,
} from "@/lib/notifications";

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createNotification
// ---------------------------------------------------------------------------

describe("createNotification", () => {
  const baseInput = {
    userId: "user-1",
    type: "TICKET_ASSIGNED" as const,
    title: "New ticket",
    message: "You have been assigned a ticket",
    ticketId: "ticket-1",
    actorId: "actor-1",
  };

  it("creates in-app notification and sends email when no preference exists (defaults to enabled)", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce(null);
    mockPrisma.userAccount.findUnique
      .mockResolvedValueOnce({ email: "user@test.com", name: "Test User", role: "DESIGNER" })
      .mockResolvedValueOnce({ name: "Actor Name" });

    await createNotification(baseInput);

    expect(mockPrisma.notification.create).toHaveBeenCalledOnce();
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        type: "TICKET_ASSIGNED",
        title: "New ticket",
      }),
    });
  });

  it("skips in-app notification when enabled=false but still sends email", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce({
      enabled: false,
      emailEnabled: true,
    });
    mockPrisma.userAccount.findUnique
      .mockResolvedValueOnce({ email: "user@test.com", name: "Test User", role: "CUSTOMER" })
      .mockResolvedValueOnce({ name: "Actor Name" });

    await createNotification(baseInput);

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    // Email should still be attempted (fire-and-forget)
  });

  it("skips everything when both channels are disabled", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce({
      enabled: false,
      emailEnabled: false,
    });

    await createNotification(baseInput);

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it("swallows errors gracefully (fire-and-forget)", async () => {
    mockPrisma.notificationPreference.findUnique.mockRejectedValueOnce(
      new Error("DB error"),
    );

    // Should not throw
    await expect(createNotification(baseInput)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getUnreadCount
// ---------------------------------------------------------------------------

describe("getUnreadCount", () => {
  it("returns count of unread notifications", async () => {
    mockPrisma.notification.count.mockResolvedValueOnce(5);

    const count = await getUnreadCount("user-1");

    expect(count).toBe(5);
    expect(mockPrisma.notification.count).toHaveBeenCalledWith({
      where: { userId: "user-1", read: false },
    });
  });
});

// ---------------------------------------------------------------------------
// markAsRead / markAllAsRead
// ---------------------------------------------------------------------------

describe("markAsRead", () => {
  it("returns true when notification was updated", async () => {
    mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await markAsRead("notif-1", "user-1");

    expect(result).toBe(true);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "notif-1", userId: "user-1" },
      data: { read: true, readAt: expect.any(Date) },
    });
  });

  it("returns false when notification was not found", async () => {
    mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await markAsRead("notif-999", "user-1");

    expect(result).toBe(false);
  });
});

describe("markAllAsRead", () => {
  it("returns number of updated notifications", async () => {
    mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 3 });

    const count = await markAllAsRead("user-1");

    expect(count).toBe(3);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", read: false },
      data: { read: true, readAt: expect.any(Date) },
    });
  });
});

// ---------------------------------------------------------------------------
// getUserPreferences
// ---------------------------------------------------------------------------

describe("getUserPreferences", () => {
  it("returns defaults (both enabled) for types without explicit preferences", async () => {
    mockPrisma.notificationPreference.findMany.mockResolvedValueOnce([]);

    const prefs = await getUserPreferences("user-1");

    expect(prefs).toHaveLength(6); // All 6 notification types
    prefs.forEach((p) => {
      expect(p.enabled).toBe(true);
      expect(p.emailEnabled).toBe(true);
    });
  });

  it("respects explicit preference rows", async () => {
    mockPrisma.notificationPreference.findMany.mockResolvedValueOnce([
      { type: "TICKET_ASSIGNED", enabled: false, emailEnabled: true },
      { type: "PIN_RESOLVED", enabled: true, emailEnabled: false },
    ]);

    const prefs = await getUserPreferences("user-1");

    const assigned = prefs.find((p) => p.type === "TICKET_ASSIGNED");
    expect(assigned?.enabled).toBe(false);
    expect(assigned?.emailEnabled).toBe(true);

    const pinResolved = prefs.find((p) => p.type === "PIN_RESOLVED");
    expect(pinResolved?.enabled).toBe(true);
    expect(pinResolved?.emailEnabled).toBe(false);

    // Remaining types should still default to true
    const others = prefs.filter(
      (p) => p.type !== "TICKET_ASSIGNED" && p.type !== "PIN_RESOLVED",
    );
    others.forEach((p) => {
      expect(p.enabled).toBe(true);
      expect(p.emailEnabled).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// setUserPreference
// ---------------------------------------------------------------------------

describe("setUserPreference", () => {
  it("upserts preference with enabled field", async () => {
    await setUserPreference("user-1", "TICKET_ASSIGNED", { enabled: false });

    expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId_type: { userId: "user-1", type: "TICKET_ASSIGNED" } },
      create: expect.objectContaining({ userId: "user-1", type: "TICKET_ASSIGNED", enabled: false }),
      update: { enabled: false },
    });
  });

  it("upserts preference with emailEnabled field", async () => {
    await setUserPreference("user-1", "PIN_RESOLVED", { emailEnabled: true });

    expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId_type: { userId: "user-1", type: "PIN_RESOLVED" } },
      create: expect.objectContaining({ emailEnabled: true }),
      update: { emailEnabled: true },
    });
  });

  it("upserts preference with both fields", async () => {
    await setUserPreference("user-1", "TICKET_COMPLETED", {
      enabled: false,
      emailEnabled: false,
    });

    expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId_type: { userId: "user-1", type: "TICKET_COMPLETED" } },
      create: expect.objectContaining({ enabled: false, emailEnabled: false }),
      update: { enabled: false, emailEnabled: false },
    });
  });
});
