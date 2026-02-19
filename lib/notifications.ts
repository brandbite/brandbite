// -----------------------------------------------------------------------------
// @file: lib/notifications.ts
// @purpose: Helper functions for creating, querying, and managing in-app
//           notifications with user preference support
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

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
// Create notification (respects user preferences)
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
 * Creates a notification for a user, but only if their preferences allow it.
 * If no preference row exists for this type, it defaults to enabled.
 * Fire-and-forget — errors are swallowed to avoid breaking the main flow.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    // Check user preference
    const pref = await prisma.notificationPreference.findUnique({
      where: {
        userId_type: { userId: input.userId, type: input.type },
      },
      select: { enabled: true },
    });

    // No row = enabled by default
    if (pref && !pref.enabled) return;

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
  } catch (err) {
    console.error("[notifications] failed to create notification", err);
  }
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
};

/**
 * Returns all notification type preferences for a user.
 * Types without an explicit row default to enabled.
 */
export async function getUserPreferences(
  userId: string,
): Promise<PreferenceEntry[]> {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId },
    select: { type: true, enabled: true },
  });

  const map = new Map(rows.map((r) => [r.type, r.enabled]));

  return ALL_TYPES.map((type) => ({
    type,
    enabled: map.get(type) ?? true,
  }));
}

/**
 * Upserts a single notification preference for a user.
 */
export async function setUserPreference(
  userId: string,
  type: NotificationType,
  enabled: boolean,
): Promise<void> {
  await prisma.notificationPreference.upsert({
    where: { userId_type: { userId, type } },
    create: { userId, type, enabled },
    update: { enabled },
  });
}
