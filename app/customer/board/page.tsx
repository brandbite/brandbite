// -----------------------------------------------------------------------------
// @file: app/customer/board/page.tsx
// @purpose: Customer board: four status columns with drag and drop from In review,
//           top filters, a review prompt, the card detail dialog and the new-request
//           and project dialogs.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CompanyRole,
  normalizeCompanyRole,
  canCreateTickets,
  canMarkTicketsDoneForCompany,
  canMoveTicketsOnBoard,
  canEditTickets,
  canManageTags,
  canManageProjects,
  isCompanyAdminRole,
} from "@/lib/permissions/companyRoles";
import type { TicketStatus, TicketPriority } from "@prisma/client";
import { useToast } from "@/components/ui/toast-provider";
import { fetchAllTickets } from "@/lib/fetch-all-tickets";
import { STATUS_ORDER, PRIORITY_ORDER } from "@/lib/board";
import { isBriefMimeAllowed } from "@/lib/upload-helpers";
import type { TagOption } from "@/components/ui/tag-multi-select";
import { RevisionImage } from "@/components/ui/revision-image";
import { downloadSingleAsset, downloadAssetsAsZip } from "@/lib/download-helpers";
import { IconArrowUpRight, IconClock, IconDocument } from "@/components/admin/v2/icons";
import {
  Button,
  ButtonLink,
  Callout,
  Card,
  EmptyState,
  Field,
  IconTile,
  PageHeader,
  plural,
  PRIORITY,
  SearchInput,
  Select,
  Skeleton,
  TextArea,
  TextInput,
  TICKET_STATUS,
} from "@/components/admin/v2/ui";
import { BoardDialog } from "@/components/dashboard/customer-board/board-dialog";
import {
  IconDownload,
  IconExternal,
  IconFilter,
  IconKanban,
  IconList,
  IconPlus,
  IconShare,
} from "@/components/dashboard/customer-board/board-icons";
import type {
  BoardProject,
  BriefAsset,
  CustomerBoardTicket,
  NewTicketMetadata,
  TicketEditForm,
  TicketRevisionEntry,
} from "@/components/dashboard/customer-board/board-types";
import { ProjectMenu } from "@/components/dashboard/customer-board/project-menu";
import { TicketCard } from "@/components/dashboard/customer-board/ticket-card";
import { TicketDetailDialog } from "@/components/dashboard/customer-board/ticket-detail-dialog";

import NewTicketForm from "@/app/customer/tickets/new/NewTicketForm";
import { RateCreativeModal } from "@/components/ratings/rate-creative-modal";

type BoardStats = {
  total: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
};

