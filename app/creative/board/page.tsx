// -----------------------------------------------------------------------------
// @file: app/creative/board/page.tsx
// @purpose: Creative-facing kanban board for assigned tickets with revision
//           indicators, filters, notes, toasts, and Figma redesign
// @version: v2.0.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type PendingFile, getImageDimensions } from "@/lib/upload-helpers";
import { useToast } from "@/components/ui/toast-provider";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PauseBanner } from "@/components/creative/pause-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { RevisionImageGrid, RevisionImageLarge, DownloadAllButton, BriefThumbnailRow } from "@/components/ui/revision-image";
import { Button } from "@/components/ui/button";
import { SafeHtml, stripHtml } from "@/components/ui/safe-html";
import {
  STATUS_ORDER,
  STATUS_LABELS,
  formatBoardDate,
  formatPriorityLabel,
  priorityBadgeVariant,
  columnAccentColor,
  PROJECT_COLORS,
  avatarColor,
  getInitials,
  priorityIconMap,
  priorityColorClass,
  formatDueDateShort,
  isDueDateOverdue,
  formatDueDateCountdown,
  BOARD_COLUMN_HEADER,
} from "@/lib/board";
import type { TicketStatus, TicketPriority } from "@/lib/board";

type CreativeTicket = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  dueDate: string | null;
  companyTicketNumber: number | null;
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  project: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  jobType: {
    id: string;
    name: string;
    tokenCost: number;
    creativePayoutTokens: number;
  } | null;
  revisionCount: number;
  latestRevisionHasFeedback: boolean;
  latestRevisionFeedbackSnippet: string | null;
};

type CreativeTicketsStats = {
  byStatus: Record<TicketStatus, number>;
  total: number;
  openTotal: number;
  byPriority: Record<TicketPriority, number>;
  loadScore: number;
};

type CreativeTicketsResponse = {
  stats: CreativeTicketsStats;
  tickets: CreativeTicket[];
};

type RevisionAsset = {
  id: string;
  url: string | null;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
  pinCount?: number;
  openPins?: number;
  resolvedPins?: number;
};

type TicketRevisionEntry = {
  version: number;
  submittedAt: string | null;
  feedbackAt: string | null;
  feedbackMessage: string | null;
  creativeMessage?: string | null;
  assets?: RevisionAsset[];
};



