// -----------------------------------------------------------------------------
// @file: app/creative/board/page.tsx
// @purpose: Creative-facing kanban board for assigned tickets with revision
//           indicators, filters, notes and toasts, on the dashboard design language.
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IconDocument } from "@/components/admin/v2/icons";
import {
  Badge,
  Button,
  Callout,
  EmptyState,
  fmt,
  PageHeader,
  plural,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  TICKET_STATUS,
} from "@/components/admin/v2/ui";
import { PauseBanner } from "@/components/creative/pause-banner";
import { IconCheckSquare } from "@/components/dashboard/creative-board/icons";
import { JobCard, ticketCode } from "@/components/dashboard/creative-board/job-card";
import {
  initialDetailTab,
  TicketDetailDialog,
} from "@/components/dashboard/creative-board/ticket-detail-dialog";
import type {
  BriefAsset,
  CreativeTicket,
  CreativeTicketsResponse,
  CreativeTicketsStats,
  DetailTab,
  TicketRevisionEntry,
} from "@/components/dashboard/creative-board/types";
import { UploadWorkDialog } from "@/components/dashboard/creative-board/upload-work-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { STATUS_ORDER } from "@/lib/board";
import type { TicketStatus, TicketPriority } from "@/lib/board";
import { fetchAllTickets } from "@/lib/fetch-all-tickets";
import {
  type PendingFile,
  getImageDimensions,
  isOutputMimeAllowed,
  validateFileSize,
} from "@/lib/upload-helpers";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import {
  MULTI_START_TIMER_HINT,
  autoTimerMessage,
} from "@/components/dashboard/tickets/time-tracking";

const VIEW_OPTIONS = [
  { value: "board", label: "Kanban", href: "/creative/board" },
  { value: "table", label: "Table", href: "/creative/tickets" },
];

/** Column header tints. Every one is a token with its own dark value. */
const COLUMN_TINT: Record<string, string> = {
  TODO: "var(--av2-track)",
  IN_PROGRESS: "var(--av2-lavender-bg)",
  IN_REVIEW: "var(--av2-attention-to)",
  DONE: "var(--av2-success-bg)",
};

const COLUMN_EMPTY: Record<string, { title: string; description: string }> = {
  TODO: {
    title: "No requests in backlog.",
    description: "New work assigned to you will appear here.",
  },
  IN_PROGRESS: {
    title: "No requests in progress.",
    description: "Requests you start will appear here.",
  },
  IN_REVIEW: {
    title: "No requests in review.",
    description: "Work submitted for review will appear here.",
  },
  DONE: {
    title: "No completed requests.",
    description: "Completed work will appear here.",
  },
};

