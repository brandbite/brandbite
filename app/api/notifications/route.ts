// -----------------------------------------------------------------------------
// @file: app/api/notifications/route.ts
// @purpose: GET notifications list + PATCH mark-as-read for current user
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "@/lib/notifications";

// ---------------------------------------------------------------------------
// GET /api/notifications?limit=20&offset=0&unreadOnly=false
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    // Rate limit: 30 requests/min per IP
    const ip = getClientIp(req.headers);
    const rl = rateLimit(`notifications:${ip}`, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const user = await getCurrentUserOrThrow();

    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1),
      50,
    );
    const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    const [notifications, unreadCount] = await Promise.all([
      getNotifications(user.id, { limit, offset, unreadOnly }),
      getUnreadCount(user.id),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[notifications] GET error", err);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/notifications — mark single or all as read
// Body: { id: string } or { markAllRead: true }
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const body = (await req.json()) as Record<string, unknown>;

    if (body.markAllRead === true) {
      const count = await markAllAsRead(user.id);
      return NextResponse.json({ success: true, markedCount: count });
    }

    const id = body.id as string | undefined;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
    }

    const updated = await markAsRead(id, user.id);
    if (!updated) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[notifications] PATCH error", err);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
