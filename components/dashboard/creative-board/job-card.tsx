// -----------------------------------------------------------------------------
// @file: components/dashboard/creative-board/job-card.tsx
// @purpose: One ticket on the creative board. Presentation only; dragging,
//           selecting and opening are handled by the page. "Open job" is a real
//           button so the detail dialog can be reached from the keyboard.
// -----------------------------------------------------------------------------

"use client";

import type { DragEvent, MouseEvent } from "react";

import { IconAlertCircle, IconArrowUpRight, IconCoins } from "@/components/admin/v2/icons";
import { Badge, Button, DASH, fmt, plural, PRIORITY, type Tone } from "@/components/admin/v2/ui";
import { stripHtml } from "@/components/ui/safe-html";
import { formatBoardDate, isDueDateOverdue } from "@/lib/board";
import { buildTicketCode } from "@/lib/ticket-code";

import { IconCalendar } from "./icons";
import type { CreativeTicket } from "./types";

/** "10 tokens", or a dash when the payout isn't known. Never zero-fills. */
export function formatPayout(tokens: number | null | undefined): string {
  if (tokens == null) return DASH;
  return `${fmt(tokens)} ${plural(tokens, "token", "tokens")}`;
}

/** Finished work can't run late, so only open tickets count as overdue. */
export function isTicketOverdue(ticket: Pick<CreativeTicket, "status" | "dueDate">): boolean {
  return ticket.status !== "DONE" && isDueDateOverdue(ticket.dueDate);
}

export function ticketCode(ticket: CreativeTicket): string {
  return buildTicketCode({
    projectCode: ticket.project?.code,
    companyTicketNumber: ticket.companyTicketNumber,
    ticketId: ticket.id,
  });
}

export function JobCard({
  ticket,
  selectionMode,
  isSelected,
  isDragging,
  isUpdating,
  canDrag,
  onOpen,
  onToggleSelect,
  onDragStart,
  onDragEnd,
  onMouseDown,
  onMouseUp,
  onClick,
}: {
  ticket: CreativeTicket;
  selectionMode: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isUpdating: boolean;
  canDrag: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onMouseDown: (event: MouseEvent<HTMLElement>) => void;
  onMouseUp: (event: MouseEvent<HTMLElement>) => void;
  onClick: () => void;
}) {
  const priority = PRIORITY[ticket.priority];
  const overdue = isTicketOverdue(ticket);
  const description = ticket.description ? stripHtml(ticket.description) : "";

  return (
    <article
      className={`cursor-pointer rounded-2xl border p-4 transition-colors ${
        isSelected
          ? "border-[var(--av2-accent)] bg-[var(--av2-selected)] ring-1 ring-[var(--av2-accent)]"
          : isDragging
            ? "border-[var(--av2-border)] bg-[var(--av2-surface)] opacity-50"
            : isUpdating
              ? "border-[var(--av2-border)] bg-[var(--av2-surface)] opacity-60"
              : "border-[var(--av2-border)] bg-[var(--av2-surface)] hover:border-[var(--av2-text-2)]"
      }`}
      draggable={canDrag}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onClick={onClick}
    >
      {selectionMode && ticket.status !== "DONE" && (
        // The card itself toggles on click, so this control keeps its own click
        // to itself. Otherwise one click would toggle twice.
        <label
          className="mb-2 flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="h-5 w-5 shrink-0 accent-[var(--av2-accent-strong)]"
          />
          <span aria-hidden>{isSelected ? "Selected" : "Select"}</span>
          <span className="sr-only">{ticket.title}</span>
        </label>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-[var(--av2-text-2)]">
          {ticketCode(ticket)}
        </span>
        {priority && <Badge tone={priority.tone as Tone}>{priority.label}</Badge>}
      </div>

      <h3 className="mt-2 text-base leading-6 font-semibold break-words">{ticket.title}</h3>

      {ticket.company?.name && (
        <p className="mt-0.5 truncate text-xs text-[var(--av2-text-2)]">{ticket.company.name}</p>
      )}

      {description && (
        <p className="mt-2 line-clamp-2 text-sm break-words text-[var(--av2-text-2)]">
          {description}
        </p>
      )}

      {(ticket.latestRevisionHasFeedback || ticket.revisionCount > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ticket.latestRevisionHasFeedback && (
            <Badge tone="amber" dot>
              Changes requested
            </Badge>
          )}
          {ticket.revisionCount > 0 && <Badge>Version {ticket.revisionCount}</Badge>}
        </div>
      )}

      {ticket.latestRevisionHasFeedback && ticket.latestRevisionFeedbackSnippet && (
        <p className="mt-2 line-clamp-2 text-sm break-words text-[var(--av2-text-2)] italic">
          &ldquo;{ticket.latestRevisionFeedbackSnippet}&rdquo;
        </p>
      )}

      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] border-t border-[var(--av2-border)] pt-3">
        <div className="flex gap-1.5 pr-3">
          <IconCoins width={16} height={16} className="mt-0.5 shrink-0 text-[var(--av2-text-2)]" />
          <div>
            <dt className="text-xs text-[var(--av2-text-2)]">Payout</dt>
            <dd className="text-sm font-semibold whitespace-nowrap tabular-nums">
              {formatPayout(ticket.estimatedPayout)}
            </dd>
          </div>
        </div>
        <div className="flex min-w-0 gap-1.5 border-l border-[var(--av2-border)] pl-3">
          <IconCalendar className="mt-0.5 shrink-0 text-[var(--av2-text-2)]" />
          <div className="min-w-0">
            <dt className="text-xs text-[var(--av2-text-2)]">Due date</dt>
            <dd className={`text-sm font-medium ${overdue ? "text-[var(--av2-error-text)]" : ""}`}>
              {formatBoardDate(ticket.dueDate)}
              {overdue && (
                <span className="mt-0.5 flex items-center gap-1 text-xs">
                  <IconAlertCircle width={12} height={12} className="shrink-0" />
                  Overdue
                </span>
              )}
            </dd>
          </div>
        </div>
      </dl>

      {!selectionMode && (
        <Button variant="primary" className="mt-3 w-full" onClick={onOpen}>
          Open job
          <span className="sr-only">: {ticket.title}</span>
          <IconArrowUpRight />
        </Button>
      )}
    </article>
  );
}
