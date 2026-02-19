// -----------------------------------------------------------------------------
// @file: lib/board.ts
// @purpose: Shared constants and utilities for kanban board pages
// -----------------------------------------------------------------------------

import type { TicketStatus, TicketPriority } from "@prisma/client";
export type { TicketStatus, TicketPriority };

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export const STATUS_ORDER: TicketStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

export const statusColumnClass = (status: TicketStatus): string => {
  switch (status) {
    case "TODO":
      return "bg-[var(--bb-bg-card)]";
    case "IN_PROGRESS":
      return "bg-[var(--bb-info-bg)]";
    case "IN_REVIEW":
      return "bg-[var(--bb-warning-bg)]";
    case "DONE":
      return "bg-[#e8f6f0]";
    default:
      return "bg-[var(--bb-bg-card)]";
  }
};

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export const PRIORITY_ORDER: TicketPriority[] = [
  "URGENT",
  "HIGH",
  "MEDIUM",
  "LOW",
];

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const formatPriorityLabel = (priority: TicketPriority): string =>
  PRIORITY_LABELS[priority] ?? priority;

// ---------------------------------------------------------------------------
// Badge variant helpers (maps enum → shared Badge component variant)
// ---------------------------------------------------------------------------

import type { BadgeVariant } from "@/components/ui/badge";

export const priorityBadgeVariant = (p: TicketPriority): BadgeVariant => {
  switch (p) {
    case "LOW":
      return "neutral";
    case "MEDIUM":
      return "info";
    case "HIGH":
      return "warning";
    case "URGENT":
      return "danger";
  }
};

export const statusBadgeVariant = (s: TicketStatus): BadgeVariant => {
  switch (s) {
    case "TODO":
      return "neutral";
    case "IN_PROGRESS":
      return "info";
    case "IN_REVIEW":
      return "warning";
    case "DONE":
      return "success";
  }
};

// ---------------------------------------------------------------------------
// Board card / column shared class constants
// ---------------------------------------------------------------------------

export const BOARD_CARD_BASE =
  "rounded-xl border border-[var(--bb-border)] bg-white p-3 shadow-sm";

export const BOARD_COLUMN_HEADER =
  "text-xs font-semibold uppercase tracking-[0.18em] text-[var(--bb-text-tertiary)]";

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

export const formatBoardDate = (iso: string | null): string => {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (iso: string | null): string => {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString();
};

// ---------------------------------------------------------------------------
// Figma redesign shared helpers (used across customer, admin, designer boards)
// ---------------------------------------------------------------------------

/** Column accent bar colors (top of each status column) */
export const columnAccentColor: Record<TicketStatus, string> = {
  TODO: "#9CA3AF",
  IN_PROGRESS: "#3B82F6",
  IN_REVIEW: "#F15B2B",
  DONE: "#22C55E",
};

/** Palette for project sidebar icon backgrounds */
export const PROJECT_COLORS = [
  "#7C3AED", "#3B82F6", "#22C55E", "#F59E0B",
  "#EC4899", "#14B8A6", "#F97316", "#EF4444",
];

/** Palette for avatar circle backgrounds */
export const AVATAR_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#F43F5E",
  "#F59E0B", "#10B981", "#06B6D4", "#3B82F6",
];

/** Deterministic color for a name — same name always gets same color */
export const avatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

/** Icon-only priority indicators */
export const priorityIconMap: Record<TicketPriority, string> = {
  URGENT: "↑↑",
  HIGH: "↑",
  MEDIUM: "→",
  LOW: "↓",
};

/** Text color class for icon-only priority display */
export const priorityColorClass = (p: TicketPriority): string => {
  switch (p) {
    case "URGENT":
      return "text-[#b13832]";
    case "HIGH":
      return "text-[#f5a623]";
    case "MEDIUM":
      return "text-[#7a7a7a]";
    case "LOW":
      return "text-[#b1afa9]";
  }
};

/** Returns "25 OCT" format for due-date pills */
export const formatDueDateShort = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getDate();
  const month = d
    .toLocaleString("en-US", { month: "short" })
    .toUpperCase();
  return `${day} ${month}`;
};

/** Check if a due date is in the past */
export const isDueDateOverdue = (iso: string | null): boolean => {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
};

/** Check if due date is within 3 days (soon, but not overdue) */
export const isDueDateSoon = (iso: string | null): boolean => {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const diffMs = d.getTime() - Date.now();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 0 && diffDays <= 3;
};

/** Human-friendly due-date countdown: "3 days left", "2 days overdue", "Today" */
export const formatDueDateCountdown = (
  iso: string | null,
): { label: string; overdue: boolean } | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { label: "Due today", overdue: false };
  if (diffDays === 1) return { label: "Due tomorrow", overdue: false };
  if (diffDays > 1) return { label: `${diffDays} days left`, overdue: false };
  if (diffDays === -1) return { label: "1 day overdue", overdue: true };
  return { label: `${Math.abs(diffDays)} days overdue`, overdue: true };
};

/** Returns 2-char uppercase initials for avatar circles */
export const getInitials = (
  name: string | null,
  email: string | null,
): string => {
  const str = name || email || "?";
  const namePart = str.split("@")[0];
  const parts = namePart.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
