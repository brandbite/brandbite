// -----------------------------------------------------------------------------
// @file: lib/moodboard-comments.ts
// @purpose: Comments on moodboard objects: reading a board's threads, and
//           working out who hears about a new comment. Everyone who can see a
//           board can comment on it. A new comment notifies the board's maker
//           and everyone already in that thread (never its author), as long as
//           they can still see the board.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { CommentClient, CommentThreadClient } from "@/lib/moodboard";
import { isSiteAdminRole } from "@/lib/roles";

/** Who's reading: their own comments can be edited and deleted; admins can delete any. */
export function viewerOf(user: { id: string; role: string }) {
  return { id: user.id, canModerate: isSiteAdminRole(user.role as never) };
}

/** Longest comment, in characters. */
export const COMMENT_MAX_LENGTH = 2000;

const AUTHOR_SELECT = { id: true, name: true, email: true } as const;

type Row = {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string | null; email: string };
};

function toClient(row: Row): CommentClient {
  return {
    id: row.id,
    body: row.body,
    author: { id: row.author.id, name: row.author.name || row.author.email.split("@")[0] },
    createdAt: row.createdAt.toISOString(),
    edited: row.updatedAt.getTime() - row.createdAt.getTime() > 1000,
  };
}

/** Every thread on the board's objects (deleted objects left out), oldest first. */
export async function listThreads(moodboardId: string): Promise<CommentThreadClient[]> {
  const roots = await prisma.moodboardComment.findMany({
    where: { moodboardId, threadId: null, item: { deletedAt: null } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      itemId: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
      author: { select: AUTHOR_SELECT },
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          updatedAt: true,
          author: { select: AUTHOR_SELECT },
        },
      },
    },
  });
  return roots.map((root) => ({
    ...toClient(root),
    itemId: root.itemId!,
    resolvedAt: root.resolvedAt?.toISOString() ?? null,
    replies: root.replies.map(toClient),
  }));
}

/** The comment text, trimmed, or null when it's empty or too long. */
export function cleanBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const body = raw.trim();
  return body && body.length <= COMMENT_MAX_LENGTH ? body : null;
}

type BoardForAccess = {
  companyId: string | null;
  createdById: string;
  sharedWithCustomer: boolean;
  ticket: { companyId: string; creativeId: string | null } | null;
};

/**
 * Whether this person can still see the board, worked out from the database
 * rather than a session (they aren't the one signed in). Mirrors
 * moodboardAccess: admins see everything; creatives their own boards and
 * the boards on jobs they're assigned; customers their company's boards and
 * creative boards shared on their company's jobs.
 */
export async function canStillSee(userId: string, board: BoardForAccess): Promise<boolean> {
  const user = await prisma.userAccount.findUnique({
    where: { id: userId },
    select: { role: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return false;
  if (isSiteAdminRole(user.role)) return true;
  if (user.role === "DESIGNER") {
    return board.companyId === null
      ? board.createdById === userId
      : board.ticket?.creativeId === userId;
  }
  if (user.role === "CUSTOMER") {
    const companyId =
      board.companyId ?? (board.sharedWithCustomer ? (board.ticket?.companyId ?? null) : null);
    if (!companyId) return false;
    const member = await prisma.companyMember.findFirst({
      where: { userId, companyId },
      select: { id: true },
    });
    return !!member;
  }
  return false;
}

/** The board's maker and everyone in the thread, without the new comment's author. */
export function commentRecipients(input: {
  boardCreatorId: string;
  threadAuthorIds: string[];
  authorId: string;
}): string[] {
  return [...new Set([input.boardCreatorId, ...input.threadAuthorIds])].filter(
    (id) => id !== input.authorId,
  );
}
