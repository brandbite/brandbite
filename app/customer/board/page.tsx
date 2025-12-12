// -----------------------------------------------------------------------------
// @file: app/customer/board/page.tsx
// @purpose: Customer-facing board view of company tickets (kanban + drag & drop + detail & revision modals + toasts)
// @version: v2.1.1
// @status: active
// @lastUpdate: 2025-12-07
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CompanyRole,
  normalizeCompanyRole,
  canMoveTicketsOnBoard,
} from "@/lib/permissions/companyRoles";
import { TicketStatus, TicketPriority } from "@prisma/client";
import { useToast } from "@/components/ui/toast-provider";
import {CustomerNav } from "@/components/navigation/customer-nav";

type TicketStatusLabel = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

type TicketStatusConfig = {
  label: TicketStatusLabel;
  title: string;
  description: string;
};

type TicketStatusDisplay = {
  status: TicketStatus;
  config: TicketStatusConfig;
};

type CustomerBoardTicket = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  project: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  jobType: {
    id: string;
    name: string;
  } | null;
  designer: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  companyTicketNumber: number | null;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
};

type BoardStats = {
  total: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
};

type CustomerBoardResponse = {
  stats: BoardStats;
  tickets: CustomerBoardTicket[];
};

type TicketRevisionEntry = {
  version: number;
  submittedAt: string | null;
  feedbackAt: string | null;
  feedbackMessage: string | null;
};

type CompanyRoleResponse = {
  role: CompanyRole | null;
};

type UpdateStatusRequest = {
  ticketId: string;
  status: TicketStatus;
  revisionMessage?: string | null;
};

type UpdateStatusResponse = {
  success?: boolean;
  ticket?: CustomerBoardTicket;
  stats?: BoardStats;
};

type TicketStatusColumnDefinition = {
  status: TicketStatus;
  title: string;
  description: string;
};

const ticketStatusColumns: TicketStatusColumnDefinition[] = [
  {
    status: "TODO",
    title: "To do",
    description: "New and not yet started requests.",
  },
  {
    status: "IN_PROGRESS",
    title: "In progress",
    description: "Your designer is actively working on these.",
  },
  {
    status: "IN_REVIEW",
    title: "In review",
    description: "Waiting for your feedback or approval.",
  },
  {
    status: "DONE",
    title: "Done",
    description: "Completed requests you approved as done.",
  },
];

const statusOrder: TicketStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

const priorityOrder: TicketPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

const statusLabels: Record<TicketStatus, TicketStatusLabel> = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  IN_REVIEW: "IN_REVIEW",
  DONE: "DONE",
};

const statusDisplayConfigs: Record<TicketStatus, TicketStatusConfig> = {
  TODO: {
    label: "TODO",
    title: "To do",
    description: "New and not yet started requests.",
  },
  IN_PROGRESS: {
    label: "IN_PROGRESS",
    title: "In progress",
    description: "Your designer is actively working on these.",
  },
  IN_REVIEW: {
    label: "IN_REVIEW",
    title: "In review",
    description: "Waiting for your feedback or approval.",
  },
  DONE: {
    label: "DONE",
    title: "Done",
    description: "Completed requests you approved as done.",
  },
};

const priorityLabelMap: Record<TicketPriority, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const priorityBadgeClass: Record<TicketPriority, string> = {
  URGENT:
    "bg-[#fdecea] text-[#b13832] border border-[#f7c7c0] shadow-[0_1px_0_rgba(0,0,0,0.02)]",
  HIGH: "bg-[#fff4e5] text-[#c76a18] border border-[#f7d0a9]",
  MEDIUM: "bg-[#eef3ff] text-[#3259c7] border border-[#c7d1f7]",
  LOW: "bg-[#f3f2f0] text-[#5a5953] border border-[#d4d2ce]",
};

const priorityIconMap: Record<TicketPriority, string> = {
  URGENT: "↑↑",
  HIGH: "↑",
  MEDIUM: "→",
  LOW: "↓",
};

const statusBadgeClass: Record<TicketStatus, string> = {
  TODO: "bg-[#f5f3f0] text-[#5a5953] border border-[#d4d2ce]",
  IN_PROGRESS: "bg-[#eaf4ff] text-[#3259c7] border border-[#c7d1f7]",
  IN_REVIEW: "bg-[#fff7e0] text-[#c76a18] border border-[#f7d0a9]",
  DONE: "bg-[#e8f6f0] text-[#287b5a] border border-[#b9e2cd]",
};

