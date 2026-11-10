// -----------------------------------------------------------------------------
// @file: app/api/moodboards/[moodboardId]/comments/route.ts
// @purpose: A moodboard's comment threads: list them, start one on an object,
//           or reply to one. Anyone who can see the board can comment. New
//           comments notify the board's maker and the thread's other people.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { MOODBOARD_ACCESS_SELECT, moodboardAccess } from "@/lib/moodboard-access";
import {
  canStillSee,
  cleanBody,
  COMMENT_MAX_LENGTH,
  commentRecipients,
  listThreads,
  viewerOf,
} from "@/lib/moodboard-comments";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ moodboardId: string }> };

const BOARD_SELECT = {
  id: true,
  title: true,
  ...MOODBOARD_ACCESS_SELECT,
} as const;

function failure(err: unknown, where: string) {
  if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  console.error(`[moodboards/comments] ${where} error:`, err);
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();
    const { moodboardId } = await params;
    const board = await prisma.moodboard.findUnique({
      where: { id: moodboardId },
      select: BOARD_SELECT,
    });
    if (!board || !moodboardAccess(user, board).canView) {
      return NextResponse.json({ error: "Moodboard not found" }, { status: 404 });
    }
    return NextResponse.json({ threads: await listThreads(moodboardId), viewer: viewerOf(user) });
  } catch (err) {
    return failure(err, "GET");
  }
}

/** { itemId, body } starts a thread on an object; { threadId, body } replies. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();
    const { moodboardId } = await params;
    const board = await prisma.moodboard.findUnique({
      where: { id: moodboardId },
      select: BOARD_SELECT,
    });
    if (!board || !moodboardAccess(user, board).canView) {
      return NextResponse.json({ error: "Moodboard not found" }, { status: 404 });
    }

    const raw = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const body = cleanBody(raw.body);
    if (!body) {
      return NextResponse.json(
        { error: `Write a comment of up to ${COMMENT_MAX_LENGTH} characters.` },
        { status: 400 },
      );
    }

    let threadAuthorIds: string[] = [];
    if (typeof raw.threadId === "string") {
      const thread = await prisma.moodboardComment.findFirst({
        where: { id: raw.threadId, moodboardId, threadId: null },
        select: { id: true, authorId: true, replies: { select: { authorId: true } } },
      });
      if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      threadAuthorIds = [thread.authorId, ...thread.replies.map((r) => r.authorId)];
      await prisma.$transaction([
        prisma.moodboardComment.create({
          data: { moodboardId, threadId: thread.id, authorId: user.id, body },
        }),
        // A reply reopens a resolved thread.
        prisma.moodboardComment.update({
          where: { id: thread.id },
          data: { resolvedAt: null, resolvedById: null },
        }),
      ]);
    } else if (typeof raw.itemId === "string") {
      const item = await prisma.moodboardItem.findFirst({
        where: { id: raw.itemId, moodboardId, deletedAt: null },
        select: { id: true },
      });
      if (!item)
        return NextResponse.json({ error: "That object isn't on the board" }, { status: 404 });
      await prisma.moodboardComment.create({
        data: { moodboardId, itemId: item.id, authorId: user.id, body },
      });
    } else {
      return NextResponse.json({ error: "Say which object or thread" }, { status: 400 });
    }

    const recipients = commentRecipients({
      boardCreatorId: board.createdById,
      threadAuthorIds,
      authorId: user.id,
    });
    const snippet = body.length > 140 ? `${body.slice(0, 137)}…` : body;
    const actorName = user.name || "Someone";
    await Promise.all(
      recipients.map(async (userId) => {
        if (!(await canStillSee(userId, board))) return;
        await createNotification({
          userId,
          type: "MOODBOARD_COMMENT",
          title: `New comment on "${board.title}"`,
          message: `${actorName}: ${snippet}`,
          moodboardId,
          actorId: user.id,
        });
      }),
    );

    return NextResponse.json(
      { threads: await listThreads(moodboardId), viewer: viewerOf(user) },
      { status: 201 },
    );
  } catch (err) {
    return failure(err, "POST");
  }
}
