// -----------------------------------------------------------------------------
// @file: app/api/moodboards/[moodboardId]/comments/[commentId]/route.ts
// @purpose: One comment: resolve or reopen its thread (anyone who can see the
//           board), edit its text (its author), or delete it (its author or a
//           brandbite admin). Deleting a thread's first comment removes the
//           thread with its replies.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { MOODBOARD_ACCESS_SELECT, moodboardAccess } from "@/lib/moodboard-access";
import { cleanBody, COMMENT_MAX_LENGTH, listThreads, viewerOf } from "@/lib/moodboard-comments";
import { prisma } from "@/lib/prisma";
import { isSiteAdminRole } from "@/lib/roles";

type RouteParams = { params: Promise<{ moodboardId: string; commentId: string }> };

async function load(moodboardId: string, commentId: string) {
  return prisma.moodboardComment.findFirst({
    where: { id: commentId, moodboardId },
    select: {
      id: true,
      authorId: true,
      threadId: true,
      moodboard: { select: MOODBOARD_ACCESS_SELECT },
    },
  });
}

function failure(err: unknown, where: string) {
  if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  console.error(`[moodboards/comments/:id] ${where} error:`, err);
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}

/** { resolved: boolean } on a thread's first comment, or { body } by its author. */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();
    const { moodboardId, commentId } = await params;
    const comment = await load(moodboardId, commentId);
    if (!comment || !moodboardAccess(user, comment.moodboard).canView) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const raw = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    if (typeof raw.resolved === "boolean") {
      if (comment.threadId) {
        return NextResponse.json({ error: "Resolve the thread, not a reply" }, { status: 400 });
      }
      await prisma.moodboardComment.update({
        where: { id: comment.id },
        data: raw.resolved
          ? { resolvedAt: new Date(), resolvedById: user.id }
          : { resolvedAt: null, resolvedById: null },
      });
    } else if (raw.body !== undefined) {
      if (comment.authorId !== user.id) {
        return NextResponse.json({ error: "Only its author can edit a comment" }, { status: 403 });
      }
      const body = cleanBody(raw.body);
      if (!body) {
        return NextResponse.json(
          { error: `Write a comment of up to ${COMMENT_MAX_LENGTH} characters.` },
          { status: 400 },
        );
      }
      await prisma.moodboardComment.update({ where: { id: comment.id }, data: { body } });
    } else {
      return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    }

    return NextResponse.json({ threads: await listThreads(moodboardId), viewer: viewerOf(user) });
  } catch (err) {
    return failure(err, "PATCH");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();
    const { moodboardId, commentId } = await params;
    const comment = await load(moodboardId, commentId);
    if (!comment || !moodboardAccess(user, comment.moodboard).canView) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    if (comment.authorId !== user.id && !isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Only its author can delete a comment" }, { status: 403 });
    }
    await prisma.moodboardComment.delete({ where: { id: comment.id } });
    return NextResponse.json({ threads: await listThreads(moodboardId), viewer: viewerOf(user) });
  } catch (err) {
    return failure(err, "DELETE");
  }
}
