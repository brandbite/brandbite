// -----------------------------------------------------------------------------
// @file: components/dashboard/customer-board/ticket-card.tsx
// @purpose: One request on the customer board. Opens the detail dialog on click,
//           Enter or Space; only In review cards can be dragged.
// -----------------------------------------------------------------------------

"use client";

import type { DragEvent, MouseEvent } from "react";

import { Badge, DASH, PRIORITY } from "@/components/admin/v2/ui";
import { stripHtml } from "@/components/ui/safe-html";
import { TagBadge } from "@/components/ui/tag-badge";
import { formatBoardDate, isDueDateOverdue } from "@/lib/board";
import type { TagColorKey } from "@/lib/tag-colors";

import { IconCheck } from "./board-icons";
import type { CustomerBoardTicket } from "./board-types";

export function TicketCard({
  ticket,
  thumbnailSrc,
  draggable,
  dragging,
  updating,
  onOpen,
  onDragStart,
  onDragEnd,
  onMouseDown,
  onMouseUp,
}: {
  ticket: CustomerBoardTicket;
  thumbnailSrc: string | null;
  draggable: boolean;
  dragging: boolean;
  updating: boolean;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseUp: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  const priority = PRIORITY[ticket.priority];
  // A finished request can't be late any more.
  const overdue = ticket.status !== "DONE" && isDueDateOverdue(ticket.dueDate);
  const tags = ticket.tags ?? [];
  const description = ticket.description ? stripHtml(ticket.description).trim() : "";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${ticket.code ? `${ticket.code}, ` : ""}${ticket.title}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={[
        "rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-4 transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        dragging ? "opacity-50" : "hover:border-[var(--av2-accent)]/50",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate pt-0.5 text-xs font-medium text-[var(--av2-text-2)]">
          {ticket.code ?? DASH}
        </span>
        {priority ? <Badge tone={priority.tone}>{priority.label}</Badge> : null}
      </div>

      <p className="mt-2 text-base leading-6 font-semibold break-words">{ticket.title}</p>

      {description ? (
        <p className="mt-1 line-clamp-3 text-sm leading-5 break-words text-[var(--av2-text-2)]">
          {description}
        </p>
      ) : null}

      {thumbnailSrc ? (
        <div className="mt-3 overflow-hidden rounded-lg bg-[var(--av2-bg)]">
          <img src={thumbnailSrc} alt="" className="h-28 w-full object-cover" loading="lazy" />
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1">
          {tags.slice(0, 3).map((tag) => (
            <TagBadge
              key={tag.id}
              name={tag.name}
              color={tag.color as TagColorKey}
              className="!text-xs"
            />
          ))}
          {tags.length > 3 ? (
            <span className="text-xs text-[var(--av2-text-2)]">+{tags.length - 3}</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
        <span
          className={
            overdue ? "font-medium text-[var(--av2-error-text)]" : "text-[var(--av2-text-2)]"
          }
        >
          {ticket.dueDate ? formatBoardDate(ticket.dueDate) : DASH}
          {overdue ? " · Overdue" : ""}
        </span>
        {ticket.isAssigned ? (
          <Badge tone="green" icon={<IconCheck width={14} height={14} />}>
            Assigned
          </Badge>
        ) : null}
      </div>

      {updating ? (
        <p role="status" className="mt-2 text-xs text-[var(--av2-text-2)]">
          Updating status…
        </p>
      ) : null}
    </div>
  );
}