type CustomerBoardResponse = {
  company?: { id: string; name: string; slug: string };
  stats: BoardStats;
  tickets: CustomerBoardTicket[];
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

type AssignmentFilter = "ALL" | "ASSIGNED" | "UNASSIGNED";

const STATUS_FILL: Partial<Record<TicketStatus, string>> = {
  TODO: "var(--av2-fill-neutral)",
  IN_PROGRESS: "var(--av2-fill-lavender)",
  IN_REVIEW: "var(--av2-fill-orange)",
  DONE: "var(--av2-fill-green)",
};

const ROLE_LABEL: Record<CompanyRole, string> = {
  OWNER: "Owner",
  PM: "Project manager",
  BILLING: "Billing manager",
  MEMBER: "Member",
};

const computeStats = (tickets: CustomerBoardTicket[]): BoardStats => {
  const byStatus: Record<TicketStatus, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
    // Cancelled tickets are filtered out at the API; this key is only
    // here to satisfy Record<TicketStatus, …>.
    CANCELED: 0,
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

const sortTicketsForColumn = (tickets: CustomerBoardTicket[]): CustomerBoardTicket[] => {
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
        "New requests in Backlog can only be picked up by your creative. You can approve or request changes once the ticket is In review.",
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
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [tagFilter, setTagFilter] = useState<string>("ALL");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("ALL");
  const [filterOpen, setFilterOpen] = useState<boolean>(false);

  // Thumbnail presigned URL cache: assetId → downloadUrl
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const thumbnailFetchingRef = useRef<Set<string>>(new Set());
  const searchRef = useRef<HTMLDivElement>(null);

  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TicketStatus | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  const [detailTicketId, setDetailTicketId] = useState<string | null>(null);

  const [detailRevisions, setDetailRevisions] = useState<TicketRevisionEntry[] | null>(null);
  const [detailRevisionsLoading, setDetailRevisionsLoading] = useState<boolean>(false);
  const [detailRevisionsError, setDetailRevisionsError] = useState<string | null>(null);

  // Brief attachments state
  const [detailBriefAssets, setDetailBriefAssets] = useState<BriefAsset[]>([]);
  const [detailBriefAssetsLoading, setDetailBriefAssetsLoading] = useState(false);
  const [uploadingBriefs, setUploadingBriefs] = useState(false);
  const [uploadBriefsProgress, setUploadBriefsProgress] = useState<string | null>(null);

  const [pendingDoneTicketId, setPendingDoneTicketId] = useState<string | null>(null);
  // Rating modal after drag-to-DONE (skippable; opens only when the ticket
  // had a creative assigned — no point rating no-one).
  const [ratingForTicket, setRatingForTicket] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [pendingDoneRevisions, setPendingDoneRevisions] = useState<TicketRevisionEntry[] | null>(
    null,
  );
  const [pendingDoneRevisionsLoading, setPendingDoneRevisionsLoading] = useState(false);
  const [doneModalDownloading, setDoneModalDownloading] = useState(false);

  const [pendingRevisionTicketId, setPendingRevisionTicketId] = useState<string | null>(null);
  const [revisionMessage, setRevisionMessage] = useState<string>("");
  const [revisionMessageError, setRevisionMessageError] = useState<string | null>(null);

  const [mouseDownInfo, setMouseDownInfo] = useState<{
    ticketId: string;
    x: number;
    y: number;
    time: number;
  } | null>(null);

  const [newTicketModalOpen, setNewTicketModalOpen] = useState<boolean>(false);
  const [newTicketMeta, setNewTicketMeta] = useState<NewTicketMetadata | null>(null);
  const [newTicketMetaLoading, setNewTicketMetaLoading] = useState<boolean>(false);
  const [newTicketMetaError, setNewTicketMetaError] = useState<string | null>(null);

  // New project modal
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSaving, setNewProjectSaving] = useState(false);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);

  // All company projects (fetched from API — includes empty projects)
  const [boardProjects, setBoardProjects] = useState<BoardProject[]>([]);

  // Rename project modal
  const [renameProject, setRenameProject] = useState<BoardProject | null>(null);
  const [renameProjectName, setRenameProjectName] = useState("");
  const [renameProjectSaving, setRenameProjectSaving] = useState(false);
  const [renameProjectError, setRenameProjectError] = useState<string | null>(null);

  // Brand-guide modal (D19) — keyed off the project being edited.
  const [brandGuideProject, setBrandGuideProject] = useState<BoardProject | null>(null);
  const [brandGuideDraft, setBrandGuideDraft] = useState({
    brandLogoUrl: "",
    brandColors: "",
    brandFonts: "",
    brandVoice: "",
  });
  const [brandGuideLoading, setBrandGuideLoading] = useState(false);
  const [brandGuideSaving, setBrandGuideSaving] = useState(false);
  const [brandGuideError, setBrandGuideError] = useState<string | null>(null);

  // Delete project confirmation
  const [deleteProject, setDeleteProject] = useState<BoardProject | null>(null);
  const [deleteProjectSaving, setDeleteProjectSaving] = useState(false);
  const [deleteProjectError, setDeleteProjectError] = useState<string | null>(null);

  // Cancel-ticket confirmation. Holds the ticket id while the modal is
  // open + a saving flag so we can disable the confirm button while the
  // POST is in flight. Distinct from `deleteProject` etc. so we don't
  // accidentally cross-wire dialogs.
  const [cancelTicketId, setCancelTicketId] = useState<string | null>(null);
  const [cancellingTicket, setCancellingTicket] = useState(false);

  // Inline edit state for detail modal
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editForm, setEditForm] = useState<TicketEditForm>({
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
      // All pages — the API returns the 50 newest by default, which used to
      // hide older open requests from the board.
      const json = await fetchAllTickets<CustomerBoardResponse>("/api/customer/tickets");
      setData({
        ...json,
        stats: computeStats(json.tickets),
      });
    } catch (err: unknown) {
      console.error("Load customer board data error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to load your tickets. Please try again.";

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
        throw new Error(text || `Failed to load company permissions (status ${res.status}).`);
      }

      const json = (await res.json()) as CompanyRoleResponse;
      setCompanyRole(json.role ? normalizeCompanyRole(json.role) : null);
    } catch (err: unknown) {
      console.error("Load company role error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to load your permissions. Please try again.";

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
          typeof message === "string" ? message : "Failed to load data for new request.",
        );
      }

      setNewTicketMeta(json as NewTicketMetadata);
    } catch (err: unknown) {
      console.error("[CustomerBoardPage] Failed to load new ticket metadata", err);
      const message = err instanceof Error ? err.message : "Failed to load data for new request.";

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
      // Refresh board + projects + new-ticket metadata
      void load();
      void loadBoardProjects();
      setNewTicketMeta(null);
    } catch {
      setNewProjectError("Unexpected error creating project.");
    } finally {
      setNewProjectSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Projects: fetch, rename, delete
  // ---------------------------------------------------------------------------

  const loadBoardProjects = async () => {
    try {
      const res = await fetch("/api/customer/projects", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.projects) {
        setBoardProjects(json.projects);
      }
    } catch {
      // Silently fail — the filter falls back to projects seen on tickets
    }
  };

  const openRenameProject = (proj: BoardProject) => {
    setRenameProject(proj);
    setRenameProjectName(proj.name);
    setRenameProjectError(null);
  };

  const closeRenameProject = () => {
    setRenameProject(null);
    setRenameProjectError(null);
  };

  // ---- Brand guide modal -----------------------------------------------
  const openBrandGuide = async (proj: BoardProject) => {
    setBrandGuideProject(proj);
    setBrandGuideError(null);
    setBrandGuideDraft({ brandLogoUrl: "", brandColors: "", brandFonts: "", brandVoice: "" });
    setBrandGuideLoading(true);
    try {
      const res = await fetch(`/api/customer/projects/${proj.id}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.project) {
        setBrandGuideDraft({
          brandLogoUrl: json.project.brandLogoUrl ?? "",
          brandColors: json.project.brandColors ?? "",
          brandFonts: json.project.brandFonts ?? "",
          brandVoice: json.project.brandVoice ?? "",
        });
      }
    } catch {
      // Leave draft empty — user can fill and save.
    } finally {
      setBrandGuideLoading(false);
    }
  };

  const closeBrandGuide = () => {
    setBrandGuideProject(null);
    setBrandGuideError(null);
  };

  const handleSaveBrandGuide = async () => {
    if (!brandGuideProject) return;
    setBrandGuideSaving(true);
    setBrandGuideError(null);
    try {
      const res = await fetch(`/api/customer/projects/${brandGuideProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brandGuideDraft),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setBrandGuideError(json?.error || "Failed to save brand guide.");
        return;
      }
      closeBrandGuide();
      showToast({ type: "success", title: "Brand guide saved" });
    } catch {
      setBrandGuideError("Unexpected error saving brand guide.");
    } finally {
      setBrandGuideSaving(false);
    }
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
      // Keep the filter on the project that was just renamed.
      if (projectFilter === renameProject.name) setProjectFilter(trimmed);
      closeRenameProject();
      showToast({ type: "success", title: "Project renamed" });
      void load();
      void loadBoardProjects();
      setNewTicketMeta(null);
    } catch {
      setRenameProjectError("Unexpected error renaming project.");
    } finally {
      setRenameProjectSaving(false);
    }
  };

  const openDeleteProject = (proj: BoardProject) => {
    setDeleteProject(proj);
    setDeleteProjectError(null);
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
      void loadBoardProjects();
      setNewTicketMeta(null);
    } catch {
      setDeleteProjectError("Unexpected error deleting project.");
    } finally {
      setDeleteProjectSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const initialLoad = async () => {
      if (cancelled) return;
      await load();
      await loadBoardProjects();
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
        const res = await fetch(`/api/customer/tickets/${detailTicketId}/revisions`, {
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const message =
            (json && typeof json === "object" && "error" in json && (json as any).error) ||
            `Failed to load revision history (status ${res.status}).`;
          if (!cancelled) {
            setDetailRevisionsError(
              typeof message === "string" ? message : "Failed to load revision history.",
            );
          }
          return;
        }

        const entries = ((json as any)?.revisions ?? []) as TicketRevisionEntry[];

        if (!cancelled) {
          setDetailRevisions(entries);
        }
      } catch (err) {
        console.error("[CustomerBoardPage] Failed to load ticket revision history", err);
        if (!cancelled) {
          setDetailRevisionsError("Failed to load revision history. Please try again later.");
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
        const res = await fetch(`/api/customer/tickets/${pendingDoneTicketId}/revisions`, {
          cache: "no-store",
        });
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
    return () => {
      cancelled = true;
    };
  }, [pendingDoneTicketId]);

  // ---------------------------------------------------------------------------
  // Detail ticket brief attachments — load + upload
  // ---------------------------------------------------------------------------

  const loadDetailBriefAssets = useCallback(async (ticketId: string) => {
    setDetailBriefAssetsLoading(true);
    try {
      const res = await fetch(`/api/customer/tickets/${ticketId}/assets?kind=BRIEF_INPUT`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray((json as any)?.assets)) {
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
      setDetailBriefAssetsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!detailTicketId) {
      setDetailBriefAssets([]);
      setDetailBriefAssetsLoading(false);
      return;
    }

    loadDetailBriefAssets(detailTicketId);
  }, [detailTicketId, loadDetailBriefAssets]);

  // Helper — read image dimensions from a File
  async function getImageDimensionsForBoard(
    file: File,
  ): Promise<{ width: number; height: number } | null> {
    if (!file.type.startsWith("image/")) return null;
    return await new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const w = Number(img.naturalWidth) || 0;
        const h = Number(img.naturalHeight) || 0;
        URL.revokeObjectURL(url);
        if (w > 0 && h > 0) resolve({ width: w, height: h });
        else resolve(null);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  const handleUploadBriefFromBoard = useCallback(
    async (files: FileList | null) => {
      if (!detailTicketId) return;
      if (!files || files.length === 0) return;
      const accepted = Array.from(files).filter((f) => isBriefMimeAllowed(f.type));
      if (accepted.length === 0) return;

      setUploadingBriefs(true);
      setUploadBriefsProgress("Preparing uploads...");

      let failed = 0;
      for (let i = 0; i < accepted.length; i += 1) {
        const file = accepted[i];
        try {
          setUploadBriefsProgress(`Uploading ${i + 1} of ${accepted.length}...`);
          const dims = await getImageDimensionsForBoard(file);

          const body = new FormData();
          body.append("file", file);
          body.append("ticketId", detailTicketId);
          body.append("kind", "BRIEF_INPUT");
          if (dims?.width) body.append("width", String(dims.width));
          if (dims?.height) body.append("height", String(dims.height));

          const res = await fetch("/api/uploads/r2/upload", {
            method: "POST",
            body,
          });
          if (!res.ok) failed += 1;
        } catch {
          failed += 1;
        }
      }

      setUploadBriefsProgress(null);
      setUploadingBriefs(false);
      await loadDetailBriefAssets(detailTicketId);
      // Also refresh the board so the card thumbnail reflects the newly added
      // attachment immediately instead of only after a manual page refresh.
      await load();
    },
    [detailTicketId, loadDetailBriefAssets],
  );

  const handleDeleteBriefAsset = useCallback(
    async (asset: { id: string }) => {
      if (!detailTicketId) return;
      try {
        const res = await fetch(`/api/customer/tickets/${detailTicketId}/assets/${asset.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          showToast({
            type: "error",
            title: "Couldn't remove attachment",
            description:
              json?.error === "TICKET_NOT_EDITABLE"
                ? "Attachments can only be removed while the request is in Backlog."
                : undefined,
          });
          return;
        }
        showToast({ type: "success", title: "Attachment removed" });
        await loadDetailBriefAssets(detailTicketId);
      } catch {
        showToast({ type: "error", title: "Couldn't remove attachment" });
      }
    },
    [detailTicketId, loadDetailBriefAssets, showToast],
  );

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const tickets = data?.tickets ?? [];

  // Every company project (including empty ones), plus any seen only on tickets
  // in case the project list failed to load.
  const projectOptions = useMemo(() => {
    const options = new Map<string, { name: string; count: number | null }>();
    for (const project of boardProjects) {
      options.set(project.name, { name: project.name, count: project.ticketCount });
    }
    for (const ticket of tickets) {
      if (ticket.projectName && !options.has(ticket.projectName)) {
        options.set(ticket.projectName, { name: ticket.projectName, count: null });
      }
    }
    return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [boardProjects, tickets]);

  const selectedProject = boardProjects.find((project) => project.name === projectFilter) ?? null;

  const tagOptions = useMemo(() => {
    const options = new Map<string, { id: string; name: string }>();
    for (const ticket of tickets) {
      for (const tag of ticket.tags ?? []) options.set(tag.id, tag);
    }
    return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tickets]);

  const toReview = useMemo(() => tickets.filter((t) => t.status === "IN_REVIEW"), [tickets]);

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
      const el = e.target as HTMLElement;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (el.isContentEditable || el.closest?.('[contenteditable="true"]')) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const assignedCount = useMemo(() => tickets.filter((t) => t.isAssigned).length, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (projectFilter !== "ALL" && t.projectName !== projectFilter) {
        return false;
      }

      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) {
        return false;
      }

      if (tagFilter !== "ALL" && !(t.tags ?? []).some((tag) => tag.id === tagFilter)) {
        return false;
      }

      if (assignmentFilter === "ASSIGNED" && !t.isAssigned) {
        return false;
      }

      if (assignmentFilter === "UNASSIGNED" && t.isAssigned) {
        return false;
      }

      const q = search.trim().toLowerCase();
      if (q) {
        const code = (t.code ?? "").toLowerCase();
        const title = t.title.toLowerCase();
        const description = (t.description ?? "").toLowerCase();

        if (!code.includes(q) && !title.includes(q) && !description.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, projectFilter, priorityFilter, tagFilter, assignmentFilter, search]);

  const panelFilterCount = (tagFilter !== "ALL" ? 1 : 0) + (assignmentFilter !== "ALL" ? 1 : 0);
  const hasActiveFilters =
    projectFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    panelFilterCount > 0 ||
    search.trim().length > 0;

  const clearFilters = () => {
    setProjectFilter("ALL");
    setPriorityFilter("ALL");
    setTagFilter("ALL");
    setAssignmentFilter("ALL");
    setSearch("");
  };

  const ticketsByStatus = useMemo(() => {
    const map: Record<TicketStatus, CustomerBoardTicket[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
      // Cancelled rows are filtered out at the API; bucket exists only
      // to satisfy Record<TicketStatus, …>.
      CANCELED: [],
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
  const companyName = data?.company?.name ?? null;

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
        description: "Your creative will be paid for this job and the ticket has moved to Done.",
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
      const hasRevisionMessage = !!revisionMessage && revisionMessage.trim().length > 0;

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
        // The response may not return JSON — that's fine
      }

      const hasExplicitSuccessFlag = json && typeof json.success === "boolean";

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

      // If the response includes ticket + stats, update local state quickly
      if (json && json.ticket && json.stats) {
        setData((prev) => {
          if (!prev) {
            return {
              tickets: [json.ticket],
              stats: json.stats,
            } as CustomerBoardResponse;
          }

          const nextTickets = prev.tickets.map((t) => (t.id === json.ticket.id ? json.ticket : t));

          return {
            ...prev,
            tickets: nextTickets,
            stats: json.stats,
          };
        });
      } else {
        // If we can't trust the response shape, reload the whole board
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
        err instanceof Error ? err.message : "Failed to update ticket status. Please try again.";

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

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>, ticketId: string) => {
    setMouseDownInfo({
      ticketId,
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
    });
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>, ticketId: string) => {
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

    // Customers can only drag IN_REVIEW cards
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
        // some browsers impose arbitrary limits — not important
      }
    }
  };

  const handleDragEnd = () => {
    setDraggingTicketId(null);
    setDragOverStatus(null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>, status: TicketStatus) => {
    if (!draggingTicketId || !canDragTicket) return;

    const ticket = tickets.find((t) => t.id === draggingTicketId);
    if (!ticket) return;

    // preventDefault in all cases so the drop is accepted
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

  const handleDrop = async (event: React.DragEvent<HTMLElement>, targetStatus: TicketStatus) => {
    event.preventDefault();
    setDragOverStatus(null);

    if (!canDragTicket) {
      showToast({
        type: "warning",
        title: "You can't move requests",
        description: "Your current role does not allow changing ticket status on this board.",
      });
      return;
    }

    const ticketId = event.dataTransfer.getData("text/plain") || draggingTicketId || "";
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
    setDetailBriefAssets([]);
    setDetailBriefAssetsLoading(false);
    setUploadingBriefs(false);
    setUploadBriefsProgress(null);
    setIsEditingDetail(false);
    setEditError(null);
  };

  // ---------------------------------------------------------------------------
  // Inline edit — permission + handlers
  // ---------------------------------------------------------------------------

  const canEditDetail = detailTicket?.status === "TODO" && canEditTickets(companyRole);

  // Cancel-with-refund visibility. OWNER + PM only (matches the
  // server-side gate), and only while the ticket is still TODO and
  // un-assigned. Auto-assign moves a ticket out of TODO the moment a
  // creative picks it up, so this guard plus the API's status check
  // together mean we never refund a started job.
  const canCancelDetail =
    detailTicket?.status === "TODO" && !detailTicket?.isAssigned && isCompanyAdminRole(companyRole);

  const handleCancelTicket = useCallback(
    async (ticketId: string) => {
      setCancellingTicket(true);
      try {
        const res = await fetch(`/api/customer/tickets/${ticketId}/cancel`, {
          method: "POST",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          showToast({
            type: "error",
            title: json?.error || "Failed to cancel ticket",
          });
          return;
        }
        const refunded = (json?.refundedTokens as number | undefined) ?? 0;
        showToast({
          type: "success",
          title:
            refunded > 0
              ? `Ticket cancelled — ${refunded.toLocaleString()} tokens refunded`
              : "Ticket cancelled",
        });
        // Optimistically drop the row from local state + close the
        // detail panel. We then call load() to refresh stats + token
        // balance (the refund just landed) so the sidebar number
        // updates without a hard reload.
        setData((prev) =>
          prev ? { ...prev, tickets: prev.tickets.filter((t) => t.id !== ticketId) } : prev,
        );
        closeTicketDetails();
        void load();
      } catch {
        showToast({ type: "error", title: "Failed to cancel ticket" });
      } finally {
        setCancellingTicket(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showToast],
  );

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
          // Job type can't be cleared (model 2). Omit when empty so an edit to
          // other fields leaves the existing job type unchanged rather than
          // sending null, which the API now rejects.
          jobTypeId: editForm.jobTypeId || undefined,
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

  const handleCreateTag = async (name: string, color: string): Promise<TagOption | null> => {
    try {
      const res = await fetch("/api/customer/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showToast({
          type: "error",
          title: json?.error || "Failed to create tag",
        });
        return null;
      }
      const created = json.tag as TagOption;
      // Add to local metadata cache
      setNewTicketMeta((prev) =>
        prev
          ? {
              ...prev,
              tags: [...(prev.tags ?? []), created].sort((a, b) => a.name.localeCompare(b.name)),
            }
          : prev,
      );
      return created;
    } catch {
      showToast({ type: "error", title: "Failed to create tag" });
      return null;
    }
  };

  const handleConfirmDone = async () => {
    if (!pendingDoneTicketId) return;
    const ticket = tickets.find((t) => t.id === pendingDoneTicketId);
    if (!ticket) return;

    await persistTicketStatus(ticket.id, "DONE");
    setPendingDoneTicketId(null);

    // After successful DONE transition, open the skippable rating modal if
    // a creative was actually assigned. Mirrors the same flow already used
    // on the customer ticket detail page.
    if (ticket.isAssigned) {
      setRatingForTicket({ id: ticket.id, title: ticket.title });
    }
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

    await persistTicketStatus(ticket.id, "IN_PROGRESS", revisionMessage.trim());
    setPendingRevisionTicketId(null);
    setRevisionMessage("");
    setRevisionMessageError(null);
  };

  const handleCancelRevision = () => {
    setPendingRevisionTicketId(null);
    setRevisionMessage("");
    setRevisionMessageError(null);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <PageHeader
        title="Creative requests board"
        description={
          <>
            {companyName ? (
              <>
                Company <span className="font-medium text-[var(--av2-text)]">{companyName}</span>
              </>
            ) : null}
            {companyName && companyRole ? " · " : null}
            {companyRole ? (
              <>
                You are browsing as{" "}
                <span className="font-medium text-[var(--av2-text)]">
                  {ROLE_LABEL[companyRole]}
                </span>
              </>
            ) : null}
            {data && (companyName || companyRole) ? " · " : null}
            {data ? (
              <>
                {currentStats.total} {plural(currentStats.total, "request", "requests")}
                {assignedCount > 0 ? `, ${assignedCount} assigned` : ""}
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-6 space-y-3 empty:hidden">
        {loadError ? (
          <Callout tone="error" title="We couldn't load your board">
            {loadError}
          </Callout>
        ) : null}
        {companyRoleError ? (
          <Callout tone="error" title="We couldn't load your permissions">
            {companyRoleError}
          </Callout>
        ) : null}
        {mutationError ? (
          <Callout tone="warning" title="That didn't go through">
            {mutationError}
          </Callout>
        ) : null}
      </div>

      {/* Only people who can act on a review are asked for one. */}
      {toReview.length > 0 && canDragTicket ? (
        <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--av2-attention-border)] bg-gradient-to-r from-[var(--av2-attention-from)] to-[var(--av2-attention-to)] px-6 py-4">
          <IconTile tone="peach" round>
            <IconClock />
          </IconTile>
          <div className="min-w-[200px] flex-1">
            <h2 className="text-xl leading-7 font-semibold">
              {toReview.length === 1
                ? "Needs your review"
                : `${toReview.length} requests need your review`}
            </h2>
            <p className="mt-0.5 text-base break-words">
              {toReview[0].code ? (
                <span className="text-[var(--av2-text-2)]">{toReview[0].code} </span>
              ) : null}
              {toReview[0].title}
            </p>
          </div>
          <Button variant="primary" onClick={() => setDetailTicketId(toReview[0].id)}>
            Review request
            <IconArrowUpRight />
          </Button>
        </section>
      ) : null}

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-52 sm:flex-none">
            <Select
              aria-label="Filter by project"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="ALL">All projects</option>
              {projectOptions.map((project) => (
                <option key={project.name} value={project.name}>
                  {project.name}
                  {project.count != null ? ` (${project.count})` : ""}
                </option>
              ))}
            </Select>
          </div>
          {canManageProjects(companyRole) ? (
            <ProjectMenu
              project={selectedProject}
              onCreate={openNewProjectModal}
              onRename={openRenameProject}
              onBrandGuide={openBrandGuide}
              onDelete={openDeleteProject}
            />
          ) : null}
        </div>

        <div ref={searchRef} className="w-full sm:w-auto sm:min-w-[200px] sm:flex-1">
          <SearchInput
            label="Search requests"
            placeholder="Search requests"
            value={search}
            onChange={setSearch}
          />
        </div>

        <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
          <Select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="ALL">All priorities</option>
            {PRIORITY_ORDER.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY[priority]?.label ?? priority}
              </option>
            ))}
          </Select>
        </div>

        <Button aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}>
          <IconFilter />
          <span>Filter</span>
          {panelFilterCount > 0 ? ` (${panelFilterCount})` : ""}
        </Button>

        <Button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href).then(() => {
              showToast({ type: "success", title: "Link copied to clipboard" });
            });
          }}
        >
          <IconShare />
          Share
        </Button>

        <nav
          aria-label="Board view"
          className="flex h-10 items-center rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)]"
        >
          <span
            aria-current="page"
            className="flex h-full items-center gap-2 rounded-l-lg bg-[var(--av2-selected)] px-3 text-sm font-semibold text-[var(--av2-link)]"
          >
            <IconKanban />
            Kanban
          </span>
          <Link
            href="/customer/tickets"
            className="flex h-full items-center gap-2 rounded-r-lg px-3 text-sm font-medium hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
          >
            <IconList />
            List
          </Link>
        </nav>

        {canCreateTickets(companyRole) ? (
          <Button variant="primary" className="ml-auto max-sm:w-full" onClick={openNewTicketModal}>
            <IconPlus />
            <span>New request</span>
          </Button>
        ) : null}
      </div>

      {filterOpen ? (
        <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-4">
          {tagOptions.length > 0 ? (
            <div className="w-full sm:w-52">
              <Field label="Tag" htmlFor="customer-board-tag-filter">
                <Select
                  id="customer-board-tag-filter"
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value)}
                >
                  <option value="ALL">All tags</option>
                  {tagOptions.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}
          <div className="w-full sm:w-52">
            <Field label="Assignment" htmlFor="customer-board-assignment-filter">
              <Select
                id="customer-board-assignment-filter"
                value={assignmentFilter}
                onChange={(event) => setAssignmentFilter(event.target.value as AssignmentFilter)}
              >
                <option value="ALL">Any assignment</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="UNASSIGNED">Unassigned</option>
              </Select>
            </Field>
          </div>
        </div>
      ) : null}

      {hasActiveFilters ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-[var(--av2-text-2)]">
          <p role="status">
            Showing {filteredTickets.length} of {tickets.length}{" "}
            {plural(tickets.length, "request", "requests")}
          </p>
          <Button variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : null}

      <div className="mt-6">
        {/* Columns */}
        {loading ? (
          <div
            aria-busy="true"
            aria-label="Loading your board"
            className="grid auto-cols-[82%] grid-flow-col gap-3 overflow-hidden sm:auto-cols-[minmax(236px,1fr)]"
          >
            {STATUS_ORDER.map((status) => (
              <Skeleton key={status} className="h-96 !rounded-2xl" />
            ))}
          </div>
        ) : tickets.length === 0 && !loadError ? (
          <Card padding="none">
            <EmptyState
              icon={<IconKanban width={28} height={28} />}
              title="No requests yet"
              description="New requests start in Backlog and move across the board as your creative works on them."
              action={
                canCreateTickets(companyRole) ? (
                  <Button variant="primary" onClick={openNewTicketModal}>
                    <IconPlus />
                    New request
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="grid snap-x snap-mandatory auto-cols-[82%] grid-flow-col gap-3 sm:auto-cols-[minmax(236px,1fr)] md:snap-none">
              {STATUS_ORDER.map((status) => {
                const columnTickets = ticketsByStatus[status] ?? [];
                const isDropTargetActive = dragOverStatus === status;
                const label = TICKET_STATUS[status]?.label ?? status;

                return (
                  <section
                    key={status}
                    id={`customer-board-column-${status}`}
                    aria-label={label}
                    className={`flex min-h-[480px] snap-start flex-col rounded-2xl border p-3 transition-colors ${
                      isDropTargetActive
                        ? "border-[var(--av2-accent)] bg-[var(--av2-selected)]"
                        : "border-[var(--av2-border)] bg-[var(--av2-surface)]"
                    }`}
                    onDragOver={(event) => handleDragOver(event, status)}
                    onDrop={(event) => handleDrop(event, status)}
                  >
                    <div className="flex items-center gap-2 px-1 pt-1 pb-3">
                      <span
                        aria-hidden
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: STATUS_FILL[status] }}
                      />
                      <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{label}</h2>
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--av2-track)] px-2 text-xs font-medium tabular-nums">
                        {columnTickets.length}
                      </span>
                    </div>

                    <div className="flex-1 space-y-3">
                      {columnTickets.length === 0 && !isDropTargetActive ? (
                        <p className="px-1 py-6 text-center text-sm text-[var(--av2-text-2)]">
                          {hasActiveFilters
                            ? "No matching requests."
                            : status === "DONE"
                              ? "Completed requests will appear here."
                              : "No requests here yet."}
                        </p>
                      ) : (
                        columnTickets.map((ticket) => (
                          <TicketCard
                            key={ticket.id}
                            ticket={ticket}
                            thumbnailSrc={
                              ticket.thumbnailUrl ??
                              (ticket.thumbnailAssetId
                                ? thumbnailUrls[ticket.thumbnailAssetId]
                                : null) ??
                              null
                            }
                            draggable={canDragTicket && ticket.status === "IN_REVIEW"}
                            dragging={draggingTicketId === ticket.id}
                            updating={updatingTicketId === ticket.id}
                            onOpen={() => setDetailTicketId(ticket.id)}
                            onDragStart={(event) =>
                              handleDragStart(event, ticket.id, ticket.status)
                            }
                            onDragEnd={handleDragEnd}
                            onMouseDown={(event) => handleMouseDown(event, ticket.id)}
                            onMouseUp={(event) => handleMouseUp(event, ticket.id)}
                          />
                        ))
                      )}
                      {isDropTargetActive ? (
                        <div className="rounded-xl border-2 border-dashed border-[var(--av2-accent)]/50 px-3 py-4 text-center text-sm font-medium text-[var(--av2-link)]">
                          Drop here
                        </div>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* New ticket dialog. The form inside brings its own fields and actions. */}
      <BoardDialog
        open={newTicketModalOpen}
        onClose={closeNewTicketModal}
        width="lg"
        icon={
          <IconTile tone="peach" size={48}>
            <IconDocument />
          </IconTile>
        }
        title="Create a new creative request"
        subtitle="Added to Backlog when submitted."
        headerActions={
          <ButtonLink href="/customer/tickets/new" className="max-sm:!w-10 max-sm:!px-0">
            <IconExternal />
            <span className="max-sm:sr-only">Open full page</span>
          </ButtonLink>
        }
      >
        {newTicketMetaError ? (
          <div className="mb-3">
            <Callout tone="error" title="We couldn't open the form">
              {newTicketMetaError}
            </Callout>
          </div>
        ) : null}

        {newTicketMetaLoading || !newTicketMeta ? (
          newTicketMetaError ? null : (
            <div aria-busy="true" aria-label="Loading form" className="space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-40" />
              <Skeleton className="h-10" />
            </div>
          )
        ) : (
          <NewTicketForm
            companySlug={newTicketMeta.companySlug}
            projects={newTicketMeta.projects}
            jobTypes={newTicketMeta.jobTypes}
            tokenBalance={newTicketMeta.tokenBalance}
            tags={(newTicketMeta.tags ?? []) as TagOption[]}
            // Force-hide tag picker when the global flag is off — passing
            // `false` overrides the form's internal canManageTags fallback
            // (the form uses ?? on this prop). Treated as enabled when
            // undefined on the response (older deploys).
            canCreateTags={newTicketMeta.tagsEnabled === false ? false : canManageTags(companyRole)}
            onTagCreated={(tag) => {
              setNewTicketMeta((prev) =>
                prev
                  ? {
                      ...prev,
                      tags: [...(prev.tags ?? []), tag].sort((a, b) =>
                        a.name.localeCompare(b.name),
                      ),
                    }
                  : prev,
              );
            }}
            redirectTo="/customer/board"
            onCancel={closeNewTicketModal}
            onCreated={() => {
              closeNewTicketModal();
              showToast({
                type: "success",
                title: "New request created",
                description: "Your request was added to Backlog.",
              });
              void load();
            }}
          />
        )}
      </BoardDialog>

      {/* New project */}
      <BoardDialog
        open={newProjectModalOpen}
        onClose={closeNewProjectModal}
        eyebrow="New project"
        title="Create a project"
        subtitle="Group related creative requests under one project."
        footer={
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button onClick={closeNewProjectModal} disabled={newProjectSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateProject}
              disabled={newProjectSaving || newProjectName.trim().length < 2}
            >
              {newProjectSaving ? "Creating…" : "Create project"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {newProjectError ? <Callout tone="error" title={newProjectError} /> : null}
          <Field
            label="Project name"
            htmlFor="customer-board-new-project"
            hint="A short code will be generated automatically from the name."
          >
            <TextInput
              id="customer-board-new-project"
              type="text"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="e.g. Q1 Campaign, Website Redesign"
              disabled={newProjectSaving}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter" && !newProjectSaving) {
                  event.preventDefault();
                  handleCreateProject();
                }
              }}
            />
          </Field>
        </div>
      </BoardDialog>

      {/* Rename project */}
      <BoardDialog
        open={!!renameProject}
        onClose={closeRenameProject}
        eyebrow="Rename project"
        title={renameProject?.name ?? ""}
        subtitle="Change the display name of this project."
        footer={
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button onClick={closeRenameProject} disabled={renameProjectSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRenameProject}
              disabled={renameProjectSaving || renameProjectName.trim().length < 2}
            >
              {renameProjectSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {renameProjectError ? <Callout tone="error" title={renameProjectError} /> : null}
          <Field label="New name" htmlFor="customer-board-rename-project">
            <TextInput
              id="customer-board-rename-project"
              type="text"
              value={renameProjectName}
              onChange={(event) => setRenameProjectName(event.target.value)}
              placeholder="Project name"
              disabled={renameProjectSaving}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter" && !renameProjectSaving) {
                  event.preventDefault();
                  handleRenameProject();
                }
              }}
            />
          </Field>
        </div>
      </BoardDialog>

      {/* Project brand guide (D19) */}
      <BoardDialog
        open={!!brandGuideProject}
        onClose={closeBrandGuide}
        width="md"
        eyebrow="Brand guide"
        title={brandGuideProject?.name ?? ""}
        subtitle="Fill these once per project. They show up on every ticket for creatives and feed AI prompts automatically."
        footer={
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button onClick={closeBrandGuide} disabled={brandGuideSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveBrandGuide} disabled={brandGuideSaving}>
              {brandGuideSaving ? "Saving…" : "Save brand guide"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {brandGuideError ? <Callout tone="error" title={brandGuideError} /> : null}
          {brandGuideLoading ? (
            <p role="status" className="text-sm text-[var(--av2-text-2)]">
              Loading current values…
            </p>
          ) : null}
          <Field label="Logo URL" htmlFor="customer-board-brand-logo">
            <TextInput
              id="customer-board-brand-logo"
              type="url"
              value={brandGuideDraft.brandLogoUrl}
              onChange={(event) => {
                const brandLogoUrl = event.target.value;
                setBrandGuideDraft((prev) => ({ ...prev, brandLogoUrl }));
              }}
              placeholder="https://… (public image link)"
              disabled={brandGuideSaving}
            />
          </Field>
          <Field
            label="Brand colors"
            htmlFor="customer-board-brand-colors"
            hint="Comma-separated hex values."
          >
            <TextInput
              id="customer-board-brand-colors"
              type="text"
              value={brandGuideDraft.brandColors}
              onChange={(event) => {
                const brandColors = event.target.value;
                setBrandGuideDraft((prev) => ({ ...prev, brandColors }));
              }}
              placeholder="#ff6600, #1e293b, #ffffff"
              disabled={brandGuideSaving}
            />
          </Field>
          <Field label="Fonts" htmlFor="customer-board-brand-fonts">
            <TextInput
              id="customer-board-brand-fonts"
              type="text"
              value={brandGuideDraft.brandFonts}
              onChange={(event) => {
                const brandFonts = event.target.value;
                setBrandGuideDraft((prev) => ({ ...prev, brandFonts }));
              }}
              placeholder="Inter, Source Serif 4"
              disabled={brandGuideSaving}
            />
          </Field>
          <Field label="Voice / tone notes" htmlFor="customer-board-brand-voice">
            <TextArea
              id="customer-board-brand-voice"
              value={brandGuideDraft.brandVoice}
              onChange={(event) => {
                const brandVoice = event.target.value;
                setBrandGuideDraft((prev) => ({ ...prev, brandVoice }));
              }}
              placeholder="e.g. Warm, confident, lightly playful. We say ‘folks’ not ‘customers’. Avoid corporate jargon."
              rows={4}
              maxLength={2000}
              disabled={brandGuideSaving}
            />
          </Field>
        </div>
      </BoardDialog>

      {/* Cancel-ticket confirmation. OWNER/PM only — server enforces the same
          gate. Confirming POSTs to /cancel which flips status to CANCELED and
          writes a REFUND ledger entry atomically. Stacks on the detail dialog. */}
      <BoardDialog
        open={cancelTicketId !== null}
        elevated
        onClose={() => {
          if (!cancellingTicket) setCancelTicketId(null);
        }}
        title="Cancel this request?"
        footer={
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button onClick={() => setCancelTicketId(null)} disabled={cancellingTicket}>
              Keep request
            </Button>
            <Button
              variant="danger"
              disabled={cancellingTicket}
              onClick={async () => {
                if (!cancelTicketId) return;
                await handleCancelTicket(cancelTicketId);
                setCancelTicketId(null);
              }}
            >
              {cancellingTicket ? "Cancelling…" : "Cancel & refund"}
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-6 text-[var(--av2-text-2)]">
          The request will be removed from your board and the full token cost will be refunded to
          your company. Brief uploads stay on file. This can&apos;t be undone.
        </p>
      </BoardDialog>

      {/* Delete project confirmation */}
      <BoardDialog
        open={!!deleteProject}
        onClose={closeDeleteProject}
        eyebrow="Delete project"
        title={deleteProject?.name ?? ""}
        footer={
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button onClick={closeDeleteProject} disabled={deleteProjectSaving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteProject} disabled={deleteProjectSaving}>
              {deleteProjectSaving ? "Deleting…" : "Delete project"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {deleteProjectError ? <Callout tone="error" title={deleteProjectError} /> : null}
          <p className="text-sm">Are you sure you want to delete this project?</p>
          {deleteProject && deleteProject.ticketCount > 0 ? (
            <Callout tone="warning">
              {deleteProject.ticketCount} {plural(deleteProject.ticketCount, "request", "requests")}{" "}
              will be moved to &ldquo;No project&rdquo;. No requests will be deleted.
            </Callout>
          ) : null}
          {deleteProject && deleteProject.ticketCount === 0 ? (
            <p className="text-sm text-[var(--av2-text-2)]">This project has no requests.</p>
          ) : null}
        </div>
      </BoardDialog>

      {/* Card detail */}
      {detailTicket ? (
        <TicketDetailDialog
          key={detailTicket.id}
          ticket={detailTicket}
          revisions={detailRevisions}
          revisionsLoading={detailRevisionsLoading}
          revisionsError={detailRevisionsError}
          briefAssets={detailBriefAssets}
          briefAssetsLoading={detailBriefAssetsLoading}
          uploadingBriefs={uploadingBriefs}
          uploadProgress={uploadBriefsProgress}
          canEdit={canEditDetail}
          canCancel={canCancelDetail}
          canRequestRevision={canEditTickets(companyRole)}
          canApprove={canMarkTicketsDoneForCompany("CUSTOMER", companyRole)}
          canManageTags={canManageTags(companyRole)}
          metadata={newTicketMeta}
          isEditing={isEditingDetail}
          editForm={editForm}
          setEditForm={setEditForm}
          editSaving={editSaving}
          editError={editError}
          onClose={closeTicketDetails}
          onStartEdit={startEditingDetail}
          onCancelEdit={cancelEditingDetail}
          onSaveEdit={saveDetailEdits}
          onCancelTicket={() => setCancelTicketId(detailTicket.id)}
          onRequestRevision={() => {
            closeTicketDetails();
            setPendingRevisionTicketId(detailTicket.id);
          }}
          onApprove={() => {
            closeTicketDetails();
            setPendingDoneTicketId(detailTicket.id);
          }}
          onUploadBrief={(files) => void handleUploadBriefFromBoard(files)}
          onDeleteBrief={handleDeleteBriefAsset}
          onCreateTag={handleCreateTag}
          onPinRevisionSubmitted={() => {
            closeTicketDetails();
            showToast({
              type: "success",
              title: "Changes requested",
              description: "Your pin annotations have been sent to your creative.",
            });
            void load();
          }}
        />
      ) : null}

      {/* Request revision */}
      <BoardDialog
        open={!!pendingRevisionTicket}
        onClose={handleCancelRevision}
        width="md"
        title="Send this request back to your creative?"
        subtitle="Your creative will see your message and continue working on this request. The status will move back to In progress."
        footer={
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button onClick={handleCancelRevision}>Cancel</Button>
            <Button variant="primary" onClick={handleConfirmRevision}>
              Send back to creative
            </Button>
          </div>
        }
      >
        <Field
          label="Message for your creative"
          htmlFor="customer-board-revision-message"
          error={revisionMessageError}
        >
          <TextArea
            id="customer-board-revision-message"
            value={revisionMessage}
            aria-invalid={revisionMessageError ? true : undefined}
            onChange={(event) => {
              setRevisionMessage(event.target.value);
              if (revisionMessageError) setRevisionMessageError(null);
            }}
            rows={5}
            placeholder="For example: Could we make the hero headline larger and try a version with a darker background?"
          />
        </Field>
      </BoardDialog>

      {/* Approve confirmation — with final work preview + download */}
      <BoardDialog
        open={!!pendingDoneTicket}
        onClose={() => setPendingDoneTicketId(null)}
        width="md"
        title="Approve and complete this request?"
        subtitle="Once you approve, your creative will get paid for this job and the request will move to Done."
        footer={
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button onClick={() => setPendingDoneTicketId(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleConfirmDone}>
              Yes, approve &amp; complete
            </Button>
          </div>
        }
      >
        <div className="rounded-xl bg-[var(--av2-bg)] p-4 text-sm">
          <p className="font-semibold break-words">{pendingDoneTicket?.title}</p>
          {pendingDoneTicket?.projectName ? (
            <p className="mt-1 text-[var(--av2-text-2)]">
              Project: {pendingDoneTicket.projectName}
            </p>
          ) : null}
        </div>

        {pendingDoneRevisionsLoading ? (
          <Skeleton className="mt-4 h-40" />
        ) : (
          (() => {
            if (!pendingDoneRevisions || pendingDoneRevisions.length === 0) return null;
            const latestRev = [...pendingDoneRevisions].reverse()[0];
            const finalAssets = latestRev?.assets ?? [];
            if (finalAssets.length === 0) return null;

            return (
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold">
                  Final work{" "}
                  <span className="font-normal text-[var(--av2-text-2)]">
                    · Version {latestRev.version} · {finalAssets.length}{" "}
                    {plural(finalAssets.length, "file", "files")}
                  </span>
                </p>

                <div
                  className={`grid gap-2 rounded-xl border border-[var(--av2-border)] p-2 ${
                    finalAssets.length === 1 ? "grid-cols-1" : "grid-cols-3"
                  }`}
                >
                  {finalAssets.slice(0, 6).map((asset) => (
                    <div
                      key={asset.id}
                      className="relative overflow-hidden rounded-lg bg-[var(--av2-bg)]"
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
                  {finalAssets.length > 6 ? (
                    <div className="flex h-20 items-center justify-center rounded-lg bg-[var(--av2-bg)] text-sm font-medium text-[var(--av2-text-2)]">
                      +{finalAssets.length - 6} more
                    </div>
                  ) : null}
                </div>

                <Button
                  className="mt-3 w-full"
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
                >
                  <IconDownload />
                  {doneModalDownloading
                    ? "Preparing download…"
                    : finalAssets.length === 1
                      ? "Download final file"
                      : `Download all (${finalAssets.length} files)`}
                </Button>
              </div>
            );
          })()
        )}
      </BoardDialog>

      {/* Skippable creative rating modal — opens after a successful drag-to-DONE
          when the ticket had a creative assigned. Creatives never see these
          ratings; they're an admin-only signal used as an auto-assign tie-breaker. */}
      {ratingForTicket && (
        <RateCreativeModal
          open={true}
          ticketId={ratingForTicket.id}
          ticketTitle={ratingForTicket.title}
          onClose={() => setRatingForTicket(null)}
        />
      )}
    </>
  );
}
