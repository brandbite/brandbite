// -----------------------------------------------------------------------------
// @file: components/ui/notification-bell.tsx
// @purpose: Bell icon with unread count badge and dropdown notification panel
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  ticketId: string | null;
  read: boolean;
  createdAt: string;
  actor: { id: string; name: string | null } | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const TYPE_ICONS: Record<string, string> = {
  REVISION_SUBMITTED: "📤",
  FEEDBACK_SUBMITTED: "💬",
  TICKET_COMPLETED: "✅",
  TICKET_ASSIGNED: "📋",
  TICKET_STATUS_CHANGED: "🔄",
  PIN_RESOLVED: "📌",
};

// ---------------------------------------------------------------------------
// NotificationBell
// ---------------------------------------------------------------------------

export function NotificationBell({ role }: { role: "customer" | "creative" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Poll unread count every 30s
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=0");
      const json = await res.json().catch(() => null);
      if (json && typeof json.unreadCount === "number") {
        setUnreadCount(json.unreadCount);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch full list when dropdown opens
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=20");
      const json = await res.json().catch(() => null);
      if (json?.notifications) {
        setNotifications(json.notifications);
        setUnreadCount(json.unreadCount ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) fetchNotifications();
      return next;
    });
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Mark single as read + navigate
  const handleClickNotification = useCallback(
    async (notif: NotificationItem) => {
      if (!notif.read) {
        fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notif.id }),
        })
          .then(() => {
            setNotifications((prev) =>
              prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
            );
            setUnreadCount((c) => Math.max(0, c - 1));
          })
          .catch(() => {});
      }

      if (notif.ticketId) {
        setOpen(false);
        if (role === "creative") {
          router.push(`/creative/board`);
        } else {
          router.push(`/customer/tickets/${notif.ticketId}`);
        }
      }
    },
    [role, router],
  );

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    } finally {
      setMarkingAll(false);
    }
  }, []);

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[#7a7a7a] transition-colors hover:bg-[#f5f3f0] hover:text-[#424143]"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        {/* Bell SVG */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#f15b2b] px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-[#e3e1dc] bg-white shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#f0eee9] px-4 py-3">
            <span className="text-xs font-semibold text-[#424143]">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="text-[10px] font-medium text-[#f15b2b] hover:underline disabled:opacity-50"
              >
                {markingAll ? "Marking..." : "Mark all as read"}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-[#9a9892]">Loading...</p>
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-[#9a9892]">You&apos;re all caught up!</p>
                <p className="mt-0.5 text-[10px] text-[#b1afa9]">
                  No notifications yet
                </p>
              </div>
            )}

            {notifications.map((notif) => (
              <button
                key={notif.id}
                type="button"
                onClick={() => handleClickNotification(notif)}
                className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[#f5f3f0] ${
                  !notif.read ? "bg-[#f15b2b]/[0.03]" : ""
                }`}
              >
                {/* Icon */}
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f5f3f0] text-sm">
                  {TYPE_ICONS[notif.type] ?? "🔔"}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className={`truncate text-[11px] ${!notif.read ? "font-semibold text-[#424143]" : "font-medium text-[#7a7a7a]"}`}>
                      {notif.title}
                    </p>
                    {!notif.read && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f15b2b]" />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[#9a9892]">
                    {notif.message}
                  </p>
                  <p className="mt-0.5 text-[9px] text-[#b1afa9]">
                    {relativeTime(notif.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
