// -----------------------------------------------------------------------------
// @file: lib/notifications.ts
// @purpose: Helper functions for creating, querying, and managing in-app
//           notifications with user preference support + email notifications
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { NotificationType, UserRole } from "@prisma/client";
import { sendNotificationEmail } from "@/lib/email";
import {
  buildNotificationEmailHtml,
  getSubjectForType,
} from "@/lib/email-templates";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_TYPES: NotificationType[] = [
  "REVISION_SUBMITTED",
  "FEEDBACK_SUBMITTED",
  "TICKET_COMPLETED",
  "TICKET_ASSIGNED",
  "TICKET_STATUS_CHANGED",
  "PIN_RESOLVED",
];

// ---------------------------------------------------------------------------
// Create notification (respects user preferences — in-app + email)
// ---------------------------------------------------------------------------

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  ticketId?: string;
  actorId?: string;
};

/**
 * Creates an in-app notification for a user and sends an email notification,
 * respecting per-channel preferences. If no preference row exists for this
 * type, both channels default to enabled.
 * Fire-and-forget — errors are swallowed to avoid breaking the main flow.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    // Check user preference (both channels)
    const pref = await prisma.notificationPreference.findUnique({
      where: {
        userId_type: { userId: input.userId, type: input.type },
      },
      select: { enabled: true, emailEnabled: true },
    });

    const inAppEnabled = pref ? pref.enabled : true;
    const emailEnabled = pref ? pref.emailEnabled : true;

    // Nothing to do if both channels are off
    if (!inAppEnabled && !emailEnabled) return;

    // Create in-app notification if enabled
    if (inAppEnabled) {
      await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          ticketId: input.ticketId ?? null,
          actorId: input.actorId ?? null,
        },
      });
    }

    // Send email notification if enabled (async, fire-and-forget)
    if (emailEnabled) {
      sendEmailForNotification(input).catch((err) =>
        console.error("[notifications] email send failed", err),
      );
    }
  } catch (err) {
    console.error("[notifications] failed to create notification", err);
  }
}

// ---------------------------------------------------------------------------
// Email sending helper (private)
// ---------------------------------------------------------------------------

function roleToRecipientRole(
  role: UserRole,
): "customer" | "creative" | "admin" {
  if (role === "CUSTOMER") return "customer";
  if (role === "DESIGNER") return "creative";
  return "admin"; // SITE_OWNER, SITE_ADMIN
}

async function sendEmailForNotification(
  input: CreateNotificationInput,
): Promise<void> {
  // Look up recipient email + name + role
  const recipient = await prisma.userAccount.findUnique({
    where: { id: input.userId },
    select: { email: true, name: true, role: true },
  });

  if (!recipient?.email) return;

  // Look up actor name if provided
  let actorName: string | null = null;
  if (input.actorId) {
    const actor = await prisma.userAccount.findUnique({
      where: { id: input.actorId },
      select: { name: true },
    });
    actorName = actor?.name ?? null;
  }

  const recipientRole = roleToRecipientRole(recipient.role);
  const subject = getSubjectForType(input.type, input.title);
  const html = buildNotificationEmailHtml({
    recipientName: recipient.name,
    type: input.type,
    title: input.title,
    message: input.message,
    ticketId: input.ticketId ?? null,
    actorName,
    recipientRole,
  });

  await sendNotificationEmail(recipient.email, subject, html);
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

type GetNotificationsOptions = {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
};

export async function getNotifications(
  userId: string,
  opts: GetNotificationsOptions = {},
) {
  const { limit = 20, offset = 0, unreadOnly = false } = opts;

  return prisma.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      ticketId: true,
      read: true,
      createdAt: true,
      actor: {
        select: { id: true, name: true },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Mark as read
// ---------------------------------------------------------------------------

export async function markAsRead(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true, readAt: new Date() },
  });
  return result.count > 0;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
  return result.count;
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export type PreferenceEntry = {
  type: NotificationType;
  enabled: boolean;
  emailEnabled: boolean;
};

/**
 * Returns all notification type preferences for a user.
 * Types without an explicit row default to enabled for both channels.
 */
export async function getUserPreferences(
  userId: string,
): Promise<PreferenceEntry[]> {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId },
    select: { type: true, enabled: true, emailEnabled: true },
  });

  const map = new Map(
    rows.map((r) => [r.type, { enabled: r.enabled, emailEnabled: r.emailEnabled }]),
  );

  return ALL_TYPES.map((type) => ({
    type,
    enabled: map.get(type)?.enabled ?? true,
    emailEnabled: map.get(type)?.emailEnabled ?? true,
  }));
}

/**
 * Upserts a single notification preference for a user.
 * Accepts either or both channel toggles.
 */
export async function setUserPreference(
  userId: string,
  type: NotificationType,
  updates: { enabled?: boolean; emailEnabled?: boolean },
): Promise<void> {
  const updateData: Record<string, boolean> = {};
  const createData: Record<string, unknown> = { userId, type };

  if (updates.enabled !== undefined) {
    updateData.enabled = updates.enabled;
    createData.enabled = updates.enabled;
  }
  if (updates.emailEnabled !== undefined) {
    updateData.emailEnabled = updates.emailEnabled;
    createData.emailEnabled = updates.emailEnabled;
  }

  await prisma.notificationPreference.upsert({
    where: { userId_type: { userId, type } },
    create: createData as any,
    update: updateData,
  });
}
