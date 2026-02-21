// -----------------------------------------------------------------------------
// @file: app/customer/board/page.tsx
// @purpose: Customer-facing board view of company tickets (kanban + drag & drop
//           + detail & revision modals + inline new ticket modal + toasts)
// @version: v2.3.0
// @status: active
// @lastUpdate: 2025-12-12
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CompanyRole,
  normalizeCompanyRole,
  canMoveTicketsOnBoard,
  canEditTickets,
  canManageTags,
  canManageProjects,
} from "@/lib/permissions/companyRoles";
import { TicketStatus, TicketPriority } from "@prisma/client";
import { useToast } from "@/components/ui/toast-provider";
import { InlineAlert } from "@/components/ui/inline-alert";
import { EmptyState } from "@/components/ui/empty-state";
import {
  STATUS_ORDER,
  STATUS_LABELS,
  statusColumnClass,
  formatBoardDate,
  PRIORITY_ORDER,
  formatPriorityLabel,
  priorityBadgeVariant,
  statusBadgeVariant,
  columnAccentColor,
  PROJECT_COLORS,
  AVATAR_COLORS,
  avatarColor,
  priorityIconMap,
  priorityColorClass,
  formatDueDateShort,
  isDueDateOverdue,
  formatDueDateCountdown,
  getInitials,
} from "@/lib/board";
import { Badge } from "@/components/ui/badge";
import { TagBadge } from "@/components/ui/tag-badge";
import { TagMultiSelect, type TagOption } from "@/components/ui/tag-multi-select";
import type { TagColorKey } from "@/lib/tag-colors";
import { Modal, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { RevisionImage, RevisionImageGrid, RevisionImageLarge, DownloadAllButton, BriefThumbnailRow } from "@/components/ui/revision-image";
import { Button } from "@/components/ui/button";
import { FormInput, FormSelect } from "@/components/ui/form-field";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SafeHtml, stripHtml } from "@/components/ui/safe-html";
import {
  downloadSingleAsset,
  downloadAssetsAsZip,
} from "@/lib/download-helpers";

import NewTicketForm from "@/app/customer/tickets/new/NewTicketForm";