const statusColumnClass = (status: TicketStatus): string => {
  switch (status) {
    case "TODO":
      return "bg-[#f5f3f0]";
    case "IN_PROGRESS":
      return "bg-[#eaf4ff]";
    case "IN_REVIEW":
      return "bg-[#fff7e0]";
    case "DONE":
      return "bg-[#e8f6f0]";
    default:
      return "bg-[#f5f3f0]";
  }
};

const statusTagColor = (status: TicketStatus): string => {
  switch (status) {
    case "TODO":
      return "bg-[#f5f3f0] text-[#5a5953]";
    case "IN_PROGRESS":
      return "bg-[#eaf4ff] text-[#3259c7]";
    case "IN_REVIEW":
      return "bg-[#fff7e0] text-[#c76a18]";
    case "DONE":
      return "bg-[#e8f6f0] text-[#287b5a]";
    default:
      return "bg-[#f5f3f0] text-[#5a5953]";
  }
};

const statusIndicatorColor = (status: TicketStatus): string => {
  switch (status) {
    case "TODO":
      return "bg-[#b1afa9]";
    case "IN_PROGRESS":
      return "bg-[#4c8ef7]";
    case "IN_REVIEW":
      return "bg-[#f5a623]";
    case "DONE":
      return "bg-[#32b37b]";
    default:
      return "bg-[#b1afa9]";
  }
};

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTimeAgo = (iso: string | null): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "just now";
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears}y ago`;
};

const computeStats = (tickets: CustomerBoardTicket[]): BoardStats => {
  const byStatus: Record<TicketStatus, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
  };

  const byPriority: Record<TicketPriority, number> = {
    URGENT: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  for (const t of tickets) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
  }

  return {
    total: tickets.length,
    byStatus,
    byPriority,
  };
};

const sortTicketsForColumn = (
  tickets: CustomerBoardTicket[],
): CustomerBoardTicket[] => {
  return [...tickets].sort((a, b) => {
    const priorityIndexA = priorityOrder.indexOf(a.priority);
    const priorityIndexB = priorityOrder.indexOf(b.priority);
    if (priorityIndexA !== priorityIndexB) {
      return priorityIndexA - priorityIndexB;
    }
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateA - dateB;
  });
};

// Customer-side allowed moves helper (for messaging)
type CustomerDropDecision = {
  allowed: boolean;
  reason?: string;
};

const canDropTicketToStatus = (
  ticket: CustomerBoardTicket,
  targetStatus: TicketStatus,
): CustomerDropDecision => {
  if (ticket.status === targetStatus) {
    return { allowed: true };
  }

  if (ticket.status === "IN_REVIEW") {
    if (targetStatus === "DONE") {
      return { allowed: true };
    }
    if (targetStatus === "IN_PROGRESS") {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason:
        "From In review you can either approve the request as Done or send it back to In progress.",
    };
  }

  if (ticket.status === "TODO") {
    return {
      allowed: false,
      reason:
        "New requests in To do can only be picked up by your designer. You can approve or request changes once the ticket is In review.",
    };
  }

  if (ticket.status === "IN_PROGRESS") {
    return {
      allowed: false,
      reason:
        "In progress requests are controlled by your designer. You can approve work once it reaches In review.",
    };
  }

  if (ticket.status === "DONE") {
    return {
      allowed: false,
      reason:
        "This request is already marked as Done. If something is off, open a new ticket instead of reopening this one.",
    };
  }

  return {
    allowed: false,
    reason: "This move is not allowed.",
  };
};

const formatPriorityLabel = (priority: TicketPriority): string => {
  return priorityLabelMap[priority] ?? priority;
};

export default function CustomerBoardPage() {
  const { showToast } = useToast();

  const [data, setData] = useState<CustomerBoardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [companyRole, setCompanyRole] = useState<CompanyRole | null>(null);
  const [companyRoleLoading, setCompanyRoleLoading] = useState<boolean>(true);
  const [companyRoleError, setCompanyRoleError] = useState<string | null>(null);

  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] =
    useState<TicketStatus | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  const [detailTicketId, setDetailTicketId] = useState<string | null>(null);

  const [detailRevisions, setDetailRevisions] = useState<
    TicketRevisionEntry[] | null
  >(null);
  const [detailRevisionsLoading, setDetailRevisionsLoading] =
    useState<boolean>(false);
  const [detailRevisionsError, setDetailRevisionsError] = useState<
    string | null
  >(null);

  const [pendingDoneTicketId, setPendingDoneTicketId] = useState<
    string | null
  >(null);

  const [pendingRevisionTicketId, setPendingRevisionTicketId] =
    useState<string | null>(null);
  const [revisionMessage, setRevisionMessage] = useState<string>("");
  const [revisionMessageError, setRevisionMessageError] = useState<
    string | null
  >(null);

  const [mouseDownInfo, setMouseDownInfo] = useState<{
    ticketId: string;
    x: number;
    y: number;
    time: number;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Load board data
  // ---------------------------------------------------------------------------

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/customer/tickets", {
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          text || `Failed to load tickets (status ${res.status}).`,
        );
      }

      const json = (await res.json()) as CustomerBoardResponse;
      setData({
        ...json,
        stats: computeStats(json.tickets),
      });
    } catch (err: unknown) {
      console.error("Load customer board data error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load your tickets. Please try again.";

      setLoadError(message);

      showToast({
        type: "error",
        title: "Could not load your board",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyRole = async () => {
    setCompanyRoleLoading(true);
    setCompanyRoleError(null);

    try {
      const res = await fetch("/api/customer/company-role", {
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          text || `Failed to load company permissions (status ${res.status}).`,
        );
      }

      const json = (await res.json()) as CompanyRoleResponse;
      setCompanyRole(json.role ? normalizeCompanyRole(json.role) : null);
    } catch (err: unknown) {
      console.error("Load company role error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load your permissions. Please try again.";

      setCompanyRoleError(message);

      showToast({
        type: "error",
        title: "Could not load your permissions",
        description: message,
      });
    } finally {
      setCompanyRoleLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const initialLoad = async () => {
      if (cancelled) return;
      await load();
    };
    initialLoad();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRole = async () => {
      try {
        await loadCompanyRole();
      } catch (err) {
        console.error("Company role load error:", err);
      } finally {
        if (!cancelled) {
          setCompanyRoleLoading(false);
        }
      }
    };
    loadRole();
    return () => {
      cancelled = true;
    };
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
          `/api/customer/tickets/${detailTicketId}/revisions`,
          { cache: "no-store" },
        );

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const message =
            (json &&
              typeof json === "object" &&
              "error" in json &&
              (json as any).error) ||
            `Failed to load revision history (status ${res.status}).`;
          if (!cancelled) {
            setDetailRevisionsError(
              typeof message === "string"
                ? message
                : "Failed to load revision history.",
            );
          }
          return;
        }

        const entries = ((json as any)?.revisions ?? []) as TicketRevisionEntry[];

        if (!cancelled) {
          setDetailRevisions(entries);
        }
      } catch (err) {
        console.error(
          "[CustomerBoardPage] Failed to load ticket revision history",
          err,
        );
        if (!cancelled) {
          setDetailRevisionsError(
            "Failed to load revision history. Please try again later.",
          );
        }
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
  }, [detailTicketId]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const tickets = data?.tickets ?? [];

  const projects = useMemo(() => {
    const list = Array.from(
      new Set(
        tickets
          .map((t) => t.project?.name)
          .filter((p): p is string => !!p),
      ),
    );
    list.sort((a, b) => a.localeCompare(b));
    return list;
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (projectFilter !== "ALL" && t.project?.name !== projectFilter) {
        return false;
      }

      const q = search.trim().toLowerCase();
      if (q) {
        const code =
          t.project?.code && t.companyTicketNumber
            ? `${t.project.code}-${t.companyTicketNumber}`.toLowerCase()
            : "";
        const title = t.title.toLowerCase();
        const description = (t.description ?? "").toLowerCase();

        if (
          !code.includes(q) &&
          !title.includes(q) &&
          !description.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, projectFilter, search]);

  const ticketsByStatus = useMemo(() => {
    const map: Record<TicketStatus, CustomerBoardTicket[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    for (const t of filteredTickets) {
      map[t.status].push(t);
    }
    for (const status of statusOrder) {
      map[status] = sortTicketsForColumn(map[status]);
    }
    return map;
  }, [filteredTickets]);

  const canDragTicket = useMemo(() => {
    if (!companyRole) return false;
    return canMoveTicketsOnBoard(companyRole);
  }, [companyRole]);

  const detailTicket = useMemo(() => {
    if (!detailTicketId) return null;
    return tickets.find((t) => t.id === detailTicketId) ?? null;
  }, [detailTicketId, tickets]);

  const pendingDoneTicket = useMemo(() => {
    if (!pendingDoneTicketId) return null;
    return tickets.find((t) => t.id === pendingDoneTicketId) ?? null;
  }, [pendingDoneTicketId, tickets]);

  const pendingRevisionTicket = useMemo(() => {
    if (!pendingRevisionTicketId) return null;
    return tickets.find((t) => t.id === pendingRevisionTicketId) ?? null;
  }, [pendingRevisionTicketId, tickets]);

  const currentStats = data?.stats ?? computeStats([]);

  // ---------------------------------------------------------------------------
  // Status update helper
  // ---------------------------------------------------------------------------

  const getStatusSuccessMessage = (
    status: TicketStatus,
    options?: { hasRevisionMessage?: boolean },
  ): { title: string; description: string } => {
    if (status === "DONE") {
      return {
        title: "Request marked as done",
        description:
          "Your designer will be paid for this job and the ticket has moved to Done.",
      };
    }

    if (status === "IN_PROGRESS" && options?.hasRevisionMessage) {
      return {
        title: "Changes requested",
        description:
          "Your message has been sent to your designer and the ticket is back in progress.",
      };
    }

    if (status === "IN_PROGRESS") {
      return {
        title: "Request moved back to In progress",
        description: "This ticket is now open again for your designer.",
      };
    }

    if (status === "IN_REVIEW") {
      return {
        title: "Request moved to In review",
        description: "You can now review and approve or request changes.",
      };
    }

    return {
      title: "Request updated",
      description: "The status of this request has been updated.",
    };
  };

  const persistTicketStatus = async (
    ticketId: string,
    status: TicketStatus,
    revisionMessage?: string | null,
  ) => {
    setMutationError(null);
    setUpdatingTicketId(ticketId);
    try {
      const hasRevisionMessage =
        !!revisionMessage && revisionMessage.trim().length > 0;

      const payload: UpdateStatusRequest = {
        ticketId,
        status,
      };
      if (hasRevisionMessage) {
        payload.revisionMessage = revisionMessage!.trim();
      }

      const res = await fetch("/api/customer/tickets/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let json: UpdateStatusResponse | any = null;
      try {
        json = await res.json();
      } catch {
        // JSON dönmeyebilir, problem değil
      }

      const hasExplicitSuccessFlag =
        json && typeof json.success === "boolean";

      const successFlag = hasExplicitSuccessFlag ? json.success : true;

      if (!res.ok || !successFlag) {
        const errorMessage =
          (json && (json.error || json.message)) ||
          "We couldn't update this request. Please try again.";
        throw new Error(
          typeof errorMessage === "string"
            ? errorMessage
            : "We couldn't update this request. Please try again.",
        );
      }

      // Response içinde ticket + stats varsa, lokal state'i hızlı güncelle
      if (json && json.ticket && json.stats) {
        setData((prev) => {
          if (!prev) {
            return {
              tickets: [json.ticket],
              stats: json.stats,
            };
          }

          const nextTickets = prev.tickets.map((t) =>
            t.id === json.ticket.id ? json.ticket : t,
          );

          return {
            tickets: nextTickets,
            stats: json.stats,
          };
        });
      } else {
        // Response şekline güvenemiyorsak, tüm board'u yeniden yükle
        await load();
      }

      const successCopy = getStatusSuccessMessage(status, {
        hasRevisionMessage,
      });

      showToast({
        type: "success",
        title: successCopy.title,
        description: successCopy.description,
      });
    } catch (err: unknown) {
      console.error("Update ticket status error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update ticket status. Please try again.";

      setMutationError(message);

      showToast({
        type: "error",
        title: "Could not update this request",
        description: message,
      });

      await load();
    } finally {
      setUpdatingTicketId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Drag & drop handlers
  // ---------------------------------------------------------------------------

  const handleMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    ticketId: string,
  ) => {
    setMouseDownInfo({
      ticketId,
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
    });
  };

  const handleMouseUp = (
    event: React.MouseEvent<HTMLDivElement>,
    ticketId: string,
  ) => {
    if (!mouseDownInfo || mouseDownInfo.ticketId !== ticketId) {
      return;
    }

    const dx = Math.abs(event.clientX - mouseDownInfo.x);
    const dy = Math.abs(event.clientY - mouseDownInfo.y);
    const dt = Date.now() - mouseDownInfo.time;

    const movementThreshold = 5;
    const timeThreshold = 250;

    if (dx < movementThreshold && dy < movementThreshold && dt < timeThreshold) {
      setDetailTicketId(ticketId);
    }

    setMouseDownInfo(null);
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    ticketId: string,
    ticketStatus: TicketStatus,
  ) => {
    if (!canDragTicket) {
      event.preventDefault();
      return;
    }

    // Customer sadece IN_REVIEW kartlarını sürükleyebilsin
    if (ticketStatus !== "IN_REVIEW") {
      event.preventDefault();
      return;
    }

    setDraggingTicketId(ticketId);
    setMutationError(null);
    setMouseDownInfo(null);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", ticketId);
      } catch {
        // bazı browser'lar keyfi limit koyabilir, önemli değil
      }
    }
  };

  const handleDragEnd = () => {
    setDraggingTicketId(null);
    setDragOverStatus(null);
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    status: TicketStatus,
  ) => {
    if (!draggingTicketId || !canDragTicket) return;

    const ticket = tickets.find((t) => t.id === draggingTicketId);
    if (!ticket) return;

    // drop'un gerçekleşebilmesi için her durumda preventDefault
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

  const handleDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    targetStatus: TicketStatus,
  ) => {
    event.preventDefault();
    setDragOverStatus(null);

    if (!canDragTicket) {
      showToast({
        type: "warning",
        title: "You can't move requests",
        description:
          "Your current role does not allow changing ticket status on this board.",
      });
      return;
    }

    const ticketId =
      event.dataTransfer.getData("text/plain") || draggingTicketId || "";
    if (!ticketId) return;

    const ticket = tickets.find((t) => t.id === ticketId);
    setDraggingTicketId(null);

    if (!ticket) return;

    const decision = canDropTicketToStatus(ticket, targetStatus);

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

    if (ticket.status === targetStatus) {
      return;
    }

    if (ticket.status === "IN_REVIEW" && targetStatus === "IN_PROGRESS") {
      setPendingRevisionTicketId(ticket.id);
      setRevisionMessage("");
      setRevisionMessageError(null);
      return;
    }

    if (ticket.status === "IN_REVIEW" && targetStatus === "DONE") {
      setPendingDoneTicketId(ticket.id);
      return;
    }

    showToast({
      type: "warning",
      title: "This move is not allowed",
      description: "This status change is not available from the board.",
    });
  };

  // ---------------------------------------------------------------------------
  // Detail, DONE-confirmation & revision-confirmation helpers
  // ---------------------------------------------------------------------------

  const closeTicketDetails = () => {
    setDetailTicketId(null);
    setDetailRevisions(null);
    setDetailRevisionsError(null);
    setDetailRevisionsLoading(false);
  };

  const handleConfirmDone = async () => {
    if (!pendingDoneTicketId) return;
    const ticket = tickets.find((t) => t.id === pendingDoneTicketId);
    if (!ticket) return;

    await persistTicketStatus(ticket.id, "DONE");
    setPendingDoneTicketId(null);
  };

  const handleConfirmRevision = async () => {
    if (!pendingRevisionTicketId) return;

    if (!revisionMessage.trim()) {
      const msg = "Please add a short message for your designer.";
      setRevisionMessageError(msg);

      showToast({
        type: "warning",
        title: "Message required",
        description: msg,
      });

      return;
    }

    const ticket = tickets.find((t) => t.id === pendingRevisionTicketId);
    if (!ticket) return;

    await persistTicketStatus(
      ticket.id,
      "IN_PROGRESS",
      revisionMessage.trim(),
    );
    setPendingRevisionTicketId(null);
    setRevisionMessage("");
    setRevisionMessageError(null);
  };

  const handleCancelRevision = () => {
    setPendingRevisionTicketId(null);
    setRevisionMessage("");
    setRevisionMessageError(null);
  };

  const handleStatusBadgeClick = (status: TicketStatus) => {
    const element = document.getElementById(`customer-board-column-${status}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleProjectFilterChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setProjectFilter(event.target.value);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const statusColumnsForRender: TicketStatusDisplay[] = statusOrder.map(
    (status) => ({
      status,
      config: statusDisplayConfigs[status],
    }),
  );

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderTicketCard = (ticket: CustomerBoardTicket) => {
    const isDragging = draggingTicketId === ticket.id;
    const isUpdating = updatingTicketId === ticket.id;

    return (
      <div
        key={ticket.id}
        className={`group cursor-pointer rounded-2xl border border-[#e4e0da] bg-white p-3 text-xs shadow-sm transition-shadow ${
          isDragging ? "opacity-50 shadow-lg" : "hover:shadow-md"
        }`}
        draggable={canDragTicket && ticket.status === "IN_REVIEW"}
        onDragStart={(event) =>
          handleDragStart(event, ticket.id, ticket.status)
        }
        onDragEnd={handleDragEnd}
        onMouseDown={(event) => handleMouseDown(event, ticket.id)}
        onMouseUp={(event) => handleMouseUp(event, ticket.id)}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              {ticket.project?.code && ticket.companyTicketNumber && (
                <span className="rounded-full bg-[#eef3ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#3259c7]">
                  {ticket.project.code}-{ticket.companyTicketNumber}
                </span>
              )}
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass[ticket.status]}`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${statusIndicatorColor(
                    ticket.status,
                  )}`}
                />
                {statusLabels[ticket.status].replace("_", " ")}
              </span>
            </div>
            <h3 className="mt-1 text-[13px] font-semibold text-[#424143]">
              {ticket.title}
            </h3>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityBadgeClass[ticket.priority]}`}
          >
            <span className="text-[9px]">
              {priorityIconMap[ticket.priority]}
            </span>
            {priorityLabelMap[ticket.priority]}
          </span>
        </div>

        {ticket.description && (
          <p className="mb-2 line-clamp-2 text-[11px] text-[#5a5953]">
            {ticket.description}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[#9a9892]">
          <div className="flex items-center gap-2">
            {ticket.project?.name && (
              <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5">
                {ticket.project.name}
              </span>
            )}
            {ticket.designer && (
              <span className="flex items-center gap-1 rounded-full bg-[#f5f3f0] px-2 py-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#32b37b]" />
                {ticket.designer.name || ticket.designer.email || "Designer"}
              </span>
            )}
          </div>
          <span className="whitespace-nowrap">
            Updated {formatTimeAgo(ticket.updatedAt)}
          </span>
        </div>

        {isUpdating && (
          <div className="mt-2 text-[10px] text-[#9a9892]">
            Updating status…
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Global customer navigation (logo + Dashboard / Board / Plans vs.) */}
      <CustomerNav />

      <div className="flex min-h-screen bg-[#f5f3f0]">
        {/* Sidebar - projects / workspace context (desktop and up) */}
        <aside className="hidden w-64 flex-col border-r border-[#e4e0da] bg-[#fbfaf8] px-4 py-4 md:flex lg:w-72">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
              Projects
            </p>
            <button
              type="button"
              className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-white px-3 py-2 text-left text-[11px] text-[#424143] shadow-sm ring-1 ring-[#e4e0da] hover:shadow-md"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f15b2b] text-[12px] font-semibold text-white">
                BB
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-[#424143]">
                  All requests
                </p>
                <p className="text-[10px] text-[#7a7a7a]">
                  Board for your active company
                </p>
              </div>
            </button>
          </div>

          <div className="mt-auto space-y-2 pt-4 text-[10px] text-[#9a9892]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
              Workspace
            </p>
            <p>
              You&apos;re viewing design requests for your demo workspace. Plan
              upgrades and limits will appear here later.
            </p>
          </div>
        </aside>

        {/* Main board area */}
        <div className="flex min-h-screen flex-1 flex-col">
          {/* Header */}
          <div className="border-b border-[#e4e0da] bg-[#fdfcfb]">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                  Customer board
                </p>
                <h1 className="mt-1 text-lg font-semibold text-[#424143]">
                  Design requests
                </h1>
              </div>
              <div className="flex flex-col items-end gap-1 text-right text-[11px] text-[#7a7a7a]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f3f0] px-2 py-0.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#32b37b]" />
                    <span className="font-semibold text-[#424143]">
                      {currentStats.total}
                    </span>
                    <span className="text-[#7a7a7a]">total requests</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  {statusOrder.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleStatusBadgeClick(status)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass[status]}`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${statusIndicatorColor(
                          status,
                        )}`}
                      />
                      {statusDisplayConfigs[status].title}
                      <span className="rounded-full bg-black/5 px-1 text-[9px] font-bold">
                        {currentStats.byStatus[status] ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-6 pt-3">
            {loadError && (
              <div className="mb-3 rounded-xl border border-[#f7c7c0] bg-[#fdecea] px-4 py-3 text-xs text-[#b13832]">
                {loadError}
              </div>
            )}

            {companyRoleError && (
              <div className="mb-3 rounded-xl border border-[#f7c7c0] bg-[#fdecea] px-4 py-3 text-xs text-[#b13832]">
                {companyRoleError}
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7a7a7a]">
                <span className="font-semibold text-[#424143]">
                  Your role in this company:
                </span>
                {companyRoleLoading ? (
                  <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5">
                    Loading…
                  </span>
                ) : companyRole ? (
                  <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5 font-semibold text-[#424143]">
                    {companyRole}
                  </span>
                ) : (
                  <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5">
                    Not set
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4">
              <div>
                {mutationError && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-[#fffaf2] px-4 py-3 text-xs text-amber-800">
                    {mutationError}
                  </div>
                )}

                {/* Filters */}
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={search}
                      onChange={handleSearchChange}
                      placeholder="Search by title, code or description"
                      className="w-full rounded-2xl border border-[#e3dfd7] bg-white px-3 py-2 text-[13px] text-[#424143] shadow-sm outline-none placeholder:text-[#b1afa9] focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-[#b1afa9]">
                      ⌘K
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#7a7a7a]">
                    <span>Project:</span>
                    <select
                      className="rounded-2xl border border-[#e3dfd7] bg-white px-2 py-1 text-[11px] text-[#424143] shadow-sm outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                      value={projectFilter}
                      onChange={handleProjectFilterChange}
                    >
                      <option value="ALL">All projects</option>
                      {projects.map((projectName) => (
                        <option key={projectName} value={projectName}>
                          {projectName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Columns */}
                {loading ? (
                  <div className="flex flex-1 items-center justify-center py-16 text-[12px] text-[#7a7a7a]">
                    Loading your board…
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-4 md:flex-row">
                    {statusColumnsForRender.map(({ status, config }) => {
                      const columnTickets = ticketsByStatus[status] ?? [];
                      const isDropTargetActive = dragOverStatus === status;

                      return (
                        <div
                          key={status}
                          id={`customer-board-column-${status}`}
                          className={`flex-1 rounded-3xl border border-[#e4e0da] p-3 ${statusColumnClass(
                            status,
                          )}`}
                          onDragOver={(event) => handleDragOver(event, status)}
                          onDrop={(event) => handleDrop(event, status)}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold ${statusTagColor(
                                    status,
                                  )}`}
                                >
                                  <span
                                    className={`inline-block h-1.5 w-1.5 rounded-full ${statusIndicatorColor(
                                      status,
                                    )}`}
                                  />
                                  {config.title}
                                </div>
                                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-[#7a7a7a]">
                                  {config.description}
                                </span>
                              </div>
                            </div>
                            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-[#424143]">
                              {columnTickets.length}{" "}
                              {columnTickets.length === 1 ? "ticket" : "tickets"}
                            </span>
                          </div>

                          <div
                            className={`mt-2 flex min-h-[80px] flex-col gap-2 rounded-2xl border border-dashed border-transparent bg-white/50 p-1 transition-colors ${
                              isDropTargetActive ? "border-[#f15b2b]" : ""
                            }`}
                          >
                            {columnTickets.length === 0 ? (
                              <div className="flex flex-1 items-center justify-center py-6 text-[11px] text-[#9a9892]">
                                No tickets in this column yet.
                              </div>
                            ) : (
                              columnTickets.map((ticket) =>
                                renderTicketCard(ticket),
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ticket detail modal */}
        {detailTicket && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-8">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                    Ticket
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[#424143]">
                    {detailTicket.title}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#7a7a7a]">
                    {detailTicket.project?.code &&
                      detailTicket.companyTicketNumber && (
                        <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5">
                          {detailTicket.project.code}-
                          {detailTicket.companyTicketNumber}
                        </span>
                      )}
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${statusBadgeClass[detailTicket.status]}`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${statusIndicatorColor(
                          detailTicket.status,
                        )}`}
                      />
                      {statusLabels[detailTicket.status].replace("_", " ")}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${priorityBadgeClass[detailTicket.priority]}`}
                    >
                      {formatPriorityLabel(detailTicket.priority)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeTicketDetails}
                  className="rounded-full bg-[#f5f3f0] px-2 py-1 text-[11px] text-[#7a7a7a] hover:bg-[#e4e0da]"
                >
                  Close
                </button>
              </div>

              {detailTicket.description && (
                <div className="mb-3 rounded-xl bg-[#f5f3f0] px-3 py-3 text-[11px] text-[#424143]">
                  {detailTicket.description}
                </div>
              )}

              <div className="grid gap-3 text-[11px] text-[#7a7a7a] md:grid-cols-2">
                <div>
                  <p className="font-semibold text-[#424143]">Meta</p>
                  <div className="mt-1 space-y-1">
                    <p>
                      Priority:{" "}
                      <span className="font-semibold">
                        {formatPriorityLabel(detailTicket.priority)}
                      </span>
                    </p>
                    <p>
                      Project:{" "}
                      <span className="font-semibold">
                        {detailTicket.project?.name || "—"}
                      </span>
                    </p>
                    <p>
                      Job type:{" "}
                      <span className="font-semibold">
                        {detailTicket.jobType?.name || "—"}
                      </span>
                    </p>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-[#424143]">People</p>
                  <div className="mt-1 space-y-1">
                    <p>
                      Designer:{" "}
                      <span className="font-semibold">
                        {detailTicket.designer?.name ||
                          detailTicket.designer?.email ||
                          "—"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 text-[11px] text-[#7a7a7a] md:grid-cols-2">
                <div>
                  <p className="font-semibold text-[#424143]">Dates</p>
                  <div className="mt-1 space-y-1">
                    <p>
                      Created:{" "}
                      <span className="font-semibold">
                        {formatDate(detailTicket.createdAt)}
                      </span>
                    </p>
                    <p>
                      Updated:{" "}
                      <span className="font-semibold">
                        {formatDate(detailTicket.updatedAt)}
                      </span>
                    </p>
                    <p>
                      Due date:{" "}
                      <span className="font-semibold">
                        {formatDate(detailTicket.dueDate)}
                      </span>
                    </p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-[#424143]">
                    Revision history
                  </p>
                  <div className="mt-1 space-y-1">
                    {detailRevisionsLoading && (
                      <p className="text-[#9a9892]">
                        Loading revision history…
                      </p>
                    )}

                    {!detailRevisionsLoading && detailRevisionsError && (
                      <p className="text-[#b13832]">{detailRevisionsError}</p>
                    )}

                    {!detailRevisionsLoading &&
                      !detailRevisionsError &&
                      (!detailRevisions || detailRevisions.length === 0) && (
                        <p className="text-[#9a9892]">
                          No revisions yet. Once your designer sends this ticket
                          for review, you&apos;ll see each version and your
                          feedback here.
                        </p>
                      )}

                    {!detailRevisionsLoading &&
                      !detailRevisionsError &&
                      detailRevisions &&
                      detailRevisions.length > 0 && (
                        <div className="space-y-2">
                          {detailRevisions.map((rev) => (
                            <div
                              key={rev.version}
                              className="rounded-xl bg-[#f5f3f0] px-3 py-2"
                            >
                              <p className="text-[10px] font-semibold text-[#424143]">
                                Version v{rev.version}
                              </p>

                              {rev.submittedAt && (
                                <p className="mt-1">
                                  Sent for review on{" "}
                                  <span className="font-semibold">
                                    {formatDate(rev.submittedAt)}
                                  </span>
                                  .
                                </p>
                              )}

                              {rev.feedbackAt && (
                                <p className="mt-1">
                                  Changes requested on{" "}
                                  <span className="font-semibold">
                                    {formatDate(rev.feedbackAt)}
                                  </span>
                                  .
                                </p>
                              )}

                              {rev.feedbackMessage && (
                                <p className="mt-1 italic text-[#5a5953]">
                                  “{rev.feedbackMessage}”
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Revision modal */}
        {pendingRevisionTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <h2 className="text-sm font-semibold text-[#424143]">
                Send this request back to your designer?
              </h2>
              <p className="mt-1 text-[11px] text-[#7a7a7a]">
                Your designer will see your message and continue working on this
                request. The status will move back to{" "}
                <span className="font-semibold">In progress</span>.
              </p>

              <div className="mt-3">
                <label className="block text-[11px] font-semibold text-[#424143]">
                  Message for your designer
                </label>
                <textarea
                  value={revisionMessage}
                  onChange={(e) => {
                    setRevisionMessage(e.target.value);
                    if (revisionMessageError) {
                      setRevisionMessageError(null);
                    }
                  }}
                  placeholder="For example: Could we make the hero headline larger and try a version with a darker background?"
                  className="mt-1 h-28 w-full rounded-2xl border border-[#e3dfd7] bg-white px-3 py-2 text-[12px] text-[#424143] shadow-sm outline-none placeholder:text-[#b1afa9] focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                />
                {revisionMessageError && (
                  <p className="mt-1 text-[11px] text-[#b13832]">
                    {revisionMessageError}
                  </p>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2 text-[12px]">
                <button
                  type="button"
                  onClick={handleCancelRevision}
                  className="rounded-full border border-[#e3dfd7] px-3 py-1 text-[#7a7a7a] hover:bg-[#f5f3f0]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevision}
                  className="rounded-full bg-[#f15b2b] px-3 py-1 font-semibold text-white hover:bg-[#e04f22]"
                >
                  Send back to designer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Done confirmation modal */}
        {pendingDoneTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <h2 className="text-sm font-semibold text-[#424143]">
                Mark this request as done?
              </h2>
              <p className="mt-1 text-[11px] text-[#7a7a7a]">
                Once you mark this request as done, your designer will get paid
                for this job, and the ticket will move to{" "}
                <span className="font-semibold">Done</span>.
              </p>

              <div className="mt-3 rounded-xl bg-[#f5f3f0] px-3 py-3 text-[11px] text-[#424143]">
                <p className="font-semibold">{pendingDoneTicket.title}</p>
                {pendingDoneTicket.project?.name && (
                  <p className="mt-1 text-[#7a7a7a]">
                    Project: {pendingDoneTicket.project.name}
                  </p>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2 text-[12px]">
                <button
                  type="button"
                  onClick={() => setPendingDoneTicketId(null)}
                  className="rounded-full border border-[#e3dfd7] px-3 py-1 text-[#7a7a7a] hover:bg-[#f5f3f0]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDone}
                  className="rounded-full bg-[#32b37b] px-3 py-1 font-semibold text-white hover:bg-[#2ba06a]"
                >
                  Yes, mark as done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
