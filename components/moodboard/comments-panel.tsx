"use client";

// -----------------------------------------------------------------------------
// @file: components/moodboard/comments-panel.tsx
// @purpose: The moodboard's comments, beside the canvas (full screen on
//           phones). Shows every open thread, or one object's threads with a
//           box to start a new one; replies, resolve / reopen, and deleting
//           your own comments. Read-only viewers can comment too.
// -----------------------------------------------------------------------------

import React, { useId, useState } from "react";

import type {
  CommentClient,
  CommentThreadClient,
  CommentViewer,
  MoodboardItemClient,
} from "@/lib/moodboard";

type CommentsPanelProps = {
  threads: CommentThreadClient[];
  items: MoodboardItemClient[];
  viewer: CommentViewer | null;
  /** One object's threads, with a box to start one; null for every thread. */
  focusItemId: string | null;
  loading: boolean;
  onClose: () => void;
  onShowAll: () => void;
  /** Picks the object on the board and narrows the panel to it. */
  onFocusItem: (itemId: string) => void;
  onStart: (itemId: string, body: string) => Promise<boolean>;
  onReply: (threadId: string, body: string) => Promise<boolean>;
  onResolve: (threadId: string, resolved: boolean) => void;
  onDelete: (commentId: string) => void;
};

/** A short name for an object, for "On …" labels. */
export function itemLabel(item: MoodboardItemClient | undefined): string {
  if (!item) return "Deleted object";
  const data = item.data as Record<string, unknown>;
  const text = (key: string) => (typeof data[key] === "string" ? (data[key] as string).trim() : "");
  const clip = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);
  switch (item.type) {
    case "NOTE":
      return clip(text("body")) || "Sticky note";
    case "SHAPE":
      return clip(text("text")) || "Shape";
    case "TEXT":
      return clip(text("text")) || "Text";
    case "SECTION":
      return clip(text("title")) || "Section";
    case "IMAGE":
      return clip(text("caption") || text("originalName")) || "Image";
    case "LINK":
      return clip(text("title") || text("url")) || "Link";
    case "FILE":
      return clip(text("originalName")) || "File";
    case "COLOR":
      return text("hex") || "Color";
    case "TODO":
      return clip(text("title")) || "Checklist";
    case "EMBED":
      return clip(text("title")) || "Video";
    default:
      return "Object";
  }
}

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none";

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Composer({
  label,
  placeholder,
  submitLabel,
  onSubmit,
  autoFocus = false,
}: {
  label: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<boolean>;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    const ok = await onSubmit(body);
    setSending(false);
    if (ok) setBody("");
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
        rows={2}
        maxLength={2000}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] px-3 py-2 text-sm text-[var(--av2-text)] placeholder:text-[var(--av2-text-2)] focus:border-[var(--av2-accent)] focus:outline-none"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!body.trim() || sending}
          className={`h-9 rounded-lg bg-[var(--av2-accent-strong)] px-4 text-sm font-semibold text-white disabled:opacity-50 ${FOCUS}`}
        >
          {sending ? "Posting…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function Comment({
  comment,
  viewer,
  onDelete,
}: {
  comment: CommentClient;
  viewer: CommentViewer | null;
  onDelete: (id: string) => void;
}) {
  const canDelete = !!viewer && (viewer.id === comment.author.id || viewer.canModerate);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold">{comment.author.name}</span>
        <span className="shrink-0 text-xs text-[var(--av2-text-2)]">
          {timeAgo(comment.createdAt)}
          {comment.edited ? " · edited" : ""}
        </span>
      </div>
      <p className="text-sm leading-5 break-words whitespace-pre-wrap">{comment.body}</p>
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(comment.id)}
          className={`self-start rounded text-xs font-medium text-[var(--av2-text-2)] hover:text-[var(--av2-error-text)] ${FOCUS}`}
        >
          Delete
        </button>
      )}
    </div>
  );
}