type CustomerBoardTicket = {
  id: string;
  code: string | null;
  title: string;
  description?: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  projectId: string | null;
  projectName: string | null;
  projectCode: string | null;
  isAssigned: boolean;
  jobTypeId: string | null;
  jobTypeName: string | null;
  createdAt: string;
  updatedAt?: string;
  dueDate: string | null;
  thumbnailUrl?: string | null;
  thumbnailAssetId?: string | null;
  tags?: { id: string; name: string; color: string }[];
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
  assets?: RevisionAsset[];
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

type NewTicketMetadataResponse = {
  companySlug: string;
  tokenBalance: number;
  projects: {
    id: string;
    name: string;
    code: string | null;
  }[];
  jobTypes: {
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    tokenCost: number;
    hasQuantity?: boolean;
    quantityLabel?: string | null;
    defaultQuantity?: number;
  }[];
  tags?: {
    id: string;
    name: string;
    color: string;
  }[];
};



// priorityIconMap, priorityColorClass, columnAccentColor, PROJECT_COLORS,
// AVATAR_COLORS, avatarColor, formatDueDateShort, isDueDateOverdue, getInitials
// are now imported from @/lib/board

const statusIndicatorColor = (status: TicketStatus): string => {
  switch (status) {
    case "TODO":
      return "bg-[var(--bb-text-muted)]";
    case "IN_PROGRESS":
      return "bg-[var(--bb-info-text)]";
    case "IN_REVIEW":
      return "bg-[var(--bb-warning-text)]";
    case "DONE":
      return "bg-[#32b37b]";
    default:
      return "bg-[var(--bb-text-muted)]";
  }
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
    const priorityIndexA = PRIORITY_ORDER.indexOf(a.priority);
    const priorityIndexB = PRIORITY_ORDER.indexOf(b.priority);
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
        "New requests in To do can only be picked up by your creative. You can approve or request changes once the ticket is In review.",
    };
  }

  if (ticket.status === "IN_PROGRESS") {
    return {
      allowed: false,
      reason:
        "In progress requests are controlled by your creative. You can approve work once it reaches In review.",
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
  const [filterOpen, setFilterOpen] = useState<boolean>(false);

  // Thumbnail presigned URL cache: assetId → downloadUrl
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const thumbnailFetchingRef = useRef<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

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
  const [showPreviousVersions, setShowPreviousVersions] = useState(false);

  // Brief attachments state
  type BriefAsset = { id: string; url: string | null; originalName: string | null };
  const [detailBriefAssets, setDetailBriefAssets] = useState<BriefAsset[]>([]);
  const [detailBriefAssetsLoading, setDetailBriefAssetsLoading] = useState(false);

  const [pendingDoneTicketId, setPendingDoneTicketId] = useState<
    string | null
  >(null);
  const [pendingDoneRevisions, setPendingDoneRevisions] = useState<
    TicketRevisionEntry[] | null
  >(null);
  const [pendingDoneRevisionsLoading, setPendingDoneRevisionsLoading] =
    useState(false);
  const [doneModalDownloading, setDoneModalDownloading] = useState(false);
  const [detailFooterDownloading, setDetailFooterDownloading] = useState(false);

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

  const [newTicketModalOpen, setNewTicketModalOpen] =
    useState<boolean>(false);
  const [newTicketMeta, setNewTicketMeta] =
    useState<NewTicketMetadataResponse | null>(null);
  const [newTicketMetaLoading, setNewTicketMetaLoading] =
    useState<boolean>(false);
  const [newTicketMetaError, setNewTicketMetaError] = useState<string | null>(
    null,
  );

  // New project modal
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSaving, setNewProjectSaving] = useState(false);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);

  // Sidebar projects (fetched from API — includes empty projects)
  type SidebarProject = { id: string; name: string; code: string | null; ticketCount: number };
  const [sidebarProjects, setSidebarProjects] = useState<SidebarProject[]>([]);

  // Project context menu
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);

  // Rename project modal
  const [renameProject, setRenameProject] = useState<SidebarProject | null>(null);
  const [renameProjectName, setRenameProjectName] = useState("");
  const [renameProjectSaving, setRenameProjectSaving] = useState(false);
  const [renameProjectError, setRenameProjectError] = useState<string | null>(null);

  // Delete project confirmation
  const [deleteProject, setDeleteProject] = useState<SidebarProject | null>(null);
  const [deleteProjectSaving, setDeleteProjectSaving] = useState(false);
  const [deleteProjectError, setDeleteProjectError] = useState<string | null>(null);

  // Inline edit state for detail modal
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    priority: string;
    dueDate: string;
    projectId: string;
    jobTypeId: string;
    tagIds: string[];
  }>({
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: "",
    projectId: "",
    jobTypeId: "",
    tagIds: [],
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const loadNewTicketMetadata = async () => {
    setNewTicketMetaLoading(true);
    setNewTicketMetaError(null);

  try {
      const res = await fetch("/api/customer/tickets/new-metadata", {
        cache: "no-store",
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // ignore
      }

      if (!res.ok) {
        const message =
          (json && (json.error || json.message)) ||
          `Failed to load data for new request (status ${res.status}).`;
        throw new Error(
          typeof message === "string"
            ? message
            : "Failed to load data for new request.",
        );
      }

      setNewTicketMeta(json as NewTicketMetadataResponse);
    } catch (err: unknown) {
      console.error(
        "[CustomerBoardPage] Failed to load new ticket metadata",
        err,
      );
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load data for new request.";

      setNewTicketMetaError(message);

      showToast({
        type: "error",
        title: "Could not open new request form",
        description: message,
      });
    } finally {
      setNewTicketMetaLoading(false);
    }
  };

  const openNewTicketModal = async () => {
    setNewTicketModalOpen(true);
    if (!newTicketMeta && !newTicketMetaLoading) {
      await loadNewTicketMetadata();
    }
  };

  const closeNewTicketModal = () => {
    setNewTicketModalOpen(false);
    setNewTicketMetaError(null);
  };

  const openNewProjectModal = () => {
    setNewProjectName("");
    setNewProjectError(null);
    setNewProjectModalOpen(true);
  };

  const closeNewProjectModal = () => {
    setNewProjectModalOpen(false);
    setNewProjectError(null);
  };

  const handleCreateProject = async () => {
    const trimmed = newProjectName.trim();
    if (!trimmed || trimmed.length < 2) {
      setNewProjectError("Project name must be at least 2 characters.");
      return;
    }
    setNewProjectSaving(true);
    setNewProjectError(null);
    try {
      const res = await fetch("/api/customer/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setNewProjectError(json?.error || "Failed to create project.");
        return;
      }
      closeNewProjectModal();
      showToast({
        type: "success",
        title: "Project created",
        description: `"${json.project.name}" (${json.project.code}) is ready.`,
      });
      // Refresh board + sidebar projects + new-ticket metadata
      void load();
      void loadSidebarProjects();
      setNewTicketMeta(null);
    } catch {
      setNewProjectError("Unexpected error creating project.");
    } finally {
      setNewProjectSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Sidebar projects: fetch, rename, delete
  // ---------------------------------------------------------------------------

  const loadSidebarProjects = async () => {
    try {
      const res = await fetch("/api/customer/projects", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.projects) {
        setSidebarProjects(json.projects);
      }
    } catch {
      // Silently fail — sidebar falls back to empty
    }
  };

  const openRenameProject = (proj: SidebarProject) => {
    setRenameProject(proj);
    setRenameProjectName(proj.name);
    setRenameProjectError(null);
    setProjectMenuId(null);
  };

  const closeRenameProject = () => {
    setRenameProject(null);
    setRenameProjectError(null);
  };

  const handleRenameProject = async () => {
    if (!renameProject) return;
    const trimmed = renameProjectName.trim();
    if (!trimmed || trimmed.length < 2) {
      setRenameProjectError("Project name must be at least 2 characters.");
      return;
    }
    setRenameProjectSaving(true);
    setRenameProjectError(null);
    try {
      const res = await fetch(`/api/customer/projects/${renameProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setRenameProjectError(json?.error || "Failed to rename project.");
        return;
      }
      closeRenameProject();
      showToast({ type: "success", title: "Project renamed" });
      void load();
      void loadSidebarProjects();
      setNewTicketMeta(null);
    } catch {
      setRenameProjectError("Unexpected error renaming project.");
    } finally {
      setRenameProjectSaving(false);
    }
  };

  const openDeleteProject = (proj: SidebarProject) => {
    setDeleteProject(proj);
    setDeleteProjectError(null);
    setProjectMenuId(null);
  };

  const closeDeleteProject = () => {
    setDeleteProject(null);
    setDeleteProjectError(null);
  };

  const handleDeleteProject = async () => {
    if (!deleteProject) return;
    setDeleteProjectSaving(true);
    setDeleteProjectError(null);
    try {
      const res = await fetch(`/api/customer/projects/${deleteProject.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setDeleteProjectError(json?.error || "Failed to delete project.");
        return;
      }
      closeDeleteProject();
      setProjectFilter("ALL");
      showToast({
        type: "success",
        title: "Project deleted",
        description:
          json.unlinkedTickets > 0
            ? `${json.unlinkedTickets} ticket(s) moved to "No project".`
            : undefined,
      });
      void load();
      void loadSidebarProjects();
      setNewTicketMeta(null);
    } catch {
      setDeleteProjectError("Unexpected error deleting project.");
    } finally {
      setDeleteProjectSaving(false);
    }
  };

  // Close project menu when clicking outside
  useEffect(() => {
    if (!projectMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setProjectMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [projectMenuId]);

  useEffect(() => {
    let cancelled = false;
    const initialLoad = async () => {
      if (cancelled) return;
      await load();
      await loadSidebarProjects();
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

        const entries = ((json as any)?.revisions ??
          []) as TicketRevisionEntry[];

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
  // Fetch revisions for "Mark as done" modal preview
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!pendingDoneTicketId) {
      setPendingDoneRevisions(null);
      setPendingDoneRevisionsLoading(false);
      setDoneModalDownloading(false);
      return;
    }

    let cancelled = false;
    const loadRevisions = async () => {
      setPendingDoneRevisionsLoading(true);
      try {
        const res = await fetch(
          `/api/customer/tickets/${pendingDoneTicketId}/revisions`,
          { cache: "no-store" },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || cancelled) return;
        const entries = ((json as any)?.revisions ?? []) as TicketRevisionEntry[];
        if (!cancelled) setPendingDoneRevisions(entries);
      } catch {
        // silently fail — modal still usable without preview
      } finally {
        if (!cancelled) setPendingDoneRevisionsLoading(false);
      }
    };
    loadRevisions();
    return () => { cancelled = true; };
  }, [pendingDoneTicketId]);

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
          `/api/customer/tickets/${detailTicketId}/assets?kind=BRIEF_INPUT`,
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
  // Derived values
  // ---------------------------------------------------------------------------

  const tickets = data?.tickets ?? [];

  const projects = useMemo(() => {
    const list = Array.from(
      new Set(
        tickets
          .map((t) => t.projectName)
          .filter((p): p is string => !!p),
      ),
    );
    list.sort((a, b) => a.localeCompare(b));
    return list;
  }, [tickets]);

  // Fetch presigned URLs for thumbnails that have an assetId but no public url
  useEffect(() => {
    const toFetch = tickets.filter(
      (t) =>
        t.thumbnailAssetId &&
        !t.thumbnailUrl &&
        !thumbnailUrls[t.thumbnailAssetId] &&
        !thumbnailFetchingRef.current.has(t.thumbnailAssetId),
    );
    if (toFetch.length === 0) return;

    for (const t of toFetch) {
      const assetId = t.thumbnailAssetId!;
      thumbnailFetchingRef.current.add(assetId);
      fetch(`/api/assets/${assetId}/download`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.downloadUrl) {
            setThumbnailUrls((prev) => ({ ...prev, [assetId]: data.downloadUrl }));
          }
        })
        .catch(() => {})
        .finally(() => {
          thumbnailFetchingRef.current.delete(assetId);
        });
    }
  }, [tickets, thumbnailUrls]);

  // "/" keyboard shortcut to focus search
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

  const assignedCount = useMemo(
    () => tickets.filter((t) => t.isAssigned).length,
    [tickets],
  );

  const projectsWithColors = useMemo(() => {
    const projectMap = new Map<
      string,
      { name: string; code: string | null; count: number }
    >();
    for (const t of tickets) {
      if (t.projectName) {
        const existing = projectMap.get(t.projectName);
        if (existing) {
          existing.count += 1;
        } else {
          projectMap.set(t.projectName, {
            name: t.projectName,
            code: t.projectCode,
            count: 1,
          });
        }
      }
    }
    return Array.from(projectMap.values()).sort((a, b) => b.count - a.count);
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (projectFilter !== "ALL" && t.projectName !== projectFilter) {
        return false;
      }

      const q = search.trim().toLowerCase();
      if (q) {
        const code = (t.code ?? "").toLowerCase();
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
    for (const status of STATUS_ORDER) {
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
          "Your creative will be paid for this job and the ticket has moved to Done.",
      };
    }

    if (status === "IN_PROGRESS" && options?.hasRevisionMessage) {
      return {
        title: "Changes requested",
        description:
          "Your message has been sent to your creative and the ticket is back in progress.",
      };
    }

    if (status === "IN_PROGRESS") {
      return {
        title: "Request moved back to In progress",
        description: "This ticket is now open again for your creative.",
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
            } as CustomerBoardResponse;
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
    setShowPreviousVersions(false);
    setDetailBriefAssets([]);
    setDetailBriefAssetsLoading(false);
    setIsEditingDetail(false);
    setEditError(null);
  };

  // ---------------------------------------------------------------------------
  // Inline edit — permission + handlers
  // ---------------------------------------------------------------------------

  const canEditDetail =
    detailTicket?.status === "TODO" && canEditTickets(companyRole);

  const startEditingDetail = () => {
    if (!detailTicket) return;
    setEditForm({
      title: detailTicket.title,
      description: detailTicket.description ?? "",
      priority: detailTicket.priority,
      dueDate: detailTicket.dueDate
        ? new Date(detailTicket.dueDate).toISOString().split("T")[0]
        : "",
      projectId: detailTicket.projectId ?? "",
      jobTypeId: detailTicket.jobTypeId ?? "",
      tagIds: (detailTicket.tags ?? []).map((t) => t.id),
    });
    setEditError(null);
    setIsEditingDetail(true);

    // Load metadata for dropdowns if not already loaded
    if (!newTicketMeta && !newTicketMetaLoading) {
      loadNewTicketMetadata();
    }
  };

  const cancelEditingDetail = () => {
    setIsEditingDetail(false);
    setEditError(null);
  };

  const saveDetailEdits = async () => {
    if (!detailTicket) return;
    setEditSaving(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/customer/tickets/${detailTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          priority: editForm.priority,
          dueDate: editForm.dueDate || null,
          projectId: editForm.projectId || null,
          jobTypeId: editForm.jobTypeId || null,
          tagIds: editForm.tagIds,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setEditError(json?.error || "Failed to save changes.");
        return;
      }

      // Update the ticket in local state so the board reflects changes
      const updatedTicket = json.ticket;
      setData((prev) => {
        if (!prev) return prev;
        const updatedTickets = prev.tickets.map((t) =>
          t.id === detailTicket.id
            ? {
                ...t,
                title: updatedTicket.title,
                description: updatedTicket.description,
                priority: updatedTicket.priority,
                dueDate: updatedTicket.dueDate,
                updatedAt: updatedTicket.updatedAt,
                projectId: updatedTicket.projectId ?? null,
                projectName: updatedTicket.projectName ?? null,
                projectCode: updatedTicket.projectCode ?? null,
                jobTypeId: updatedTicket.jobTypeId ?? null,
                jobTypeName: updatedTicket.jobTypeName ?? null,
                code: updatedTicket.code ?? t.code,
                tags: updatedTicket.tags ?? t.tags,
              }
            : t,
        );
        return {
          ...prev,
          tickets: updatedTickets,
          stats: computeStats(updatedTickets),
        };
      });

      setIsEditingDetail(false);
      showToast({
        type: "success",
        title: "Ticket updated",
        description: "Your changes have been saved.",
      });
    } catch (err) {
      console.error("[DetailModal] Save edit error:", err);
      setEditError("Unexpected error while saving changes.");
    } finally {
      setEditSaving(false);
    }
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
      const msg = "Please add a short message for your creative.";
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


  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderTicketCard = (ticket: CustomerBoardTicket) => {
    const isDragging = draggingTicketId === ticket.id;
    const isUpdating = updatingTicketId === ticket.id;
    const dueDateLabel = formatDueDateShort(ticket.dueDate);
    const overdue = isDueDateOverdue(ticket.dueDate);
    const thumbSrc =
      ticket.thumbnailUrl ??
      (ticket.thumbnailAssetId ? thumbnailUrls[ticket.thumbnailAssetId] : null) ??
      null;

    return (
      <div
        key={ticket.id}
        className={`group cursor-pointer rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-3.5 text-xs shadow-sm transition-all duration-200 ${
          isDragging ? "scale-[1.02] opacity-50 shadow-lg" : "hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--bb-primary-border)]"
        }`}
        draggable={canDragTicket && ticket.status === "IN_REVIEW"}
        onDragStart={(event) =>
          handleDragStart(event, ticket.id, ticket.status)
        }
        onDragEnd={handleDragEnd}
        onMouseDown={(event) => handleMouseDown(event, ticket.id)}
        onMouseUp={(event) => handleMouseUp(event, ticket.id)}
      >
        {/* Title */}
        <p className="text-sm font-semibold leading-snug text-[var(--bb-secondary)]">
          {ticket.title}
        </p>

        {/* Description */}
        {ticket.description && (
          <p className="mt-1 line-clamp-2 text-xs text-[var(--bb-text-secondary)]">
            {stripHtml(ticket.description)}
          </p>
        )}

        {/* Thumbnail */}
        {thumbSrc && (
          <div className="mt-2 overflow-hidden rounded-lg bg-[var(--bb-bg-card)]">
            <img
              src={thumbSrc}
              alt=""
              className="h-28 w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Due date pill */}
        {dueDateLabel && (
          <div className="mt-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                overdue
                  ? "bg-[var(--bb-danger-bg)] text-[var(--bb-danger-text)]"
                  : "bg-[var(--bb-info-bg)] text-[var(--bb-info-text)]"
              }`}
            >
              <span className="text-[9px]">📅</span>
              {dueDateLabel}
            </span>
          </div>
        )}

        {/* Tags */}
        {ticket.tags && ticket.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {ticket.tags.slice(0, 3).map((tag) => (
              <TagBadge
                key={tag.id}
                name={tag.name}
                color={tag.color as TagColorKey}
              />
            ))}
            {ticket.tags.length > 3 && (
              <span className="inline-flex items-center text-[10px] text-[var(--bb-text-tertiary)]">
                +{ticket.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer: ticket code + priority icon + avatar */}
        <div className="mt-3 flex items-center justify-between border-t border-[var(--bb-border-subtle)] pt-2.5 text-[10px] text-[var(--bb-text-tertiary)]">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#3B82F6]">✓</span>
            {ticket.code && (
              <span className="font-medium text-[var(--bb-text-secondary)]">
                {ticket.code}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] ${priorityColorClass(ticket.priority)}`}
              title={formatPriorityLabel(ticket.priority)}
            >
              {priorityIconMap[ticket.priority]}
            </span>
            {ticket.isAssigned && (
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full bg-[#22C55E] text-[8px] font-bold text-white"
                title="Assigned"
              >
                &#x2713;
              </span>
            )}
          </div>
        </div>

        {/* Updating indicator */}
        {isUpdating && (
          <div className="mt-2 text-[10px] text-[var(--bb-text-tertiary)]">
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
      <div className="mt-4 grid gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr]">
        {/* Left sidebar — Projects + workspace info */}
        <aside className="flex flex-col rounded-2xl bg-[var(--bb-bg-page)]/60 p-4">
          {/* Projects header */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bb-text-tertiary)]">
              Projects
            </p>
            <button
              type="button"
              onClick={openNewProjectModal}
              className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--bb-primary)] text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--bb-primary-hover)] hover:shadow-md active:scale-95"
              title="Create new project"
            >
              +
            </button>
          </div>

          {/* Project items list */}
          <div className="mt-3 space-y-0.5">
            {sidebarProjects.length === 0 && (
              <p className="px-2 py-2 text-[11px] text-[var(--bb-text-muted)]">
                No projects yet.
              </p>
            )}
            {sidebarProjects.slice(0, 8).map((proj, idx) => {
              const color =
                PROJECT_COLORS[idx % PROJECT_COLORS.length];
              const isActive = projectFilter === proj.name;
              const showMenu = canManageProjects(companyRole);
              const menuOpen = projectMenuId === proj.id;
              return (
                <div key={proj.id} className="group relative">
                  <button
                    type="button"
                    onClick={() =>
                      setProjectFilter(isActive ? "ALL" : proj.name)
                    }
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors ${
                      isActive
                        ? "bg-[var(--bb-bg-card)] font-semibold text-[var(--bb-secondary)]"
                        : "text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-card)]"
                    }`}
                  >
                    <span
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {proj.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{proj.name}</span>

                    {/* Ticket count — hidden on hover when menu is available */}
                    <span className={`flex-shrink-0 rounded-full bg-[var(--bb-border-subtle)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--bb-text-tertiary)] ${showMenu ? "group-hover:hidden" : ""}`}>
                      {proj.ticketCount}
                    </span>

                    {/* Menu trigger — replaces count on hover */}
                    {showMenu && (
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectMenuId(menuOpen ? null : proj.id);
                        }}
                        className={`hidden flex-shrink-0 items-center justify-center rounded-md px-1 py-0.5 text-[13px] font-bold leading-none tracking-wider text-[var(--bb-text-tertiary)] transition-colors hover:bg-[var(--bb-border)] hover:text-[var(--bb-secondary)] group-hover:flex ${menuOpen ? "!flex bg-[var(--bb-border)] text-[var(--bb-secondary)]" : ""}`}
                      >
                        &#8943;
                      </span>
                    )}
                  </button>

                  {/* Dropdown menu */}
                  {menuOpen && (
                    <div
                      ref={projectMenuRef}
                      className="absolute left-full top-0 z-50 ml-1 min-w-[140px] rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] py-1.5 shadow-xl"
                    >
                      <button
                        type="button"
                        onClick={() => openRenameProject(proj)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-bg-card)]"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-[var(--bb-text-tertiary)]">
                          <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                          <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
                        </svg>
                        Rename
                      </button>
                      <div className="mx-2 my-1 border-t border-[var(--bb-border-subtle)]" />
                      <button
                        type="button"
                        onClick={() => openDeleteProject(proj)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                          <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                        </svg>
                        Delete project
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* View all projects link */}
          {sidebarProjects.length > 8 ? (
            <button
              type="button"
              onClick={() => setProjectFilter("ALL")}
              className="mt-2 text-left text-[10px] font-medium text-[var(--bb-primary)] hover:underline"
            >
              View all projects
            </button>
          ) : sidebarProjects.length > 0 ? (
            <button
              type="button"
              onClick={() => setProjectFilter("ALL")}
              className={`mt-1 text-left text-[10px] font-medium transition-colors ${
                projectFilter === "ALL"
                  ? "text-[var(--bb-secondary)]"
                  : "text-[var(--bb-text-muted)] hover:text-[var(--bb-text-secondary)]"
              }`}
            >
              All projects
            </button>
          ) : null}

          {/* Divider */}
          <div className="my-4 border-t border-[var(--bb-border)]" />

          {/* All requests card */}
          <div className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-[var(--bb-secondary)]">
                  All requests
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--bb-text-tertiary)]">
                  Board for your active company.
                </p>
              </div>
              {currentStats && (
                <span className="rounded-full bg-[var(--bb-bg-page)] px-3 py-1 text-[11px] font-semibold text-[var(--bb-secondary)]">
                  {currentStats.total}
                </span>
              )}
            </div>
          </div>

          {/* Role display */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--bb-text-secondary)]">
            <span className="font-semibold text-[var(--bb-secondary)]">Your role:</span>
            {companyRoleLoading ? (
              <span className="rounded-full bg-[var(--bb-bg-card)] px-2 py-0.5">
                Loading…
              </span>
            ) : companyRole ? (
              <span className="rounded-full bg-[var(--bb-bg-card)] px-2 py-0.5 font-semibold text-[var(--bb-secondary)]">
                {companyRole}
              </span>
            ) : (
              <span className="rounded-full bg-[var(--bb-bg-card)] px-2 py-0.5">
                Not set
              </span>
            )}
          </div>

          <div className="mt-auto pt-4 text-[10px] text-[var(--bb-text-tertiary)]">
            <p>Viewing creative requests for your workspace.</p>
          </div>
        </aside>

        {/* Main board area */}
        <main className="flex min-w-0 flex-col">
          {/* Header — project-aware */}
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {projectFilter !== "ALL" ? (
                <>
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{
                      backgroundColor:
                        PROJECT_COLORS[
                          projectsWithColors.findIndex(
                            (p) => p.name === projectFilter,
                          ) % PROJECT_COLORS.length
                        ] || "#3B82F6",
                    }}
                  >
                    {projectFilter.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h1 className="text-xl font-semibold tracking-tight">
                      {projectFilter}
                    </h1>
                    <button
                      type="button"
                      className="mt-0.5 text-[10px] text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)] hover:underline"
                    >
                      ⚙ Project settings
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bb-text-muted)]">
                    Customer board
                  </p>
                  <h1 className="mt-1 text-xl font-semibold tracking-tight">
                    Creative requests
                  </h1>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openNewTicketModal}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--bb-primary)] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-[var(--bb-primary-hover)]"
              >
                <span className="text-[13px]">+</span>
                New ticket
              </button>
              {loading && (
                <div className="rounded-full bg-[var(--bb-bg-card)] px-3 py-1 text-[11px] text-[var(--bb-text-secondary)]">
                  Loading board…
                </div>
              )}
            </div>
          </div>
          {/* Error / alerts */}
          {loadError && (
            <InlineAlert variant="error" className="mb-3">
              {loadError}
            </InlineAlert>
          )}

          {companyRoleError && (
            <InlineAlert variant="error" className="mb-3">
              {companyRoleError}
            </InlineAlert>
          )}

          {mutationError && (
            <InlineAlert variant="warning" className="mb-4">
              {mutationError}
            </InlineAlert>
          )}

          {/* Toolbar: search + avatars + share + filter */}
          <div className="mb-3 flex items-center gap-3">
            {/* Search */}
            <div className="relative max-w-md flex-1">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search board"
                className="w-full rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-2 text-xs text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-[var(--bb-text-muted)]">
                🔍
              </span>
            </div>

            {/* Assignment summary */}
            {assignedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0fdf4] px-2.5 py-1 text-[11px] font-medium text-[#22C55E]">
                <span className="inline-block h-2 w-2 rounded-full bg-[#22C55E]" />
                {assignedCount} assigned
              </span>
            )}

            {/* Share button — copies board URL to clipboard */}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                  showToast({ type: "success", title: "Link copied to clipboard" });
                });
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-2 text-[11px] font-medium text-[var(--bb-text-secondary)] transition-colors hover:border-[var(--bb-secondary)] hover:text-[var(--bb-secondary)]"
            >
              ↗ Share
            </button>

            {/* Filter button */}
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors ${
                filterOpen
                  ? "border-[var(--bb-primary)] bg-[var(--bb-primary-light)] text-[var(--bb-primary)]"
                  : "border-[var(--bb-border)] bg-[var(--bb-bg-page)] text-[var(--bb-text-secondary)] hover:border-[var(--bb-secondary)] hover:text-[var(--bb-secondary)]"
              }`}
            >
              ≡ Filter
            </button>
          </div>

          {/* Collapsible filter dropdown */}
          {filterOpen && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-2 text-[11px] text-[var(--bb-text-secondary)]">
              <span className="font-medium">Project:</span>
              <select
                className="rounded-md border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-2 py-1 text-[11px] outline-none"
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
              {projectFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setProjectFilter("ALL")}
                  className="ml-1 text-[10px] text-[var(--bb-primary)] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Columns */}
          {loading ? (
            <div className="py-6 text-center text-sm text-[var(--bb-text-secondary)]">
              Loading your board…
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:snap-none">
              {STATUS_ORDER.map((status) => {
                const columnTickets = ticketsByStatus[status] ?? [];
                const columnTitle = STATUS_LABELS[status];
                const isDropTargetActive = dragOverStatus === status;

                return (
                  <div
                    key={status}
                    id={`customer-board-column-${status}`}
                    className={`flex w-80 shrink-0 snap-start flex-col overflow-hidden rounded-xl transition-all duration-200 ${
                      isDropTargetActive
                        ? "bg-[var(--bb-primary-light)] ring-2 ring-[var(--bb-primary)]/60"
                        : "bg-[var(--bb-bg-page)]/60 ring-0"
                    }`}
                    onDragOver={(event) => handleDragOver(event, status)}
                    onDrop={(event) => handleDrop(event, status)}
                  >
                    {/* Colored accent bar */}
                    <div
                      className="h-1 w-full"
                      style={{ backgroundColor: columnAccentColor[status] }}
                    />

                    {/* Column header */}
                    <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--bb-text-secondary)]">
                        {columnTitle}
                      </span>
                      <span className="rounded-full bg-[var(--bb-bg-card)] px-2 py-0.5 text-[10px] font-semibold text-[var(--bb-text-secondary)]">
                        {columnTickets.length}
                      </span>
                    </div>

                    {/* Column body */}
                    <div className="flex-1 space-y-2 p-2">
                      {columnTickets.length === 0 && !isDropTargetActive ? (
                        <EmptyState title={status === "DONE" ? "Completed tickets will appear here." : "No tickets here yet."} />
                      ) : (
                        columnTickets.map((ticket) =>
                          renderTicketCard(ticket),
                        )
                      )}
                      {/* Drop placeholder */}
                      {isDropTargetActive && (
                        <div className="animate-pulse rounded-xl border-2 border-dashed border-[var(--bb-primary)]/40 bg-[var(--bb-primary)]/5 px-3 py-4 text-center text-[11px] font-medium text-[var(--bb-primary)]/60">
                          Drop here
                        </div>
                      )}
                    </div>

                    {/* "+ Create" button at bottom of TO DO column */}
                    {status === "TODO" && (
                      <button
                        type="button"
                        onClick={openNewTicketModal}
                        className="mx-2 mb-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--bb-border-input)] py-2 text-xs font-semibold text-[var(--bb-text-tertiary)] transition-colors hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)]"
                      >
                        <span className="text-sm">+</span>
                        Create
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

        {/* New ticket modal */}
        <Modal open={newTicketModalOpen} onClose={closeNewTicketModal} size="2xl" scrollable>
          <ModalHeader
            eyebrow="New request"
            title="Create a new creative request"
            subtitle="This will be added to your board in the To do column."
            onClose={closeNewTicketModal}
          />

              {newTicketMetaError && (
                <InlineAlert variant="error" size="sm" className="mb-3">
                  {newTicketMetaError}
                </InlineAlert>
              )}

              {newTicketMetaLoading || !newTicketMeta ? (
                <p className="text-[11px] text-[var(--bb-text-secondary)]">
                  Loading form…
                </p>
              ) : (
                <NewTicketForm
                  companySlug={newTicketMeta.companySlug}
                  projects={newTicketMeta.projects}
                  jobTypes={newTicketMeta.jobTypes}
                  tokenBalance={newTicketMeta.tokenBalance}
                  tags={(newTicketMeta.tags ?? []) as TagOption[]}
                  canCreateTags={canManageTags(companyRole)}
                  onTagCreated={(tag) => {
                    setNewTicketMeta((prev) =>
                      prev
                        ? {
                            ...prev,
                            tags: [...(prev.tags ?? []), tag].sort(
                              (a, b) => a.name.localeCompare(b.name),
                            ),
                          }
                        : prev,
                    );
                  }}
                  redirectTo="/customer/board"
                  onCreated={() => {
                    closeNewTicketModal();
                    showToast({
                      type: "success",
                      title: "New request created",
                      description:
                        "Your request was added to the To do column.",
                    });
                    void load();
                  }}
                />
              )}
        </Modal>

        {/* New project modal */}
        <Modal open={newProjectModalOpen} onClose={closeNewProjectModal} size="sm">
          <ModalHeader
            eyebrow="New project"
            title="Create a project"
            subtitle="Group related creative requests under one project."
            onClose={closeNewProjectModal}
          />

          <div className="space-y-4 px-5 pb-2">
            {newProjectError && (
              <InlineAlert variant="error" size="sm">
                {newProjectError}
              </InlineAlert>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--bb-secondary)]">
                Project name
              </label>
              <FormInput
                type="text"
                value={newProjectName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProjectName(e.target.value)}
                placeholder="e.g. Q1 Campaign, Website Redesign"
                disabled={newProjectSaving}
                autoFocus
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter" && !newProjectSaving) {
                    e.preventDefault();
                    handleCreateProject();
                  }
                }}
              />
              <p className="text-[11px] text-[var(--bb-text-tertiary)]">
                A short code will be generated automatically from the name.
              </p>
            </div>
          </div>

          <ModalFooter>
            <Button
              variant="secondary"
              size="sm"
              onClick={closeNewProjectModal}
              disabled={newProjectSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateProject}
              loading={newProjectSaving}
              loadingText="Creating..."
              disabled={!newProjectName.trim() || newProjectName.trim().length < 2}
            >
              Create project
            </Button>
          </ModalFooter>
        </Modal>

        {/* Rename project modal */}
        <Modal open={!!renameProject} onClose={closeRenameProject} size="sm">
          <ModalHeader
            eyebrow="Rename project"
            title={renameProject?.name ?? ""}
            subtitle="Change the display name of this project."
            onClose={closeRenameProject}
          />

          <div className="space-y-4 px-5 pb-2">
            {renameProjectError && (
              <InlineAlert variant="error" size="sm">
                {renameProjectError}
              </InlineAlert>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--bb-secondary)]">
                New name
              </label>
              <FormInput
                type="text"
                value={renameProjectName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenameProjectName(e.target.value)}
                placeholder="Project name"
                disabled={renameProjectSaving}
                autoFocus
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter" && !renameProjectSaving) {
                    e.preventDefault();
                    handleRenameProject();
                  }
                }}
              />
            </div>
          </div>

          <ModalFooter>
            <Button
              variant="secondary"
              size="sm"
              onClick={closeRenameProject}
              disabled={renameProjectSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRenameProject}
              loading={renameProjectSaving}
              loadingText="Saving..."
              disabled={!renameProjectName.trim() || renameProjectName.trim().length < 2}
            >
              Save
            </Button>
          </ModalFooter>
        </Modal>

        {/* Delete project confirmation modal */}
        <Modal open={!!deleteProject} onClose={closeDeleteProject} size="sm">
          <ModalHeader
            eyebrow="Delete project"
            title={deleteProject?.name ?? ""}
            onClose={closeDeleteProject}
          />

          <div className="space-y-3 px-5 pb-2">
            {deleteProjectError && (
              <InlineAlert variant="error" size="sm">
                {deleteProjectError}
              </InlineAlert>
            )}

            <p className="text-sm text-[var(--bb-secondary)]">
              Are you sure you want to delete this project?
            </p>

            {deleteProject && deleteProject.ticketCount > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                <strong>{deleteProject.ticketCount} ticket{deleteProject.ticketCount !== 1 ? "s" : ""}</strong>{" "}
                will be moved to &ldquo;No project&rdquo;. No tickets will be deleted.
              </div>
            )}

            {deleteProject && deleteProject.ticketCount === 0 && (
              <p className="text-[11px] text-[var(--bb-text-tertiary)]">
                This project has no tickets.
              </p>
            )}
          </div>

          <ModalFooter>
            <Button
              variant="secondary"
              size="sm"
              onClick={closeDeleteProject}
              disabled={deleteProjectSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDeleteProject}
              loading={deleteProjectSaving}
              loadingText="Deleting..."
              className="bg-red-600 hover:bg-red-700"
            >
              Delete project
            </Button>
          </ModalFooter>
        </Modal>

        {/* Ticket detail modal — Jira-style two-column layout */}
        <Modal open={!!detailTicket} onClose={closeTicketDetails} size="full">
          <ModalHeader
            eyebrow="Ticket"
            title={detailTicket?.title ?? ""}
            subtitle={detailTicket?.code ?? undefined}
            onClose={closeTicketDetails}
          />

              {detailTicket && (
              <>
              {/* Edit button — only for TODO tickets with permission */}
              {canEditDetail && !isEditingDetail && (
                <button
                  type="button"
                  onClick={startEditingDetail}
                  className="mb-3 flex items-center gap-1.5 rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-1.5 text-[11px] font-medium text-[var(--bb-text-secondary)] transition-colors hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                  </svg>
                  Edit ticket
                </button>
              )}

              {/* Status / priority pills */}
              <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2">
                <Badge variant={statusBadgeVariant(detailTicket.status)} className="gap-1.5">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${statusIndicatorColor(
                      detailTicket.status,
                    )}`}
                  />
                  {STATUS_LABELS[detailTicket.status]}
                </Badge>
                <Badge variant={priorityBadgeVariant(detailTicket.priority)}>
                  <span className={priorityColorClass(detailTicket.priority)}>
                    {priorityIconMap[detailTicket.priority]}
                  </span>
                  {" "}{formatPriorityLabel(detailTicket.priority)}
                </Badge>
              </div>

              {/* Two-column Jira layout */}
              <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto md:grid-cols-[1fr_260px] md:overflow-visible">
                {/* Left column — main content (scrollable on desktop) */}
                <div className="min-w-0 md:overflow-y-auto md:pr-2">
                  {/* Description — edit mode or read mode */}
                  {isEditingDetail ? (
                    <div className="mb-5 space-y-4">
                      {editError && (
                        <InlineAlert variant="error" size="sm">{editError}</InlineAlert>
                      )}

                      {/* Title edit */}
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Title</p>
                        <FormInput
                          value={editForm.title}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setEditForm((f) => ({ ...f, title: e.target.value }))
                          }
                          disabled={editSaving}
                        />
                      </div>

                      {/* Description edit */}
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">Description</p>
                        <RichTextEditor
                          value={editForm.description}
                          onChange={(html) =>
                            setEditForm((f) => ({ ...f, description: html }))
                          }
                          disabled={editSaving}
                          minHeight="60px"
                        />
                      </div>

                      {/* Save/Cancel */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={saveDetailEdits}
                          loading={editSaving}
                          loadingText="Saving…"
                        >
                          Save changes
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={cancelEditingDetail}
                          disabled={editSaving}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    detailTicket.description && (
                      <div className="mb-5">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">
                          Description
                        </p>
                        <SafeHtml
                          html={detailTicket.description}
                          className="rounded-xl bg-[var(--bb-bg-warm)] px-4 py-3 text-xs leading-relaxed text-[var(--bb-secondary)]"
                        />
                      </div>
                    )
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
                      <EmptyState title="No revisions yet." description="Once your creative sends this ticket for review, you'll see each version and your feedback here." />
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
                                  Sent for review on{" "}
                                  <span className="font-semibold">{formatBoardDate(latestRev.submittedAt)}</span>
                                </p>
                              )}

                              {latestRev.feedbackAt && (
                                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--bb-warning-text)]">
                                  <span className="text-[10px]">💬</span>
                                  Changes requested on{" "}
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

                              {/* Large image display for current version */}
                              {latestRev.assets && latestRev.assets.length > 0 && (
                                <RevisionImageLarge
                                  assets={latestRev.assets}
                                  pinMode={detailTicket?.status === "IN_REVIEW" ? "review" : "view"}
                                  ticketId={detailTicket?.id}
                                  onRevisionSubmitted={() => {
                                    closeTicketDetails();
                                    showToast({
                                      type: "success",
                                      title: "Changes requested",
                                      description: "Your pin annotations have been sent to your creative.",
                                    });
                                    void load();
                                  }}
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
                                          Sent for review on{" "}
                                          <span className="font-semibold">{formatBoardDate(rev.submittedAt)}</span>
                                        </p>
                                      )}

                                      {rev.feedbackAt && (
                                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--bb-warning-text)]">
                                          <span className="text-[10px]">💬</span>
                                          Changes requested on{" "}
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
                            className={`inline-block h-1.5 w-1.5 rounded-full ${statusIndicatorColor(
                              detailTicket.status,
                            )}`}
                          />
                          {STATUS_LABELS[detailTicket.status]}
                        </div>
                      </div>
                      <div>
                        <p className="text-[var(--bb-text-tertiary)]">Priority</p>
                        {isEditingDetail ? (
                          <FormSelect
                            size="sm"
                            value={editForm.priority}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                              setEditForm((f) => ({ ...f, priority: e.target.value }))
                            }
                            disabled={editSaving}
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="URGENT">Urgent</option>
                          </FormSelect>
                        ) : (
                          <p className="mt-0.5 font-semibold text-[var(--bb-secondary)]">
                            <span className={priorityColorClass(detailTicket.priority)}>
                              {priorityIconMap[detailTicket.priority]}
                            </span>
                            {" "}{formatPriorityLabel(detailTicket.priority)}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[var(--bb-text-tertiary)]">Project</p>
                        {isEditingDetail ? (
                          <FormSelect
                            size="sm"
                            value={editForm.projectId}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                              setEditForm((f) => ({ ...f, projectId: e.target.value }))
                            }
                            disabled={editSaving || !newTicketMeta}
                          >
                            <option value="">No specific project</option>
                            {(newTicketMeta?.projects ?? []).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}{p.code ? ` (${p.code})` : ""}
                              </option>
                            ))}
                          </FormSelect>
                        ) : (
                          <p className="mt-0.5 font-semibold text-[var(--bb-secondary)]">
                            {detailTicket.projectName || "—"}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[var(--bb-text-tertiary)]">Job type</p>
                        {isEditingDetail ? (
                          <FormSelect
                            size="sm"
                            value={editForm.jobTypeId}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                              setEditForm((f) => ({ ...f, jobTypeId: e.target.value }))
                            }
                            disabled={editSaving || !newTicketMeta}
                          >
                            <option value="">Choose a job type</option>
                            {(newTicketMeta?.jobTypes ?? []).map((jt) => (
                              <option key={jt.id} value={jt.id}>
                                {jt.name}
                              </option>
                            ))}
                          </FormSelect>
                        ) : (
                          <p className="mt-0.5 font-semibold text-[var(--bb-secondary)]">
                            {detailTicket.jobTypeName || "—"}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[var(--bb-text-tertiary)]">Tags</p>
                        {isEditingDetail ? (
                          <div className="mt-1">
                            <TagMultiSelect
                              availableTags={((newTicketMeta?.tags ?? []) as TagOption[])}
                              selectedTagIds={editForm.tagIds}
                              onChange={(tagIds) =>
                                setEditForm((f) => ({ ...f, tagIds }))
                              }
                              onCreateTag={async (name, color) => {
                                try {
                                  const res = await fetch("/api/customer/tags", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ name, color }),
                                  });
                                  const json = await res.json().catch(() => null);
                                  if (!res.ok) {
                                    showToast({ type: "error", title: json?.error || "Failed to create tag" });
                                    return null;
                                  }
                                  const created = json.tag as TagOption;
                                  // Add to local metadata cache
                                  setNewTicketMeta((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          tags: [...(prev.tags ?? []), created].sort(
                                            (a, b) => a.name.localeCompare(b.name),
                                          ),
                                        }
                                      : prev,
                                  );
                                  return created;
                                } catch {
                                  showToast({ type: "error", title: "Failed to create tag" });
                                  return null;
                                }
                              }}
                              canCreate={canManageTags(companyRole)}
                              disabled={editSaving}
                            />
                          </div>
                        ) : (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {detailTicket.tags && detailTicket.tags.length > 0 ? (
                              detailTicket.tags.map((tag) => (
                                <TagBadge
                                  key={tag.id}
                                  name={tag.name}
                                  color={tag.color as TagColorKey}
                                />
                              ))
                            ) : (
                              <p className="text-[11px] text-[var(--bb-text-tertiary)]">—</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="mb-5 border-t border-[var(--bb-border-subtle)]" />

                  {/* People */}
                  <div className="mb-5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bb-text-muted)]">
                      People
                    </p>
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                          detailTicket.isAssigned ? "bg-[#22C55E]" : "bg-[#9CA3AF]"
                        }`}
                      >
                        {detailTicket.isAssigned ? "\u2713" : "\u2014"}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--bb-secondary)]">
                          {detailTicket.isAssigned ? "Assigned" : "Unassigned"}
                        </p>
                        <p className="text-[10px] text-[var(--bb-text-tertiary)]">Creative team</p>
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
                          {formatBoardDate(detailTicket.updatedAt ?? null)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--bb-text-tertiary)]">Due date</p>
                        {isEditingDetail ? (
                          <FormInput
                            type="date"
                            size="sm"
                            value={editForm.dueDate}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setEditForm((f) => ({ ...f, dueDate: e.target.value }))
                            }
                            disabled={editSaving}
                          />
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </aside>
              </div>

              {/* Quick actions footer */}
              {(() => {
                // Get latest revision assets for download
                const latestRevAssets = (() => {
                  if (!detailRevisions || detailRevisions.length === 0) return [];
                  const reversed = [...detailRevisions].reverse();
                  return reversed[0]?.assets ?? [];
                })();

                const handleFooterDownload = async () => {
                  if (latestRevAssets.length === 0) return;
                  setDetailFooterDownloading(true);
                  try {
                    if (latestRevAssets.length === 1) {
                      await downloadSingleAsset(
                        latestRevAssets[0].id,
                        latestRevAssets[0].originalName || "final-work",
                      );
                    } else {
                      await downloadAssetsAsZip(
                        latestRevAssets.map((a) => ({ id: a.id, originalName: a.originalName })),
                        `${detailTicket.title?.replace(/[^a-zA-Z0-9]/g, "-") || "final-work"}.zip`,
                      );
                    }
                  } catch (err) {
                    console.error("[DetailFooter] download error:", err);
                  } finally {
                    setDetailFooterDownloading(false);
                  }
                };

                if (detailTicket.status === "DONE") {
                  return latestRevAssets.length > 0 ? (
                    <ModalFooter className="shrink-0 border-t border-[var(--bb-border-subtle)] pt-3">
                      <button
                        type="button"
                        disabled={detailFooterDownloading}
                        onClick={handleFooterDownload}
                        className="ml-auto flex items-center gap-1.5 rounded-lg bg-[var(--bb-primary)] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--bb-primary-hover)] disabled:opacity-60"
                      >
                        {detailFooterDownloading ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white border-t-transparent" />
                            Downloading…
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                              <path d="M10 3a.75.75 0 0 1 .75.75v7.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V3.75A.75.75 0 0 1 10 3Z" />
                              <path d="M3 15.75a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" />
                            </svg>
                            Download final work{latestRevAssets.length > 1 ? ` (${latestRevAssets.length} files)` : ""}
                          </>
                        )}
                      </button>
                    </ModalFooter>
                  ) : null;
                }

                if (detailTicket.status === "IN_REVIEW") {
                  return (
                    <ModalFooter className="shrink-0 border-t border-[var(--bb-border-subtle)] pt-3">
                      {latestRevAssets.length > 0 && (
                        <button
                          type="button"
                          disabled={detailFooterDownloading}
                          onClick={handleFooterDownload}
                          className="mr-auto flex items-center gap-1.5 rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-1.5 text-[11px] font-medium text-[var(--bb-text-secondary)] transition-colors hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)] disabled:opacity-60"
                        >
                          {detailFooterDownloading ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
                              Downloading…
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                <path d="M10 3a.75.75 0 0 1 .75.75v7.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V3.75A.75.75 0 0 1 10 3Z" />
                                <path d="M3 15.75a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" />
                              </svg>
                              Download{latestRevAssets.length > 1 ? ` (${latestRevAssets.length})` : ""}
                            </>
                          )}
                        </button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          closeTicketDetails();
                          setPendingRevisionTicketId(detailTicket.id);
                        }}
                      >
                        Request revision
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#32b37b] hover:bg-[#2ba06a]"
                        onClick={() => {
                          closeTicketDetails();
                          setPendingDoneTicketId(detailTicket.id);
                        }}
                      >
                        Mark as done
                      </Button>
                    </ModalFooter>
                  );
                }

                return null;
              })()}
              </>
              )}
        </Modal>

        {/* Revision modal */}
        <Modal open={!!pendingRevisionTicket} onClose={handleCancelRevision} size="md">
          <ModalHeader
            title="Send this request back to your creative?"
            subtitle="Your creative will see your message and continue working on this request. The status will move back to In progress."
          />

              <div>
                <label className="block text-xs font-medium text-[var(--bb-secondary)]">
                  Message for your creative
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
                  className="mt-1.5 h-28 w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-2.5 text-xs text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
                />
                {revisionMessageError && (
                  <p className="mt-1 text-[11px] text-[var(--bb-danger-text)]">
                    {revisionMessageError}
                  </p>
                )}
              </div>

          <ModalFooter>
            <Button variant="secondary" size="sm" onClick={handleCancelRevision}>Cancel</Button>
            <Button size="sm" onClick={handleConfirmRevision}>Send back to creative</Button>
          </ModalFooter>
        </Modal>

        {/* Done confirmation modal — with final work preview + download */}
        <Modal open={!!pendingDoneTicket} onClose={() => setPendingDoneTicketId(null)} size="lg">
          <ModalHeader
            title="Mark this request as done?"
            subtitle="Once you mark this request as done, your creative will get paid for this job, and the ticket will move to Done."
          />

              <div className="rounded-xl bg-[var(--bb-bg-warm)] px-3 py-3 text-xs text-[var(--bb-secondary)]">
                <p className="font-semibold">{pendingDoneTicket?.title}</p>
                {pendingDoneTicket?.projectName && (
                  <p className="mt-1 text-[var(--bb-text-secondary)]">
                    Project: {pendingDoneTicket.projectName}
                  </p>
                )}
              </div>

              {/* Final work preview */}
              {pendingDoneRevisionsLoading && (
                <div className="mt-3 flex items-center justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--bb-border)] border-t-[var(--bb-primary)]" />
                </div>
              )}

              {(() => {
                if (pendingDoneRevisionsLoading || !pendingDoneRevisions || pendingDoneRevisions.length === 0) return null;
                const latestRev = [...pendingDoneRevisions].reverse()[0];
                const finalAssets = latestRev?.assets ?? [];
                if (finalAssets.length === 0) return null;

                return (
                  <div className="mt-3">
                    <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bb-text-muted)]">
                      <span>Final work</span>
                      <span className="font-normal normal-case tracking-normal text-[var(--bb-text-tertiary)]">
                        — Version {latestRev.version} • {finalAssets.length} file{finalAssets.length !== 1 ? "s" : ""}
                      </span>
                    </p>

                    {/* Thumbnail grid */}
                    <div className={`grid gap-1.5 rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-2 ${
                      finalAssets.length === 1 ? "grid-cols-1" : "grid-cols-3"
                    }`}>
                      {finalAssets.slice(0, 6).map((asset) => (
                        <div
                          key={asset.id}
                          className="relative overflow-hidden rounded-lg bg-[var(--bb-bg-card)]"
                          style={{ height: finalAssets.length === 1 ? "160px" : "80px" }}
                        >
                          <RevisionImage
                            assetId={asset.id}
                            url={asset.url}
                            alt={asset.originalName || "Final work"}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                      {finalAssets.length > 6 && (
                        <div className="flex items-center justify-center rounded-lg bg-[var(--bb-border-subtle)] text-[11px] font-medium text-[var(--bb-text-secondary)]" style={{ height: "80px" }}>
                          +{finalAssets.length - 6} more
                        </div>
                      )}
                    </div>

                    {/* Prominent download button */}
                    <button
                      type="button"
                      disabled={doneModalDownloading}
                      onClick={async () => {
                        setDoneModalDownloading(true);
                        try {
                          if (finalAssets.length === 1) {
                            await downloadSingleAsset(
                              finalAssets[0].id,
                              finalAssets[0].originalName || "final-work",
                            );
                          } else {
                            await downloadAssetsAsZip(
                              finalAssets.map((a) => ({ id: a.id, originalName: a.originalName })),
                              `${pendingDoneTicket?.title?.replace(/[^a-zA-Z0-9]/g, "-") || "final-work"}.zip`,
                            );
                          }
                        } catch (err) {
                          console.error("[DoneModal] download error:", err);
                        } finally {
                          setDoneModalDownloading(false);
                        }
                      }}
                      className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--bb-primary)] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--bb-primary-hover)] disabled:opacity-60"
                    >
                      {doneModalDownloading ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white border-t-transparent" />
                          Preparing download…
                        </>
                      ) : finalAssets.length === 1 ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M10 3a.75.75 0 0 1 .75.75v7.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V3.75A.75.75 0 0 1 10 3Z" />
                            <path d="M3 15.75a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" />
                          </svg>
                          Download final file
                          {finalAssets[0].originalName && (
                            <span className="font-normal opacity-70">({finalAssets[0].originalName})</span>
                          )}
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M10 3a.75.75 0 0 1 .75.75v7.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V3.75A.75.75 0 0 1 10 3Z" />
                            <path d="M3 15.75a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" />
                          </svg>
                          Download all ({finalAssets.length} files)
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}

          <ModalFooter>
            <Button variant="secondary" size="sm" onClick={() => setPendingDoneTicketId(null)}>Cancel</Button>
            <Button size="sm" onClick={handleConfirmDone} className="bg-[#32b37b] hover:bg-[#2ba06a]">Yes, mark as done</Button>
          </ModalFooter>
        </Modal>
    </>
  );
}