export default function CreativeBoardPage() {
  const { showToast } = useToast();

  const [data, setData] = useState<CreativeTicketsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [onlyChangesRequested, setOnlyChangesRequested] =
    useState<boolean>(false);

  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] =
    useState<TicketStatus | null>(null);

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

  const [detailRevisions, setDetailRevisions] = useState<
    TicketRevisionEntry[] | null
  >(null);
  const [detailRevisionsLoading, setDetailRevisionsLoading] =
    useState<boolean>(false);
  const [detailRevisionsError, setDetailRevisionsError] = useState<
    string | null
  >(null);
  const [showPreviousVersions, setShowPreviousVersions] = useState(false);

  // Brief attachments state
  type BriefAsset = { id: string; url: string | null; originalName: string | null };
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
  const searchRef = useRef<HTMLInputElement>(null);
  const MAX_REVIEW_FILES = 10;

  // ---------------------------------------------------------------------------
  // Data load
  // ---------------------------------------------------------------------------

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/creative/tickets", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You need to sign in as a creative.");
        }
        if (res.status === 403) {
          throw new Error(
            json?.error ||
              "You do not have access to creative tickets in this workspace.",
          );
        }
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData(json as CreativeTicketsResponse);
    } catch (err: unknown) {
      console.error("[CreativeBoard] load error", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load creative tickets.";
      setError(message);

      showToast({
        type: "error",
        title: "Could not load your tickets",
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

  // ---------------------------------------------------------------------------
  // "/" keyboard shortcut — focus the search bar
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
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
        const res = await fetch(
          `/api/creative/tickets/${detailTicketId}/revisions`,
          {
            cache: "no-store",
          },
        );

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const message =
            (json &&
              typeof json === "object" &&
              "error" in json &&
              (json as any).error) ||
            `Failed to load revision history (status ${res.status}).`;

          const finalMessage =
            typeof message === "string"
              ? message
              : "Failed to load revision history.";

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

        const entries = ((json as any)?.revisions ??
          []) as TicketRevisionEntry[];
        if (!cancelled) {
          setDetailRevisions(entries);
        }
      } catch (err) {
        console.error(
          "[CreativeBoard] failed to load ticket revision history",
          err,
        );
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
        const res = await fetch(
          `/api/creative/tickets/${detailTicketId}/assets?kind=BRIEF_INPUT`,
          { cache: "no-store" },
        );
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
        return "Ticket moved to In progress.";
      case "IN_REVIEW":
        return "Ticket sent to your customer for review.";
      case "TODO":
        return "Ticket moved back to backlog.";
      case "DONE":
        return "Ticket marked as done.";
      default:
        return "Ticket status updated.";
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
          throw new Error(
            json?.error ||
              "You do not have permission to update this ticket.",
          );
        }
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData((prev) => {
        if (!prev) return prev;
        const nextTickets = prev.tickets.map((t) =>
          t.id === ticketId ? { ...t, status } : t,
        );
        return {
          ...prev,
          tickets: nextTickets,
          stats: recomputeStats(nextTickets, prev.stats),
        };
      });

      showToast({
        type: "success",
        title: "Ticket updated",
        description: getStatusSuccessMessage(status),
      });

      return { revisionId: json?.revisionId ?? undefined };
    } catch (err: unknown) {
      console.error("[CreativeBoard] status update error", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update ticket status.";
      setMutationError(message);

      showToast({
        type: "error",
        title: "Could not update ticket",
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
  const stats = data?.stats ?? null;

  const changesRequestedCount = useMemo(
    () => tickets.filter((t) => t.latestRevisionHasFeedback).length,
    [tickets],
  );

  const projects = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => {
      if (t.project?.name) set.add(t.project.name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tickets]);

  /** Projects with ticket counts for sidebar */
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

  /** Unique companies for toolbar avatars */
  const uniqueCompanies = useMemo(() => {
    const seen = new Map<string, string>();
    tickets.forEach((t) => {
      if (t.company && !seen.has(t.company.id)) {
        seen.set(t.company.id, t.company.name);
      }
    });
    return Array.from(seen.values());
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
        const code =
          t.project?.code && t.companyTicketNumber != null
            ? `${t.project.code}-${t.companyTicketNumber}`
            : t.companyTicketNumber != null
            ? `#${t.companyTicketNumber}`
            : t.id;

        const haystack = [
          code,
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
        reason:
          "You can only start a backlog ticket by moving it into In progress.",
      };
    }

    if (ticket.status === "IN_PROGRESS") {
      if (targetStatus === "IN_REVIEW") {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason:
          "From In progress you can either keep working here or move the ticket into In review.",
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
          "From In review you can move the ticket back to In progress if more work is needed.",
      };
    }

    if (ticket.status === "DONE") {
      return {
        allowed: false,
        reason:
          "This request is already completed. The customer controls Done tickets.",
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
      const columnTickets = (ticketsByStatus[status] ?? []).filter(
        (t) => t.status !== "DONE",
      );
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

    // Can move to TODO if any selected ticket is not already TODO
    if (selectedTickets.some((t) => t.status !== "TODO" && t.status !== "DONE"))
      targets.push("TODO");
    // Can move to IN_PROGRESS if any selected ticket is not already IN_PROGRESS
    if (
      selectedTickets.some(
        (t) => t.status !== "IN_PROGRESS" && t.status !== "DONE",
      )
    )
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
          description:
            (json as any)?.error ?? "Something went wrong.",
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
                ? { ...t, status: targetStatus as TicketStatus, updatedAt: new Date().toISOString() }
                : t,
            ),
          };
        });

        const statusLabel = targetStatus.replace("_", " ").toLowerCase();
        showToast({
          type: failCount > 0 ? "warning" : "success",
          title:
            failCount > 0
              ? `${successCount} ticket${successCount > 1 ? "s" : ""} moved, ${failCount} failed`
              : `${successCount} ticket${successCount > 1 ? "s" : ""} moved to ${statusLabel}`,
          description:
            failCount > 0
              ? "Some tickets could not be updated due to restrictions."
              : undefined,
        });
      } else {
        showToast({
          type: "error",
          title: "No tickets updated",
          description: "All selected tickets could not be moved.",
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
    event: React.DragEvent<HTMLDivElement>,
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

  const handleColumnDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    status: TicketStatus,
  ) => {
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

  const handleColumnDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    status: TicketStatus,
  ) => {
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

  const closeTicketDetails = () => {
    setDetailTicketId(null);
    setDetailRevisions(null);
    setDetailRevisionsError(null);
    setDetailRevisionsLoading(false);
    setShowPreviousVersions(false);
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
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
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
      creativeMessage: creativeNote.trim() || null,
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
        // Presign
        const presignRes = await fetch("/api/uploads/r2/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId: ticket.id,
            kind: "OUTPUT_IMAGE",
            revisionId: result.revisionId,
            contentType: entry.file.type || "application/octet-stream",
            bytes: entry.file.size,
            originalName: entry.file.name,
          }),
        });
        const presignJson = await presignRes.json().catch(() => null);
        if (!presignRes.ok || !presignJson?.uploadUrl || !presignJson?.storageKey) {
          failed++;
          continue;
        }

        // PUT to R2
        const putRes = await fetch(presignJson.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": entry.file.type || "application/octet-stream" },
          body: entry.file,
        });
        if (!putRes.ok) {
          failed++;
          continue;
        }

        // Register
        const dims = await getImageDimensions(entry.file);
        const registerRes = await fetch("/api/assets/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId: ticket.id,
            kind: "OUTPUT_IMAGE",
            revisionId: result.revisionId,
            storageKey: presignJson.storageKey,
            mimeType: entry.file.type || "application/octet-stream",
            bytes: entry.file.size,
            width: dims?.width ?? null,
            height: dims?.height ?? null,
            originalName: entry.file.name,
          }),
        });
        if (!registerRes.ok) {
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

  const activeProjectTitle =
    projectFilter === "ALL" ? "All projects" : projectFilter;

  return (
    <>
      <div className="mt-4 grid gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr]">
          {/* Left workspace rail (creative-specific) */}
          <aside className="flex flex-col rounded-2xl bg-[var(--bb-bg-page)]/60 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bb-text-muted)]">
                Workspace
              </p>
              <h2 className="mt-2 text-sm font-semibold text-[var(--bb-secondary)]">
                Your assigned work
              </h2>
              <p className="mt-1 text-[11px] text-[var(--bb-text-secondary)]">
                Tickets currently assigned to you across all customer projects.
              </p>
            </div>

            {/* Projects list */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">
                  Projects
                </p>
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setProjectFilter("ALL")}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors ${
                    projectFilter === "ALL"
                      ? "bg-[var(--bb-bg-card)] font-semibold text-[var(--bb-secondary)]"
                      : "text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-card)]/60"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#9CA3AF] text-[9px] font-bold text-white">
                    All
                  </span>
                  <span className="flex-1 truncate">All projects</span>
                  <span className="text-[10px] text-[var(--bb-text-muted)]">{stats?.total ?? 0}</span>
                </button>
                {projectsWithCounts.map((p, i) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() =>
                      setProjectFilter(projectFilter === p.name ? "ALL" : p.name)
                    }
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors ${
                      projectFilter === p.name
                        ? "bg-[var(--bb-bg-card)] font-semibold text-[var(--bb-secondary)]"
                        : "text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-card)]/60"
                    }`}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
                      style={{
                        backgroundColor:
                          PROJECT_COLORS[i % PROJECT_COLORS.length],
                      }}
                    >
                      {p.name[0]?.toUpperCase()}
                    </span>
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] text-[var(--bb-text-muted)]">{p.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="my-3 border-t border-[var(--bb-border-subtle)]" />

            {/* Stats */}
            <div className="space-y-2">
              <div className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--bb-secondary)]">
                      All requests
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--bb-text-tertiary)]">
                      Your active creative workspace.
                    </p>
                  </div>
                  {stats && (
                    <span className="rounded-full bg-[var(--bb-bg-page)] px-3 py-1 text-[11px] font-semibold text-[var(--bb-secondary)]">
                      {stats.total}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-[var(--bb-bg-card)] px-3 py-2 text-[10px] text-[var(--bb-text-secondary)]">
                <p>
                  Changes requested:{" "}
                  <span className="font-semibold">
                    {changesRequestedCount}
                  </span>
                </p>
              </div>
            </div>

          </aside>

          {/* Main board area */}
          <main className="flex flex-col">
            {/* Header */}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bb-text-muted)]">
                  Creative board
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  {activeProjectTitle}
                </h1>
              </div>
              {loading && (
                <div className="rounded-full bg-[var(--bb-bg-card)] px-3 py-1 text-[11px] text-[var(--bb-text-secondary)]">
                  Loading tickets…
                </div>
              )}
            </div>

            {/* Pause banner */}
            <PauseBanner />

            {error && (
              <InlineAlert variant="error" title="Something went wrong" className="mb-4">
                {error}
              </InlineAlert>
            )}

            {mutationError && (
              <InlineAlert variant="warning" className="mb-4">
                {mutationError}
              </InlineAlert>
            )}

            {/* Toolbar: search + company avatars + changes requested toggle */}
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative max-w-md flex-1">
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search board"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-2 text-xs text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
                />
              </div>

              {/* Company avatar circles */}
              {uniqueCompanies.length > 0 && (
                <div className="flex items-center -space-x-1.5">
                  {uniqueCompanies.slice(0, 5).map((name, i) => (
                    <div
                      key={i}
                      title={name}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white"
                      style={{ backgroundColor: avatarColor(name) }}
                    >
                      {getInitials(name, null)}
                    </div>
                  ))}
                  {uniqueCompanies.length > 5 && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--bb-border)] text-[9px] font-bold text-[var(--bb-text-secondary)]">
                      +{uniqueCompanies.length - 5}
                    </div>
                  )}
                </div>
              )}

              {/* Changes requested toggle */}
              <button
                type="button"
                onClick={() =>
                  setOnlyChangesRequested((prev: boolean) => !prev)
                }
                className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  onlyChangesRequested
                    ? "border-[var(--bb-primary)] bg-[var(--bb-primary-light)] text-[var(--bb-primary-hover)]"
                    : "border-[var(--bb-border)] bg-[var(--bb-bg-page)] text-[var(--bb-text-secondary)] hover:border-[var(--bb-primary)]/60"
                }`}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--bb-warning-text)]" />
                Changes requested
                <span className="rounded-full bg-black/5 px-1.5 text-xs font-semibold">
                  {changesRequestedCount}
                </span>
              </button>

              {/* Bulk select toggle */}
              <button
                type="button"
                onClick={() => {
                  if (selectionMode) {
                    exitSelectionMode();
                  } else {
                    setSelectionMode(true);
                  }
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  selectionMode
                    ? "border-[var(--bb-primary)] bg-[var(--bb-primary-light)] text-[var(--bb-primary-hover)]"
                    : "border-[var(--bb-border)] bg-[var(--bb-bg-page)] text-[var(--bb-text-secondary)] hover:border-[var(--bb-primary)]/60"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                {selectionMode ? "Cancel" : "Select"}
              </button>
            </div>

            {/* Columns */}
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:snap-none">
              {STATUS_ORDER.map((status) => {
                const columnTickets = ticketsByStatus[status] ?? [];
                const columnTitle = STATUS_LABELS[status];
                const isActiveDrop =
                  dragOverStatus === status && !!draggingTicketId;

                return (
                  <div
                    key={status}
                    className={`w-80 shrink-0 snap-start overflow-hidden rounded-2xl transition-colors ${
                      isActiveDrop
                        ? "bg-[var(--bb-primary-light)] ring-2 ring-[var(--bb-primary)]/60"
                        : "bg-[var(--bb-bg-page)]/60"
                    }`}
                    onDragOver={(event) => handleColumnDragOver(event, status)}
                    onDrop={(event) => handleColumnDrop(event, status)}
                  >
                    {/* Accent bar */}
                    <div
                      className="h-1"
                      style={{ backgroundColor: columnAccentColor[status] }}
                    />

                    <div className="p-2">
                      {/* Column header */}
                      <div className="mb-2 flex items-center gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bb-text-tertiary)]">
                          {columnTitle}
                        </span>
                        <span className="rounded-full bg-[var(--bb-bg-card)] px-2 py-0.5 text-[11px] font-semibold text-[var(--bb-text-secondary)]">
                          {columnTickets.length}
                        </span>
                        {selectionMode && status !== "DONE" && columnTickets.length > 0 && (
                          <button
                            type="button"
                            onClick={() => selectAllInColumn(status)}
                            className="ml-auto text-[10px] font-semibold text-[var(--bb-primary)] hover:underline"
                          >
                            Select all
                          </button>
                        )}
                      </div>

                      {/* Cards */}
                      <div className="space-y-2">
                        {columnTickets.length === 0 ? (
                          isActiveDrop ? (
                            <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-[var(--bb-primary)]/40 text-xs text-[var(--bb-primary)]/60">
                              Drop here
                            </div>
                          ) : (
                            <EmptyState title={status === "DONE" ? "Completed tickets will appear here." : "No tickets in this column."} />
                          )
                        ) : (
                          <>
                            {columnTickets.map((t) => {
                              const ticketCode =
                                t.project?.code && t.companyTicketNumber != null
                                  ? `${t.project.code}-${t.companyTicketNumber}`
                                  : t.companyTicketNumber != null
                                  ? `#${t.companyTicketNumber}`
                                  : t.id.slice(0, 8);

                              const isUpdating = updatingTicketId === t.id;
                              const isDragging = draggingTicketId === t.id;
                              const canDrag = !selectionMode && t.status !== "DONE" && !isUpdating;
                              const isSelected = selectedTicketIds.has(t.id);

                              const payoutTokens =
                                t.jobType?.creativePayoutTokens ??
                                t.jobType?.tokenCost ??
                                null;

                              const showRevisionBadge = t.revisionCount > 0;
                              const showFeedbackBadge = t.latestRevisionHasFeedback;

                              const companyLabel = t.company?.name ?? "—";
                              const dueDateLabel = formatDueDateShort(t.dueDate);
                              const overdue = isDueDateOverdue(t.dueDate);

                              return (
                                <div
                                  key={t.id}
                                  className={`cursor-pointer rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-3 shadow-sm transition-all duration-200 ${
                                    isSelected
                                      ? "ring-2 ring-[var(--bb-primary)] ring-offset-1"
                                      : isDragging
                                      ? "scale-[1.02] opacity-50 shadow-lg"
                                      : isUpdating
                                      ? "opacity-60"
                                      : "hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--bb-primary-border)]"
                                  }`}
                                  draggable={canDrag}
                                  onDragStart={(event) =>
                                    handleDragStart(event, t.id, t.status)
                                  }
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
                                    if (
                                      distance < 5 &&
                                      dt < 400 &&
                                      !draggingTicketId
                                    ) {
                                      setDetailTicketId(t.id);
                                    }
                                  }}
                                  onClick={() => {
                                    if (selectionMode && t.status !== "DONE") {
                                      toggleTicketSelection(t.id);
                                    }
                                  }}
                                >
                                  {/* Selection checkbox */}
                                  {selectionMode && t.status !== "DONE" && (
                                    <div className="mb-2 flex items-center gap-2">
                                      <div
                                        className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${
                                          isSelected
                                            ? "border-[var(--bb-primary)] bg-[var(--bb-primary)]"
                                            : "border-[var(--bb-border-input)] bg-[var(--bb-bg-page)]"
                                        }`}
                                      >
                                        {isSelected && (
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-[var(--bb-text-tertiary)]">
                                        {isSelected ? "Selected" : "Select"}
                                      </span>
                                    </div>
                                  )}

                                  {/* Title */}
                                  <p className="text-sm font-semibold leading-snug text-[var(--bb-secondary)]">
                                    {t.title}
                                  </p>

                                  {/* Description */}
                                  {t.description && (
                                    <p className="mt-1 line-clamp-2 text-xs text-[var(--bb-text-secondary)]">
                                      {stripHtml(t.description)}
                                    </p>
                                  )}

                                  {/* Due date pill */}
                                  {dueDateLabel && (
                                    <div className="mt-2">
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                          overdue
                                            ? "bg-[var(--bb-danger-bg)] text-[var(--bb-danger-text)]"
                                            : "bg-[var(--bb-info-bg)] text-[var(--bb-info-text)]"
                                        }`}
                                      >
                                        <span className="text-[9px]">
                                          {overdue ? "!" : "📅"}
                                        </span>
                                        {dueDateLabel}
                                      </span>
                                    </div>
                                  )}

                                  {/* Changes requested badge + snippet */}
                                  {showFeedbackBadge && (
                                    <div className="mt-2">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bb-primary-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--bb-primary-hover)]">
                                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--bb-warning-text)]" />
                                        Changes requested
                                      </span>
                                    </div>
                                  )}
                                  {t.latestRevisionHasFeedback &&
                                    t.latestRevisionFeedbackSnippet && (
                                      <p className="mt-1 line-clamp-2 text-[10px] italic text-[var(--bb-text-secondary)]">
                                        &ldquo;{t.latestRevisionFeedbackSnippet}&rdquo;
                                      </p>
                                    )}

                                  {/* Footer separator */}
                                  <div className="mt-2.5 border-t border-[var(--bb-border-subtle)] pt-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-[10px] text-[var(--bb-text-tertiary)]">
                                        <span className="font-medium">{ticketCode}</span>
                                        {showRevisionBadge && (
                                          <span className="rounded bg-[var(--bb-info-bg)] px-1 py-0.5 text-[9px] font-semibold text-[var(--bb-info-text)]">
                                            v{t.revisionCount}
                                          </span>
                                        )}
                                        <span
                                          className={`text-xs ${priorityColorClass(t.priority)}`}
                                          title={formatPriorityLabel(t.priority)}
                                        >
                                          {priorityIconMap[t.priority]}
                                        </span>
                                        {payoutTokens != null && (
                                          <span className="rounded bg-[var(--bb-success-bg)] px-1 py-0.5 text-[9px] font-semibold text-[#22C55E]">
                                            {payoutTokens}t
                                          </span>
                                        )}
                                      </div>
                                      {/* Company avatar */}
                                      <div
                                        title={companyLabel}
                                        className="flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-bold text-white"
                                        style={{
                                          backgroundColor: avatarColor(companyLabel),
                                        }}
                                      >
                                        {getInitials(companyLabel, null)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {/* Drop here placeholder when column has items */}
                            {isActiveDrop && (
                              <div className="flex h-16 items-center justify-center rounded-xl border-2 border-dashed border-[var(--bb-primary)]/40 text-xs text-[var(--bb-primary)]/60">
                                Drop here
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>

      {/* Floating bulk action bar */}
      {selectionMode && selectedTicketIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-[slideUp_200ms_ease-out]">
          <div className="flex items-center gap-3 rounded-full bg-[var(--bb-secondary)] px-5 py-2.5 shadow-2xl">
            <span className="text-xs font-semibold text-white">
              {selectedTicketIds.size} ticket{selectedTicketIds.size > 1 ? "s" : ""} selected
            </span>

            <div className="h-4 w-px bg-[var(--bb-bg-page)]/20" />

            {bulkTargetStatuses.includes("TODO") && (
              <button
                type="button"
                disabled={bulkUpdating}
                onClick={() => handleBulkStatusChange("TODO")}
                className="rounded-full bg-[var(--bb-bg-page)]/10 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[var(--bb-bg-page)]/20 disabled:opacity-50"
              >
                {bulkUpdating ? "Moving…" : "Move to Backlog"}
              </button>
            )}

            {bulkTargetStatuses.includes("IN_PROGRESS") && (
              <button
                type="button"
                disabled={bulkUpdating}
                onClick={() => handleBulkStatusChange("IN_PROGRESS")}
                className="rounded-full bg-[var(--bb-primary)] px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-[var(--bb-primary-hover)] disabled:opacity-50"
              >
                {bulkUpdating ? "Moving…" : "Start working"}
              </button>
            )}

            <div className="h-4 w-px bg-[var(--bb-bg-page)]/20" />

            <button
              type="button"
              onClick={exitSelectionMode}
              className="text-xs font-medium text-white/60 transition-colors hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Detail modal — Jira-style two-column layout */}
      <Modal open={!!detailTicket} onClose={closeTicketDetails} size="full">
        <ModalHeader
          eyebrow="Ticket"
          title={detailTicket?.title ?? ""}
          subtitle={detailTicket?.companyTicketNumber ? `#${detailTicket.companyTicketNumber}` : undefined}
          onClose={closeTicketDetails}
        />

            {detailTicket && (
            <>
            {/* Status context banner */}
            {detailTicket.status === "IN_REVIEW" && (
              <div className={`mb-4 flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                detailTicket.latestRevisionHasFeedback
                  ? "bg-[var(--bb-warning-bg)] text-[var(--bb-warning-text)]"
                  : "bg-[var(--bb-info-bg)] text-[var(--bb-info-text)]"
              }`}>
                <span className="text-sm">{detailTicket.latestRevisionHasFeedback ? "💬" : "⏳"}</span>
                <span className="font-medium">
                  {detailTicket.latestRevisionHasFeedback
                    ? `Customer requested changes${detailTicket.latestRevisionFeedbackSnippet ? `: "${detailTicket.latestRevisionFeedbackSnippet}"` : ""}`
                    : "Waiting for customer feedback"}
                </span>
              </div>
            )}

            {/* Two-column Jira layout */}
            <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto md:grid-cols-[1fr_260px] md:overflow-visible">
              {/* Left column — main content (scrollable on desktop) */}
              <div className="min-w-0 md:overflow-y-auto md:pr-2">
                {/* Description */}
                {detailTicket.description && (
                  <div className="mb-5">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">
                      Description
                    </p>
                    <SafeHtml
                      html={detailTicket.description}
                      className="rounded-xl bg-[var(--bb-bg-warm)] px-4 py-3 text-xs leading-relaxed text-[var(--bb-secondary)]"
                    />
                  </div>
                )}

                {/* Brief attachments */}
                {detailBriefAssetsLoading && (
                  <div className="mb-5">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">
                      Brief attachments
                    </p>
                    <div className="flex items-center gap-2 py-3">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--bb-border)] border-t-[var(--bb-text-tertiary)]" />
                      <p className="text-xs text-[var(--bb-text-tertiary)]">Loading attachments…</p>
                    </div>
                  </div>
                )}

                {!detailBriefAssetsLoading && detailBriefAssets.length > 0 && (() => {
                  const hasCreativeWork = detailRevisions && detailRevisions.length > 0 &&
                    detailRevisions.some((r) => r.assets && r.assets.length > 0);

                  return (
                    <div className="mb-5">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">
                          Brief attachments
                          <span className="ml-1.5 text-[var(--bb-text-tertiary)]">({detailBriefAssets.length})</span>
                        </p>
                        <DownloadAllButton
                          assets={detailBriefAssets}
                          zipFilename="brief-attachments.zip"
                        />
                      </div>
                      {hasCreativeWork ? (
                        <BriefThumbnailRow assets={detailBriefAssets} />
                      ) : (
                        <RevisionImageLarge
                          assets={detailBriefAssets}
                          pinMode="view"
                        />
                      )}
                    </div>
                  );
                })()}

                {/* Divider between brief context and creative work */}
                {(detailRevisions && detailRevisions.length > 0) && (
                  <div className="mb-5 border-t border-[var(--bb-border-subtle)]" />
                )}

                {/* Revisions — loading / error / empty states */}
                {detailRevisionsLoading && (
                  <p className="text-xs text-[var(--bb-text-tertiary)]">Loading revisions…</p>
                )}

                {!detailRevisionsLoading && detailRevisionsError && (
                  <p className="text-xs text-[var(--bb-danger-text)]">{detailRevisionsError}</p>
                )}

                {!detailRevisionsLoading &&
                  !detailRevisionsError &&
                  (!detailRevisions || detailRevisions.length === 0) && (
                    <EmptyState title="No revisions yet." description="Once you send this ticket for review and your customer requests changes, you'll see each version and their feedback here." />
                  )}

                {/* Current version + Previous versions */}
                {!detailRevisionsLoading &&
                  !detailRevisionsError &&
                  detailRevisions &&
                  detailRevisions.length > 0 && (() => {
                    const reversed = [...detailRevisions].reverse();
                    const latestRev = reversed[0];
                    const olderRevs = reversed.slice(1);

                    return (
                      <div className="space-y-5">
                        {/* ── Current version ── */}
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">
                            Current version
                          </p>
                          <div className={`rounded-xl border-2 bg-[var(--bb-bg-page)] px-4 py-4 ${
                            latestRev.feedbackAt ? "border-[var(--bb-warning-border)]/40" : "border-[var(--bb-info-border)]/40"
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white ${
                                latestRev.feedbackAt ? "bg-[var(--bb-warning-text)]" : "bg-[var(--bb-info-text)]"
                              }`}>
                                {latestRev.feedbackAt ? "✎" : "✓"}
                              </span>
                              <p className="text-xs font-semibold text-[var(--bb-secondary)]">
                                Version {latestRev.version}
                              </p>
                              {latestRev.assets && latestRev.assets.length > 0 && (
                                <DownloadAllButton
                                  assets={latestRev.assets}
                                  zipFilename={`version-${latestRev.version}.zip`}
                                />
                              )}
                            </div>

                            {latestRev.submittedAt && (
                              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--bb-info-text)]">
                                <span className="text-[10px]">📤</span>
                                You sent this for review on{" "}
                                <span className="font-semibold">{formatBoardDate(latestRev.submittedAt)}</span>
                              </p>
                            )}

                            {latestRev.feedbackAt && (
                              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--bb-warning-text)]">
                                <span className="text-[10px]">💬</span>
                                Customer requested changes on{" "}
                                <span className="font-semibold">{formatBoardDate(latestRev.feedbackAt)}</span>
                              </p>
                            )}

                            {latestRev.feedbackMessage && (
                              <div className="mt-2 rounded-lg bg-[var(--bb-warning-bg)] px-3 py-2">
                                <p className="text-[11px] italic text-[var(--bb-text-tertiary)]">
                                  &ldquo;{latestRev.feedbackMessage}&rdquo;
                                </p>
                              </div>
                            )}

                            {typeof latestRev.creativeMessage === "string" &&
                              latestRev.creativeMessage.trim().length > 0 && (
                                <div className="mt-2 rounded-lg bg-[var(--bb-info-bg)] px-3 py-2">
                                  <p className="text-[11px] text-[var(--bb-secondary)]">
                                    <span className="font-semibold">Your note:</span>{" "}
                                    {latestRev.creativeMessage}
                                  </p>
                                </div>
                              )}

                            {/* Large image display for current version */}
                            {latestRev.assets && latestRev.assets.length > 0 && (
                              <RevisionImageLarge
                                assets={latestRev.assets}
                                pinMode={detailTicket?.status === "IN_PROGRESS" ? "resolve" : "view"}
                                onUploadWork={detailTicket?.status === "IN_PROGRESS" ? () => {
                                  closeTicketDetails();
                                  setReviewModal({ ticket: detailTicket, targetStatus: "IN_REVIEW" });
                                } : undefined}
                              />
                            )}
                          </div>
                        </div>

                        {/* ── Previous versions (collapsible) ── */}
                        {olderRevs.length > 0 && (
                          <div>
                            <button
                              type="button"
                              onClick={() => setShowPreviousVersions((v) => !v)}
                              className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)] transition-colors hover:text-[var(--bb-text-secondary)]"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`transition-transform ${showPreviousVersions ? "rotate-90" : ""}`}
                              >
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                              Previous versions
                              <span className="text-[var(--bb-text-tertiary)]">({olderRevs.length})</span>
                            </button>

                            {showPreviousVersions && (
                              <div className="space-y-2.5">
                                {olderRevs.map((rev) => (
                                  <div
                                    key={rev.version}
                                    className="rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white ${
                                        rev.feedbackAt ? "bg-[var(--bb-warning-text)]" : "bg-[var(--bb-info-text)]"
                                      }`}>
                                        {rev.feedbackAt ? "✎" : "✓"}
                                      </span>
                                      <p className="text-xs font-semibold text-[var(--bb-secondary)]">
                                        Version {rev.version}
                                      </p>
                                      {rev.assets && rev.assets.length > 0 && (
                                        <DownloadAllButton
                                          assets={rev.assets}
                                          zipFilename={`version-${rev.version}.zip`}
                                        />
                                      )}
                                    </div>

                                    {rev.submittedAt && (
                                      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--bb-info-text)]">
                                        <span className="text-[10px]">📤</span>
                                        You sent this for review on{" "}
                                        <span className="font-semibold">{formatBoardDate(rev.submittedAt)}</span>
                                      </p>
                                    )}

                                    {rev.feedbackAt && (
                                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--bb-warning-text)]">
                                        <span className="text-[10px]">💬</span>
                                        Customer requested changes on{" "}
                                        <span className="font-semibold">{formatBoardDate(rev.feedbackAt)}</span>
                                      </p>
                                    )}

                                    {rev.feedbackMessage && (
                                      <div className="mt-2 rounded-lg bg-[var(--bb-warning-bg)] px-3 py-2">
                                        <p className="text-[11px] italic text-[var(--bb-text-tertiary)]">
                                          &ldquo;{rev.feedbackMessage}&rdquo;
                                        </p>
                                      </div>
                                    )}

                                    {typeof rev.creativeMessage === "string" &&
                                      rev.creativeMessage.trim().length > 0 && (
                                        <div className="mt-2 rounded-lg bg-[var(--bb-info-bg)] px-3 py-2">
                                          <p className="text-[11px] text-[var(--bb-secondary)]">
                                            <span className="font-semibold">Your note:</span>{" "}
                                            {rev.creativeMessage}
                                          </p>
                                        </div>
                                      )}

                                    {/* Thumbnail grid for older versions */}
                                    {rev.assets && rev.assets.length > 0 && (
                                      <RevisionImageGrid
                                        assets={rev.assets}
                                        pinMode="view"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>

              {/* Right column — metadata sidebar (fixed while left scrolls) */}
              <aside className="self-start overflow-y-auto rounded-xl bg-[var(--bb-bg-warm)] p-4">
                {/* Details */}
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">
                    Details
                  </p>
                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="text-[var(--bb-text-tertiary)]">Status</p>
                      <div className="mt-0.5 flex items-center gap-1.5 font-semibold text-[var(--bb-secondary)]">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: columnAccentColor[detailTicket.status] }}
                        />
                        {STATUS_LABELS[detailTicket.status]}
                      </div>
                    </div>
                    <div>
                      <p className="text-[var(--bb-text-tertiary)]">Priority</p>
                      <p className="mt-0.5 font-semibold text-[var(--bb-secondary)]">
                        <span className={priorityColorClass(detailTicket.priority)}>
                          {priorityIconMap[detailTicket.priority]}
                        </span>
                        {" "}{formatPriorityLabel(detailTicket.priority)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--bb-text-tertiary)]">Project</p>
                      <p className="mt-0.5 font-semibold text-[var(--bb-secondary)]">
                        {detailTicket.project?.name || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--bb-text-tertiary)]">Job type</p>
                      <p className="mt-0.5 font-semibold text-[var(--bb-secondary)]">
                        {detailTicket.jobType?.name || "—"}
                      </p>
                    </div>
                    {detailTicket.jobType && (
                      <div>
                        <p className="text-[var(--bb-text-tertiary)]">Payout</p>
                        <p className="mt-0.5 font-semibold text-[var(--bb-secondary)]">
                          {detailTicket.jobType.creativePayoutTokens} tokens
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="mb-5 border-t border-[var(--bb-border-subtle)]" />

                {/* Company */}
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">
                    Company
                  </p>
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: avatarColor(detailTicket.company?.name || "—") }}
                    >
                      {getInitials(detailTicket.company?.name || null, null)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--bb-secondary)]">
                        {detailTicket.company?.name || "—"}
                      </p>
                      <p className="text-[10px] text-[var(--bb-text-tertiary)]">Customer</p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="mb-5 border-t border-[var(--bb-border-subtle)]" />

                {/* Dates */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">
                    Dates
                  </p>
                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-[var(--bb-text-tertiary)]">Created</p>
                      <p className="mt-0.5 font-semibold text-[var(--bb-secondary)]">
                        {formatBoardDate(detailTicket.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--bb-text-tertiary)]">Updated</p>
                      <p className="mt-0.5 font-semibold text-[var(--bb-secondary)]">
                        {formatBoardDate(detailTicket.updatedAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--bb-text-tertiary)]">Due date</p>
                      <p className={`mt-0.5 font-semibold ${isDueDateOverdue(detailTicket.dueDate) ? "text-[var(--bb-danger-text)]" : "text-[var(--bb-secondary)]"}`}>
                        {formatBoardDate(detailTicket.dueDate)}
                      </p>
                      {(() => {
                        const countdown = formatDueDateCountdown(detailTicket.dueDate);
                        if (!countdown) return null;
                        return (
                          <p className={`mt-0.5 text-[10px] font-medium ${countdown.overdue ? "text-[var(--bb-danger-text)]" : "text-[var(--bb-text-secondary)]"}`}>
                            {countdown.label}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            {/* Quick actions footer */}
            {detailTicket.status === "IN_PROGRESS" && (
              <ModalFooter className="shrink-0 border-t border-[var(--bb-border-subtle)] pt-3">
                <Button
                  size="sm"
                  onClick={() => {
                    closeTicketDetails();
                    setReviewModal({ ticket: detailTicket, targetStatus: "IN_REVIEW" });
                  }}
                >
                  Upload work
                </Button>
              </ModalFooter>
            )}
            {detailTicket.status === "IN_REVIEW" && (
              <ModalFooter className="shrink-0 border-t border-[var(--bb-border-subtle)] pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await persistTicketStatus(detailTicket.id, "IN_PROGRESS");
                    closeTicketDetails();
                  }}
                >
                  Pull back to In progress
                </Button>
              </ModalFooter>
            )}
            </>
            )}
      </Modal>

      {/* Upload work modal (file upload + creative note) */}
      <Modal open={!!reviewModal} onClose={closeReviewModal} size="xl" scrollable>
        <ModalHeader
          eyebrow="Upload work"
          title={reviewModal?.ticket.title ?? ""}
          subtitle="Attach your design files and optionally share a note with your customer."
        />

            <div className="space-y-4">
              {/* File upload area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">
                    Design files{" "}
                    <span className="font-normal text-[var(--bb-text-tertiary)]">(optional)</span>
                  </label>
                  <span className="text-[11px] text-[var(--bb-text-tertiary)]">
                    {reviewFiles.length}/{MAX_REVIEW_FILES}
                  </span>
                </div>

                <div
                  className="rounded-xl border-2 border-dashed border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-4 py-4 text-center transition-colors hover:border-[var(--bb-primary)]/60"
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddReviewFiles(e.dataTransfer.files);
                  }}
                >
                  <p className="text-xs text-[var(--bb-text-secondary)]">
                    Drag & drop images here, or{" "}
                    <button
                      type="button"
                      className="cursor-pointer font-semibold text-[var(--bb-primary)] hover:underline"
                      disabled={reviewUploading || reviewFiles.length >= MAX_REVIEW_FILES}
                      onClick={() => reviewFileInputRef.current?.click()}
                    >
                      browse
                    </button>
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--bb-text-muted)]">PNG, JPG, WebP — up to {MAX_REVIEW_FILES} files</p>
                  <input
                    ref={reviewFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={reviewUploading || reviewFiles.length >= MAX_REVIEW_FILES}
                    onChange={(e) => {
                      handleAddReviewFiles(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                </div>

                {/* Thumbnail previews */}
                {reviewFiles.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {reviewFiles.map((rf) => (
                      <div key={rf.id} className="group relative overflow-hidden rounded-lg border border-[var(--bb-border)]">
                        <img
                          src={URL.createObjectURL(rf.file)}
                          alt={rf.file.name}
                          className="h-20 w-full object-cover"
                        />
                        {!reviewUploading && (
                          <button
                            type="button"
                            onClick={() => handleRemoveReviewFile(rf.id)}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            &times;
                          </button>
                        )}
                        <p className="truncate px-1.5 py-0.5 text-[9px] text-[var(--bb-text-secondary)]">{rf.file.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Creative note */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--bb-secondary)]">
                  Note to your customer{" "}
                  <span className="font-normal text-[var(--bb-text-tertiary)]">(optional)</span>
                </label>
                <textarea
                  value={creativeNote}
                  onChange={(e) => setCreativeNote(e.target.value)}
                  rows={3}
                  disabled={reviewUploading}
                  placeholder="Highlight what you changed, any open questions, or how they should review this version."
                  className="w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-2.5 text-xs text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)] disabled:opacity-50"
                />
              </div>

              {/* Upload progress */}
              {reviewUploadProgress && (
                <div className="rounded-lg border border-[var(--bb-border)] bg-[var(--bb-warning-bg)] px-3 py-2 text-xs text-[var(--bb-text-secondary)]">
                  {reviewUploadProgress}
                </div>
              )}
            </div>

        <ModalFooter>
          <Button variant="secondary" size="sm" onClick={closeReviewModal} disabled={reviewUploading}>Cancel</Button>
          <Button size="sm" onClick={handleConfirmReviewWithNote} disabled={reviewUploading}>
            {reviewUploading ? "Uploading..." : "Upload & send for review"}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