export function CommentsPanel({
  threads,
  items,
  viewer,
  focusItemId,
  loading,
  onClose,
  onShowAll,
  onFocusItem,
  onStart,
  onReply,
  onResolve,
  onDelete,
}: CommentsPanelProps) {
  const [showResolved, setShowResolved] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const byId = new Map(items.map((i) => [i.id, i]));
  const focusItem = focusItemId ? byId.get(focusItemId) : undefined;

  const shown = threads.filter(
    (t) => (!focusItemId || t.itemId === focusItemId) && (showResolved || !t.resolvedAt),
  );
  const resolvedCount = threads.filter(
    (t) => t.resolvedAt && (!focusItemId || t.itemId === focusItemId),
  ).length;

  return (
    <aside
      data-mb-canvas-ui
      aria-label="Comments"
      className="absolute top-[6.5rem] right-3 bottom-[5.5rem] z-40 flex w-[min(360px,calc(100%-1.5rem))] flex-col rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] text-[var(--av2-text)] shadow-xl max-sm:inset-0 max-sm:top-0 max-sm:w-full max-sm:rounded-none"
    >
      <header className="flex items-center gap-2 border-b border-[var(--av2-border)] px-4 py-3">
        <h2 className="text-base font-semibold">Comments</h2>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-[var(--av2-text-2)]">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="accent-[var(--av2-accent)]"
          />
          Show resolved{resolvedCount > 0 ? ` (${resolvedCount})` : ""}
        </label>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comments"
          className={`flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--av2-bg)] ${FOCUS}`}
        >
          <span aria-hidden>✕</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {focusItemId && (
          <div className="border-b border-[var(--av2-border)] px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-sm">
                On <span className="font-semibold">{itemLabel(focusItem)}</span>
              </p>
              <button
                type="button"
                onClick={onShowAll}
                className={`shrink-0 rounded text-xs font-semibold text-[var(--av2-link)] hover:underline ${FOCUS}`}
              >
                All comments
              </button>
            </div>
            {focusItem && (
              <Composer
                key={focusItemId}
                label="New comment"
                placeholder="Add a comment…"
                submitLabel="Comment"
                onSubmit={(body) => onStart(focusItemId, body)}
                autoFocus
              />
            )}
          </div>
        )}

        {!focusItemId && (
          <p className="border-b border-[var(--av2-border)] px-4 py-3 text-xs text-[var(--av2-text-2)]">
            To comment on something, click it on the board, then <strong>Comment</strong>.
          </p>
        )}

        {loading && threads.length === 0 ? (
          <p role="status" className="px-4 py-6 text-sm text-[var(--av2-text-2)]">
            Loading comments…
          </p>
        ) : shown.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--av2-text-2)]">
            {focusItemId ? "No comments on this yet." : "No open comments."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--av2-border)]">
            {shown.map((thread) => (
              <li
                key={thread.id}
                data-thread-id={thread.id}
                className={`flex flex-col gap-3 px-4 py-4 ${thread.resolvedAt ? "opacity-70" : ""}`}
              >
                {!focusItemId && (
                  <button
                    type="button"
                    onClick={() => onFocusItem(thread.itemId)}
                    className={`self-start truncate rounded text-xs font-semibold text-[var(--av2-link)] hover:underline ${FOCUS}`}
                  >
                    On {itemLabel(byId.get(thread.itemId))}
                  </button>
                )}
                <Comment comment={thread} viewer={viewer} onDelete={onDelete} />
                {thread.replies.length > 0 && (
                  <div className="flex flex-col gap-3 border-l-2 border-[var(--av2-border)] pl-3">
                    {thread.replies.map((reply) => (
                      <Comment key={reply.id} comment={reply} viewer={viewer} onDelete={onDelete} />
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReplyingTo(replyingTo === thread.id ? null : thread.id)}
                    className={`rounded text-xs font-semibold text-[var(--av2-text)] hover:underline ${FOCUS}`}
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolve(thread.id, !thread.resolvedAt)}
                    className={`rounded text-xs font-semibold text-[var(--av2-text)] hover:underline ${FOCUS}`}
                  >
                    {thread.resolvedAt ? "Reopen" : "Resolve"}
                  </button>
                  {thread.resolvedAt && (
                    <span className="text-xs text-[var(--av2-text-2)]">Resolved</span>
                  )}
                </div>
                {replyingTo === thread.id && (
                  <Composer
                    label="Reply"
                    placeholder="Write a reply…"
                    submitLabel="Reply"
                    autoFocus
                    onSubmit={async (body) => {
                      const ok = await onReply(thread.id, body);
                      if (ok) setReplyingTo(null);
                      return ok;
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