export default function CreativeBoardPage() {
  const { showToast } = useToast();

  const [data, setData] = useState<CreativeTicketsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [onlyChangesRequested, setOnlyChangesRequested] = useState<boolean>(false);

  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TicketStatus | null>(null);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  const [detailTicketId, setDetailTicketId] = useState<string | null>(null);
  const [mouseDownInfo, setMouseDownInfo] = useState<{
    ticketId: string;
    x: number;
    y: number;
    time: number;
  } | null>(null);

  const [detailRevisions, setDetailRevisions] = useState<TicketRevisionEntry[] | null>(null);
  const [detailRevisionsLoading, setDetailRevisionsLoading] = useState<boolean>(false);
  const [detailRevisionsError, setDetailRevisionsError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("current");

  // Brief attachments state
  const [detailBriefAssets, setDetailBriefAssets] = useState<BriefAsset[]>([]);
  const [detailBriefAssetsLoading, setDetailBriefAssetsLoading] = useState(false);

  // Creative note modal state for IN_PROGRESS -> IN_REVIEW transition
  const [reviewModal, setReviewModal] = useState<{
    ticket: CreativeTicket;
    targetStatus: TicketStatus;
  } | null>(null);
  const [creativeNote, setCreativeNote] = useState<string>("");
  const [reviewFiles, setReviewFiles] = useState<PendingFile[]>([]);
  const [reviewUploading, setReviewUploading] = useState(false);
  const [reviewUploadProgress, setReviewUploadProgress] = useState<string | null>(null);
  const reviewFileInputRef = useRef<HTMLInputElement | null>(null);
  // The shared SearchInput doesn't forward a ref, so "/" finds the input through this.
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const MAX_REVIEW_FILES = 10;

  // ---------------------------------------------------------------------------
  // Data load
  // ---------------------------------------------------------------------------

  const load = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      // All pages — the API returns 50 per page by default, which used to
      // hide older tickets from the board.
      const json = await fetchAllTickets<CreativeTicketsResponse>("/api/creative/tickets").catch(
        (err: Error & { status?: number }) => {
          if (err.status === 401) throw new Error("You need to sign in as a creative.");
          throw err;
        },
      );
      setData(json);
    } catch (err: unknown) {
      if (silent) return; // background refresh: keep what's on screen
      console.error("[CreativeBoard] load error", err);
      const message = err instanceof Error ? err.message : "Failed to load your requests.";
      setError(message);

      showToast({
        type: "error",
        title: "Could not load your requests",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initial = async () => {
      if (cancelled) return;
      await load();
    };

    initial();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stay current without a reload: on return to the tab and every 30s while visible.
  useLiveRefresh(() => load({ silent: true }), {
    paused: Boolean(draggingTicketId || updatingTicketId || reviewModal || reviewUploading),
  });

  // ---------------------------------------------------------------------------
  // "/" keyboard shortcut — focus the search bar
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (el.isContentEditable || el.closest?.('[contenteditable="true"]')) return;
      if (e.key === "/") {
        e.preventDefault();
        searchWrapRef.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ---------------------------------------------------------------------------
  // Detail ticket revision history load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!detailTicketId) {
      setDetailRevisions(null);
      setDetailRevisionsError(null);
      setDetailRevisionsLoading(false);
      return;
    }

    let cancelled = false;

    const loadRevisions = async () => {
      setDetailRevisionsLoading(true);
      setDetailRevisionsError(null);

      try {
        const res = await fetch(`/api/creative/tickets/${detailTicketId}/revisions`, {
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const message =
            (json && typeof json === "object" && "error" in json && (json as any).error) ||
            `Failed to load revision history (status ${res.status}).`;

          const finalMessage =
            typeof message === "string" ? message : "Failed to load revision history.";

          if (!cancelled) {
            setDetailRevisionsError(finalMessage);
          }

          showToast({
            type: "error",
            title: "Could not load revision history",
            description: finalMessage,
          });

          return;
        }

        const entries = ((json as any)?.revisions ?? []) as TicketRevisionEntry[];
        if (!cancelled) {
          setDetailRevisions(entries);
        }
      } catch (err) {
        console.error("[CreativeBoard] failed to load ticket revision history", err);
        const finalMessage =
          err instanceof Error
            ? err.message
            : "Failed to load revision history. Please try again later.";

        if (!cancelled) {
          setDetailRevisionsError(finalMessage);
        }

        showToast({
          type: "error",
          title: "Could not load revision history",
          description: finalMessage,
        });
      } finally {
        if (!cancelled) {
          setDetailRevisionsLoading(false);
        }
      }
    };

    loadRevisions();

    return () => {
      cancelled = true;
    };
  }, [detailTicketId, showToast]);

  // ---------------------------------------------------------------------------
  // Detail ticket brief attachments load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!detailTicketId) {
      setDetailBriefAssets([]);
      setDetailBriefAssetsLoading(false);
      return;
    }

    let cancelled = false;

    const loadBriefAssets = async () => {
      setDetailBriefAssetsLoading(true);
      try {
        const res = await fetch(`/api/creative/tickets/${detailTicketId}/assets?kind=BRIEF_INPUT`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && Array.isArray((json as any)?.assets)) {
          setDetailBriefAssets(
            (json as any).assets.map((a: any) => ({
              id: a.id,
              url: a.url ?? null,
              originalName: a.originalName ?? null,
            })),
          );
        }
      } catch {
        // Silently fail — brief assets are supplementary
      } finally {
        if (!cancelled) setDetailBriefAssetsLoading(false);
      }
    };

    loadBriefAssets();

    return () => {
      cancelled = true;
    };
  }, [detailTicketId]);

  // ---------------------------------------------------------------------------
  // Persist status changes
  // ---------------------------------------------------------------------------

  const recomputeStats = (
    tickets: CreativeTicket[],
    prevStats: CreativeTicketsStats,
  ): CreativeTicketsStats => {
    const byStatus: Record<TicketStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
      // A cancelled ticket is by definition unassigned, so a creative
      // can never see one. Bucket exists only to satisfy the Record type.
      CANCELED: 0,
    };
    const byPriority: Record<TicketPriority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };

    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    }

    const total = tickets.length;
    const openTotal = total - (byStatus.DONE ?? 0);
    const loadScore = prevStats.loadScore;

    return {
      byStatus,
      byPriority,
      total,
      openTotal,
      loadScore,
    };
  };

  const getStatusSuccessMessage = (status: TicketStatus): string => {
    switch (status) {
      case "IN_PROGRESS":
        return "Request moved to In progress.";
      case "IN_REVIEW":
        return "Request sent to your customer for review.";
      case "TODO":
        return "Request moved back to backlog.";
      case "DONE":
        return "Request marked as done.";
      default:
        return "Request status updated.";
    }
  };

  const persistTicketStatus = async (
    ticketId: string,
    status: TicketStatus,
    options?: { creativeMessage?: string | null },
  ): Promise<{ revisionId?: string } | null> => {
    setMutationError(null);
    setUpdatingTicketId(ticketId);
    try {
      const res = await fetch("/api/creative/tickets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: ticketId,
          status,
          creativeMessage:
            options && typeof options.creativeMessage !== "undefined"
              ? options.creativeMessage
              : null,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You need to sign in as a creative.");
        }
        if (res.status === 403) {
          throw new Error(json?.error || "You do not have permission to update this request.");
        }
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData((prev) => {
        if (!prev) return prev;
        const nextTickets = prev.tickets.map((t) => (t.id === ticketId ? { ...t, status } : t));
        return {
          ...prev,
          tickets: nextTickets,
          stats: recomputeStats(nextTickets, prev.stats),
        };
      });

      const timerNote = autoTimerMessage(json?.timer);
      showToast({
        type: "success",
        title: "Request updated",
        description: timerNote
          ? `${getStatusSuccessMessage(status)} ${timerNote}`
          : getStatusSuccessMessage(status),
      });

      return { revisionId: json?.revisionId ?? undefined };
    } catch (err: unknown) {
      console.error("[CreativeBoard] status update error", err);
      const message = err instanceof Error ? err.message : "Failed to update request status.";
      setMutationError(message);

      showToast({
        type: "error",
        title: "Could not update request",
        description: message,
      });

      await load();
      return null;
    } finally {
      setUpdatingTicketId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const tickets = data?.tickets ?? [];

  const changesRequestedCount = useMemo(
    () => tickets.filter((t) => t.latestRevisionHasFeedback).length,
    [tickets],
  );

  /** Projects with ticket counts for the project filter */
  const projectsWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    tickets.forEach((t) => {
      const name = t.project?.name;
      if (name) map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (projectFilter !== "ALL" && t.project?.name !== projectFilter) {
        return false;
      }

      if (onlyChangesRequested && !t.latestRevisionHasFeedback) {
        return false;
      }

      const q = search.trim().toLowerCase();
      if (q) {
        const haystack = [
          ticketCode(t),
          t.title,
          t.description ?? "",
          t.company?.name ?? "",
          t.project?.name ?? "",
          t.jobType?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [tickets, projectFilter, search, onlyChangesRequested]);

  const ticketsByStatus = useMemo(() => {
    const map: Record<TicketStatus, CreativeTicket[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
      // A cancelled ticket is by definition unassigned, so creatives
      // never see one. Bucket exists only to satisfy the Record type.
      CANCELED: [],
    };

    filteredTickets.forEach((t) => {
      map[t.status].push(t);
    });

    return map;
  }, [filteredTickets]);

  const detailTicket = useMemo(() => {
    if (!detailTicketId) return null;
    return tickets.find((t) => t.id === detailTicketId) ?? null;
  }, [detailTicketId, tickets]);

  // ---------------------------------------------------------------------------
  // Drag & drop rules
  // ---------------------------------------------------------------------------

  type DropDecision = {
    allowed: boolean;
    reason?: string;
  };

  const canDropTicketToStatus = (
    ticket: CreativeTicket,
    targetStatus: TicketStatus,
  ): DropDecision => {
    if (ticket.status === targetStatus) {
      return { allowed: true };
    }

    if (ticket.status === "TODO") {
      if (targetStatus === "IN_PROGRESS") {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "You can only start a backlog request by moving it into In progress.",
      };
    }

    if (ticket.status === "IN_PROGRESS") {
      if (targetStatus === "IN_REVIEW") {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason:
          "From In progress you can either keep working here or move the request into In review.",
      };
    }

    if (ticket.status === "IN_REVIEW") {
      if (targetStatus === "IN_PROGRESS") {
        return {
          allowed: true,
        };
      }
      return {
        allowed: false,
        reason:
          "From In review you can move the request back to In progress if more work is needed.",
      };
    }

    if (ticket.status === "DONE") {
      return {
        allowed: false,
        reason: "This request is already completed. The customer controls Done requests.",
      };
    }

    return {
      allowed: false,
      reason: "This move is not allowed.",
    };
  };

  // ---------------------------------------------------------------------------
  // Bulk selection helpers
  // ---------------------------------------------------------------------------

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedTicketIds(new Set());
  }, []);

  const toggleTicketSelection = useCallback((ticketId: string) => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  }, []);

  const selectAllInColumn = useCallback(
    (status: TicketStatus) => {
      const columnTickets = (ticketsByStatus[status] ?? []).filter((t) => t.status !== "DONE");
      setSelectedTicketIds((prev) => {
        const next = new Set(prev);
        for (const t of columnTickets) next.add(t.id);
        return next;
      });
    },
    [ticketsByStatus],
  );

  // Compute valid bulk target statuses from currently selected tickets
  const bulkTargetStatuses = useMemo(() => {
    if (selectedTicketIds.size === 0) return [] as string[];
    const selectedTickets = tickets.filter((t) => selectedTicketIds.has(t.id));
    const targets: string[] = [];

    // Only In progress work can go back to Backlog; the server refuses In review.
    if (selectedTickets.some((t) => t.status === "IN_PROGRESS")) targets.push("TODO");
    // Can move to IN_PROGRESS if any selected ticket is not already IN_PROGRESS
    if (selectedTickets.some((t) => t.status !== "IN_PROGRESS" && t.status !== "DONE"))
      targets.push("IN_PROGRESS");

    return targets;
  }, [selectedTicketIds, tickets]);

  const handleBulkStatusChange = async (targetStatus: string) => {
    if (selectedTicketIds.size === 0 || bulkUpdating) return;

    setBulkUpdating(true);

    try {
      const res = await fetch("/api/creative/tickets/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketIds: [...selectedTicketIds],
          status: targetStatus,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        showToast({
          type: "error",
          title: "Bulk update failed",
          description: (json as any)?.error ?? "Something went wrong.",
        });
        return;
      }

      const { successCount, failCount } = json as {
        successCount: number;
        failCount: number;
      };

      if (successCount > 0) {
        // Optimistically update board data
        setData((prev) => {
          if (!prev) return prev;
          const successIds = new Set(
            ((json as any).results as { ticketId: string; success: boolean }[])
              .filter((r) => r.success)
              .map((r) => r.ticketId),
          );
          return {
            ...prev,
            tickets: prev.tickets.map((t) =>
              successIds.has(t.id)
                ? {
                    ...t,
                    status: targetStatus as TicketStatus,
                    updatedAt: new Date().toISOString(),
                  }
                : t,
            ),
          };
        });

        const statusLabel = targetStatus.replace("_", " ").toLowerCase();
        showToast({
          type: failCount > 0 ? "warning" : "success",
          title:
            failCount > 0
              ? `${successCount} request${successCount > 1 ? "s" : ""} moved, ${failCount} failed`
              : `${successCount} request${successCount > 1 ? "s" : ""} moved to ${statusLabel}`,
          description:
            failCount > 0
              ? "Some requests could not be updated due to restrictions."
              : targetStatus === "IN_PROGRESS"
                ? (autoTimerMessage((json as any).timer) ??
                  (successCount > 1 ? MULTI_START_TIMER_HINT : undefined))
                : undefined,
        });
      } else {
        showToast({
          type: "error",
          title: "No requests updated",
          description: "All selected requests could not be moved.",
        });
      }

      exitSelectionMode();
    } catch (err) {
      console.error("[CreativeBoard] bulk update error", err);
      showToast({
        type: "error",
        title: "Bulk update failed",
        description: "Please try again.",
      });
    } finally {
      setBulkUpdating(false);
    }
  };

  // Escape key exits selection mode
  useEffect(() => {
    if (!selectionMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitSelectionMode();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectionMode, exitSelectionMode]);

  // ---------------------------------------------------------------------------
  // Drag-and-drop handlers
  // ---------------------------------------------------------------------------

  const handleDragStart = (
    event: React.DragEvent<HTMLElement>,
    ticketId: string,
    ticketStatus: TicketStatus,
  ) => {
    if (ticketStatus === "DONE" || updatingTicketId === ticketId) {
      event.preventDefault();
      return;
    }

    setDraggingTicketId(ticketId);
    setMutationError(null);
    setMouseDownInfo(null);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", ticketId);
    }
  };

  const handleDragEnd = () => {
    setDraggingTicketId(null);
    setDragOverStatus(null);
  };

  const handleColumnDragOver = (event: React.DragEvent<HTMLElement>, status: TicketStatus) => {
    if (!draggingTicketId) return;

    const ticket = tickets.find((t) => t.id === draggingTicketId);
    if (!ticket) return;

    event.preventDefault();

    const decision = canDropTicketToStatus(ticket, status);

    if (!decision.allowed) {
      if (dragOverStatus !== null) {
        setDragOverStatus(null);
      }
      return;
    }

    if (dragOverStatus !== status) {
      setDragOverStatus(status);
    }
  };

  const handleColumnDrop = async (event: React.DragEvent<HTMLElement>, status: TicketStatus) => {
    event.preventDefault();

    if (!draggingTicketId) {
      setDragOverStatus(null);
      return;
    }

    const ticket = tickets.find((t) => t.id === draggingTicketId);
    setDraggingTicketId(null);
    setDragOverStatus(null);

    if (!ticket) return;

    const decision = canDropTicketToStatus(ticket, status);

    if (!decision.allowed) {
      if (decision.reason) {
        setMutationError(decision.reason);

        showToast({
          type: "warning",
          title: "This move is not allowed",
          description: decision.reason,
        });
      }
      return;
    }

    if (ticket.status === status) {
      return;
    }

    // IN_PROGRESS -> IN_REVIEW: open modal first, collect creative note
    if (ticket.status === "IN_PROGRESS" && status === "IN_REVIEW") {
      setReviewModal({ ticket, targetStatus: status });
      setCreativeNote("");
      return;
    }

    // All other transitions: persist immediately
    await persistTicketStatus(ticket.id, status);
  };

  // ---------------------------------------------------------------------------
  // Detail modal helpers
  // ---------------------------------------------------------------------------

  const openTicketDetails = (ticket: CreativeTicket) => {
    setDetailTab(initialDetailTab(ticket));
    setDetailTicketId(ticket.id);
  };

  const closeTicketDetails = () => {
    setDetailTicketId(null);
    setDetailRevisions(null);
    setDetailRevisionsError(null);
    setDetailRevisionsLoading(false);
    setDetailBriefAssets([]);
    setDetailBriefAssetsLoading(false);
  };

  const closeReviewModal = () => {
    if (reviewUploading) return; // prevent close during upload
    setReviewModal(null);
    setCreativeNote("");
    setReviewFiles([]);
    setReviewUploading(false);
    setReviewUploadProgress(null);
  };

  const handleAddReviewFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Reject bad files here, before "Upload & send" creates the version —
    // otherwise the customer gets a version whose files then fail to upload.
    const all = Array.from(files);
    const wrongType = all.filter((f) => !isOutputMimeAllowed(f.type));
    const tooBig = all.filter((f) => isOutputMimeAllowed(f.type) && validateFileSize(f));
    const incoming = all.filter((f) => isOutputMimeAllowed(f.type) && !validateFileSize(f));
    if (wrongType.length > 0 || tooBig.length > 0) {
      showToast({
        type: "warning",
        title: "Some files weren't added",
        description: [
          wrongType.length > 0 ? `${wrongType.length} not an image or PDF` : null,
          tooBig.length > 0 ? `${tooBig.length} larger than 4 MB` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
    setReviewFiles((prev) => {
      const room = Math.max(0, MAX_REVIEW_FILES - prev.length);
      return [
        ...prev,
        ...incoming.slice(0, room).map((file) => ({
          id: crypto.randomUUID(),
          file,
        })),
      ];
    });
  };

  const handleRemoveReviewFile = (id: string) => {
    setReviewFiles((prev) => prev.filter((x) => x.id !== id));
  };

  const handleConfirmReviewWithNote = async () => {
    if (!reviewModal) return;
    const { ticket, targetStatus } = reviewModal;

    // Step 1: Persist status transition (creates revision, returns revisionId)
    const result = await persistTicketStatus(ticket.id, targetStatus, {
      creativeMessage: data?.revisionNotesEnabled ? creativeNote.trim() || null : null,
    });

    // If PATCH failed or no files to upload, just close
    if (!result?.revisionId || reviewFiles.length === 0) {
      closeReviewModal();
      return;
    }

    // Step 2: Upload files sequentially
    setReviewUploading(true);
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < reviewFiles.length; i++) {
      const entry = reviewFiles[i];
      setReviewUploadProgress(`Uploading file ${i + 1} of ${reviewFiles.length}...`);

      try {
        const dims = await getImageDimensions(entry.file);

        const body = new FormData();
        body.append("file", entry.file);
        body.append("ticketId", ticket.id);
        body.append("kind", "OUTPUT_IMAGE");
        body.append("revisionId", result.revisionId);
        if (dims?.width) body.append("width", String(dims.width));
        if (dims?.height) body.append("height", String(dims.height));

        const res = await fetch("/api/uploads/r2/upload", {
          method: "POST",
          body,
        });
        if (!res.ok) {
          failed++;
          continue;
        }
        succeeded++;
      } catch {
        failed++;
      }
    }

    setReviewUploading(false);
    setReviewUploadProgress(null);

    if (failed > 0 && succeeded > 0) {
      showToast({
        type: "warning",
        title: "Some uploads failed",
        description: `${succeeded} of ${reviewFiles.length} file(s) uploaded.`,
      });
    } else if (failed > 0 && succeeded === 0) {
      showToast({
        type: "error",
        title: "Upload failed",
        description: "Files could not be uploaded, but the revision was created.",
      });
    }

    // Force-reset upload state, then close
    setReviewUploading(false);
    setReviewUploadProgress(null);
    setReviewModal(null);
    setCreativeNote("");
    setReviewFiles([]);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const filtersActive = projectFilter !== "ALL" || onlyChangesRequested || search.trim() !== "";

  return (
    <>
      <PageHeader
        title="Your assigned work"
        description="Requests currently assigned to you across all customer projects."
      />

      <PauseBanner />

      {error && (
        <div className="mb-4">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}

      {mutationError && (
        <div className="mb-4">
          <Callout tone="warning" title="That request didn't move">
            {mutationError}
          </Callout>
        </div>
      )}

      {/* Filters. The project filter used to be a second sidebar. */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-56">
          <Select
            aria-label="Filter by project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="ALL">All projects ({tickets.length})</option>
            {projectsWithCounts.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} ({p.count})
              </option>
            ))}
          </Select>
        </div>

        <div ref={searchWrapRef} className="min-w-full flex-1 sm:min-w-[220px]">
          <SearchInput
            label="Search board"
            placeholder="Search board"
            value={search}
            onChange={setSearch}
          />
        </div>

        <button
          type="button"
          aria-pressed={onlyChangesRequested}
          onClick={() => setOnlyChangesRequested((prev: boolean) => !prev)}
          className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none ${
            onlyChangesRequested
              ? "border-[var(--av2-accent)] bg-[var(--av2-selected)]"
              : "border-[var(--av2-border)] bg-[var(--av2-surface)] hover:bg-[var(--av2-bg)]"
          }`}
        >
          <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--av2-fill-amber)]" />
          Changes requested
          <Badge className="tabular-nums">{fmt(changesRequestedCount)}</Badge>
        </button>

        <Button
          aria-pressed={selectionMode}
          onClick={() => {
            if (selectionMode) {
              exitSelectionMode();
            } else {
              setSelectionMode(true);
            }
          }}
        >
          <IconCheckSquare />
          <span>{selectionMode ? "Cancel" : "Select"}</span>
        </Button>

        {/* Taller segments than the shared default: 40px targets. */}
        <div className="sm:ml-auto [&_a]:h-10 [&>div]:p-0">
          <SegmentedControl label="Board view" value="board" options={VIEW_OPTIONS} />
        </div>
      </div>

      {loading && !data ? (
        <div
          aria-busy="true"
          aria-label="Loading your board"
          className="grid auto-cols-[minmax(288px,1fr)] grid-flow-col gap-4 overflow-x-auto"
        >
          {STATUS_ORDER.map((status) => (
            <Skeleton key={status} className="h-[560px] rounded-2xl" />
          ))}
        </div>
      ) : data ? (
        <>
          <div
            aria-busy={loading}
            // relative: keeps the cards' sr-only text inside this scroller, not the page's width.
            className="relative grid snap-x snap-mandatory auto-cols-[minmax(288px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-2 md:snap-none"
          >
            {STATUS_ORDER.map((status) => {
              const columnTickets = ticketsByStatus[status] ?? [];
              const label = TICKET_STATUS[status].label;
              const headingId = `creative-board-column-${status}`;
              const isActiveDrop = dragOverStatus === status && !!draggingTicketId;
              const empty = COLUMN_EMPTY[status];

              return (
                <section
                  key={status}
                  aria-labelledby={headingId}
                  className={`flex min-h-[560px] snap-start flex-col overflow-hidden rounded-2xl border transition-colors ${
                    isActiveDrop
                      ? "border-[var(--av2-accent)] bg-[var(--av2-selected)]"
                      : "border-[var(--av2-border)] bg-[var(--av2-bg)]"
                  }`}
                  onDragOver={(event) => handleColumnDragOver(event, status)}
                  onDrop={(event) => handleColumnDrop(event, status)}
                >
                  <div
                    className="flex min-h-14 items-center gap-2 px-4"
                    style={{ background: COLUMN_TINT[status] }}
                  >
                    <h2 id={headingId} className="text-lg leading-6 font-semibold">
                      {label}
                    </h2>
                    <span className="rounded-full bg-[var(--av2-surface)] px-2 text-sm font-medium tabular-nums">
                      {columnTickets.length}
                    </span>
                    {selectionMode && status !== "DONE" && columnTickets.length > 0 && (
                      <Button
                        variant="ghost"
                        className="ml-auto px-2!"
                        onClick={() => selectAllInColumn(status)}
                      >
                        Select all
                        <span className="sr-only"> in {label}</span>
                      </Button>
                    )}
                  </div>

                  <div className="flex-1 space-y-3 p-3">
                    {columnTickets.map((t) => {
                      const isUpdating = updatingTicketId === t.id;
                      return (
                        <JobCard
                          key={t.id}
                          ticket={t}
                          selectionMode={selectionMode}
                          isSelected={selectedTicketIds.has(t.id)}
                          isDragging={draggingTicketId === t.id}
                          isUpdating={isUpdating}
                          canDrag={!selectionMode && t.status !== "DONE" && !isUpdating}
                          onOpen={() => openTicketDetails(t)}
                          onToggleSelect={() => toggleTicketSelection(t.id)}
                          onDragStart={(event) => handleDragStart(event, t.id, t.status)}
                          onDragEnd={handleDragEnd}
                          onMouseDown={(e) => {
                            if (selectionMode) return;
                            setMouseDownInfo({
                              ticketId: t.id,
                              x: e.clientX,
                              y: e.clientY,
                              time: Date.now(),
                            });
                          }}
                          onMouseUp={(e) => {
                            if (selectionMode) return;
                            if (!mouseDownInfo) return;
                            const dx = e.clientX - mouseDownInfo.x;
                            const dy = e.clientY - mouseDownInfo.y;
                            const dt = Date.now() - mouseDownInfo.time;
                            setMouseDownInfo(null);
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            if (distance < 5 && dt < 400 && !draggingTicketId) {
                              openTicketDetails(t);
                            }
                          }}
                          onClick={() => {
                            if (selectionMode && t.status !== "DONE") {
                              toggleTicketSelection(t.id);
                            }
                          }}
                        />
                      );
                    })}

                    {isActiveDrop && (
                      <div className="flex h-16 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--av2-accent)] text-sm font-medium text-[var(--av2-text-2)]">
                        Drop here
                      </div>
                    )}

                    {columnTickets.length === 0 && !isActiveDrop && (
                      <EmptyState
                        icon={<IconDocument width={24} height={24} />}
                        title={filtersActive ? "No matching requests." : empty.title}
                        description={
                          filtersActive
                            ? "Try another project, search or filter."
                            : empty.description
                        }
                      />
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <p role="status" className="mt-4 text-sm text-[var(--av2-text-2)]">
            Showing {fmt(filteredTickets.length)} of {fmt(tickets.length)}{" "}
            {plural(tickets.length, "request", "requests")}
          </p>
        </>
      ) : null}

      {/* Floating bulk action bar */}
      {selectionMode && selectedTicketIds.size > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="fixed inset-x-4 bottom-4 z-40 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-3 shadow-lg sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:flex-nowrap"
        >
          <span className="px-2 text-sm font-semibold whitespace-nowrap">
            {selectedTicketIds.size} {plural(selectedTicketIds.size, "request", "requests")}{" "}
            selected
          </span>

          {bulkTargetStatuses.includes("TODO") && (
            <Button disabled={bulkUpdating} onClick={() => handleBulkStatusChange("TODO")}>
              {bulkUpdating ? "Moving…" : "Move to Backlog"}
            </Button>
          )}

          {bulkTargetStatuses.includes("IN_PROGRESS") && (
            <Button
              variant="primary"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatusChange("IN_PROGRESS")}
            >
              {bulkUpdating ? "Moving…" : "Start working"}
            </Button>
          )}

          <Button variant="ghost" onClick={exitSelectionMode}>
            Cancel
          </Button>
        </div>
      )}

      <TicketDetailDialog
        ticket={detailTicket}
        tab={detailTab}
        onTabChange={setDetailTab}
        onClose={closeTicketDetails}
        revisions={detailRevisions}
        revisionsLoading={detailRevisionsLoading}
        revisionsError={detailRevisionsError}
        briefAssets={detailBriefAssets}
        briefAssetsLoading={detailBriefAssetsLoading}
        updating={!!detailTicket && updatingTicketId === detailTicket.id}
        onUploadWork={() => {
          if (!detailTicket) return;
          closeTicketDetails();
          setReviewModal({ ticket: detailTicket, targetStatus: "IN_REVIEW" });
        }}
        onPullBack={async () => {
          if (!detailTicket) return;
          await persistTicketStatus(detailTicket.id, "IN_PROGRESS");
          closeTicketDetails();
        }}
      />

      <UploadWorkDialog
        open={!!reviewModal}
        ticketTitle={reviewModal?.ticket.title ?? ""}
        files={reviewFiles}
        maxFiles={MAX_REVIEW_FILES}
        note={creativeNote}
        notesEnabled={!!data?.revisionNotesEnabled}
        uploading={reviewUploading}
        sending={!!reviewModal && updatingTicketId === reviewModal.ticket.id}
        progress={reviewUploadProgress}
        onNoteChange={setCreativeNote}
        onAddFiles={handleAddReviewFiles}
        onRemoveFile={handleRemoveReviewFile}
        onClose={closeReviewModal}
        onConfirm={handleConfirmReviewWithNote}
      />
    </>
  );
}
