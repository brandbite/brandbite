// -----------------------------------------------------------------------------
// @file: app/customer/tickets/[ticketId]/page.tsx
// @purpose: Customer-facing ticket detail page — full 2-column layout with
//           revisions, inline editing, status actions, tags, and comments.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2025-12-28
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { InlineAlert } from "@/components/ui/inline-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormInput, FormSelect } from "@/components/ui/form-field";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SafeHtml } from "@/components/ui/safe-html";
import { Modal, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { TagBadge } from "@/components/ui/tag-badge";
import { TagMultiSelect, type TagOption } from "@/components/ui/tag-multi-select";
import type { TagColorKey } from "@/lib/tag-colors";
import {
  RevisionImageLarge,
  RevisionImageGrid,
  DownloadAllButton,
  BriefThumbnailRow,
} from "@/components/ui/revision-image";
import type { AssetEntry } from "@/components/ui/revision-image";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  priorityBadgeVariant,
  statusBadgeVariant,
  formatBoardDate,
  formatDateTime,
  formatDueDateCountdown,
  isDueDateOverdue,
  avatarColor,
  getInitials,
  priorityIconMap,
  priorityColorClass,
} from "@/lib/board";
import type { TicketStatus, TicketPriority } from "@/lib/board";
import {
  CompanyRole,
  normalizeCompanyRole,
  canEditTickets,
  canManageTags,
  canMarkTicketsDoneForCompany,
} from "@/lib/permissions/companyRoles";
import {
  downloadSingleAsset,
  downloadAssetsAsZip,
} from "@/lib/download-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TicketDetailResponse = {
  ticket: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    status: TicketStatus;
    priority: TicketPriority;
    dueDate: string | null;
    createdAt: string;
    updatedAt: string;
    companyTicketNumber: number | null;
    quantity: number;
    effectiveCost: number | null;
    effectivePayout: number | null;
    tokenCostOverride: number | null;
    creativePayoutOverride: number | null;
    project: { id: string; name: string; code: string | null } | null;
    jobType: {
      id: string;
      name: string;
      tokenCost: number;
      creativePayoutTokens: number;
    } | null;
    isAssigned: boolean;
    createdBy: { id: string; name: string | null; email: string } | null;
    tags: { id: string; name: string; color: string }[];
  };
};

type TicketRevisionAsset = {
  id: string;
  url: string | null;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
  pinCount: number;
};

type TicketRevisionEntry = {
  version: number;
  submittedAt: string | null;
  feedbackAt: string | null;
  feedbackMessage: string | null;
  assets: TicketRevisionAsset[];
};

type NewTicketMetadata = {
  projects: { id: string; name: string; code: string | null }[];
  jobTypes: { id: string; name: string; description: string | null }[];
  tags: { id: string; name: string; color: string }[];
};

type TicketComment = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
};

type TicketAsset = {
  id: string;
  kind: "BRIEF_INPUT" | "OUTPUT_IMAGE";
  storageKey: string;
  url: string | null;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
  createdAt: string;
};

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TicketDetailResponse };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v = v / 1024;
    i += 1;
  }
  const precision = i === 0 ? 0 : i === 1 ? 0 : 1;
  return `${v.toFixed(precision)} ${units[i]}`;
}

async function getImageDimensions(
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CustomerTicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromBoard = searchParams.get("from") === "board";
  const ticketIdFromParams = params?.ticketId;

  // Core data
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Company role
  const [companyRole, setCompanyRole] = useState<CompanyRole | null>(null);

  // Comments
  const [comments, setComments] = useState<TicketComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Brief assets
  const [briefAssets, setBriefAssets] = useState<TicketAsset[] | null>(null);
  const [briefAssetsLoading, setBriefAssetsLoading] = useState(false);
  const [briefAssetsError, setBriefAssetsError] = useState<string | null>(null);
  const [uploadingBriefs, setUploadingBriefs] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(
    null,
  );

  // Revisions
  const [revisions, setRevisions] = useState<TicketRevisionEntry[] | null>(
    null,
  );
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);

  // Status action modals
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionMessage, setRevisionMessage] = useState("");
  const [revisionMessageError, setRevisionMessageError] = useState<
    string | null
  >(null);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Inline editing
  const [editing, setEditing] = useState(false);
  const [editMeta, setEditMeta] = useState<NewTicketMetadata | null>(null);
  const [editMetaLoading, setEditMetaLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    priority: "",
    dueDate: "",
    projectId: "",
    jobTypeId: "",
    tagIds: [] as string[],
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const ticket = state.status === "ready" ? state.data.ticket : null;
  const ticketId = ticket?.id ?? null;
  const error = state.status === "error" ? state.message : null;

  const normalizedRole = useMemo(
    () => (companyRole ? normalizeCompanyRole(companyRole) : null),
    [companyRole],
  );
  const userCanEdit = useMemo(
    () => ticket?.status === "TODO" && canEditTickets(normalizedRole),
    [ticket?.status, normalizedRole],
  );
  const userCanMarkDone = useMemo(
    () => canMarkTicketsDoneForCompany("CUSTOMER", normalizedRole),
    [normalizedRole],
  );
  const userCanManageTags = useMemo(
    () => canManageTags(normalizedRole),
    [normalizedRole],
  );

  // Brief assets converted to AssetEntry for shared components
  const briefAssetEntries: AssetEntry[] = useMemo(
    () =>
      (briefAssets ?? []).map((a) => ({
        id: a.id,
        url: a.url,
        originalName: a.originalName,
      })),
    [briefAssets],
  );

  const hasCreativeWork = useMemo(
    () =>
      revisions != null &&
      revisions.length > 0 &&
      revisions.some((r) => r.assets && r.assets.length > 0),
    [revisions],
  );

  // -------------------------------------------------------------------------
  // Data loaders
  // -------------------------------------------------------------------------

  // Fetch ticket detail
  useEffect(() => {
    let cancelled = false;
    const resolvedTicketId =
      (typeof ticketIdFromParams === "string" && ticketIdFromParams) ||
      (typeof window !== "undefined"
        ? window.location.pathname.split("/").pop() ?? ""
        : "");

    if (!resolvedTicketId) return;

    const load = async () => {
      setState({ status: "loading" });
      try {
        const res = await fetch(
          `/api/customer/tickets/${resolvedTicketId}`,
          { cache: "no-store" },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            json?.error || `Request failed with status ${res.status}`;
          if (!cancelled) setState({ status: "error", message: msg });
          return;
        }
        if (!cancelled) {
          setState({ status: "ready", data: json as TicketDetailResponse });
        }
      } catch (err) {
        console.error("Ticket detail fetch error:", err);
        if (!cancelled) {
          setState({
            status: "error",
            message: "Unexpected error while loading ticket detail.",
          });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [ticketIdFromParams, refreshCounter]);

  // Fetch company role
  useEffect(() => {
    let cancelled = false;
    const loadRole = async () => {
      try {
        const res = await fetch("/api/customer/company-role", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { role: string | null };
        if (!cancelled) {
          setCompanyRole(
            json.role ? (normalizeCompanyRole(json.role) as CompanyRole) : null,
          );
        }
      } catch (err) {
        console.error("Company role fetch error:", err);
      }
    };
    loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch comments
  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    const loadComments = async () => {
      setCommentsLoading(true);
      setCommentsError(null);
      try {
        const res = await fetch(
          `/api/customer/tickets/${ticketId}/comments`,
          { cache: "no-store" },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          if (!cancelled)
            setCommentsError(
              json?.error || `Request failed with status ${res.status}`,
            );
          return;
        }
        if (!cancelled) setComments((json?.comments as TicketComment[]) ?? []);
      } catch (err) {
        console.error("Ticket comments fetch error:", err);
        if (!cancelled)
          setCommentsError("Unexpected error while loading comments.");
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    };
    loadComments();
    return () => {
      cancelled = true;
    };
  }, [ticketId, refreshCounter]);

  // Fetch brief assets
  const loadBriefAssets = useCallback(async (id: string) => {
    setBriefAssetsLoading(true);
    setBriefAssetsError(null);
    try {
      const res = await fetch(
        `/api/customer/tickets/${id}/assets?kind=BRIEF_INPUT`,
        { cache: "no-store" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setBriefAssetsError(
          json?.error || `Request failed with status ${res.status}`,
        );
        return;
      }
      setBriefAssets((json?.assets as TicketAsset[]) ?? []);
    } catch (err) {
      console.error("Brief assets fetch error:", err);
      setBriefAssetsError("Unexpected error while loading attachments.");
    } finally {
      setBriefAssetsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ticketId) return;
    loadBriefAssets(ticketId);
  }, [ticketId, loadBriefAssets, refreshCounter]);

  // Fetch revisions
  useEffect(() => {
    if (!ticketId || ticket?.status === "TODO") {
      setRevisions(null);
      return;
    }
    let cancelled = false;
    const loadRevisions = async () => {
      setRevisionsLoading(true);
      setRevisionsError(null);
      try {
        const res = await fetch(
          `/api/customer/tickets/${ticketId}/revisions`,
          { cache: "no-store" },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          if (!cancelled)
            setRevisionsError(
              json?.error || `Request failed with status ${res.status}`,
            );
          return;
        }
        if (!cancelled) {
          setRevisions(
            ((json as any)?.revisions ?? []) as TicketRevisionEntry[],
          );
        }
      } catch (err) {
        console.error("Revisions fetch error:", err);
        if (!cancelled)
          setRevisionsError("Unexpected error while loading revisions.");
      } finally {
        if (!cancelled) setRevisionsLoading(false);
      }
    };
    loadRevisions();
    return () => {
      cancelled = true;
    };
  }, [ticketId, ticket?.status, refreshCounter]);

  // Lazy-load edit metadata
  useEffect(() => {
    if (!editing || editMeta) return;
    let cancelled = false;
    const loadMeta = async () => {
      setEditMetaLoading(true);
      try {
        const res = await fetch("/api/customer/tickets/new-metadata", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) return;
        if (!cancelled) setEditMeta(json as NewTicketMetadata);
      } catch (err) {
        console.error("Edit metadata fetch error:", err);
      } finally {
        if (!cancelled) setEditMetaLoading(false);
      }
    };
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [editing, editMeta]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  // Status change
  const persistStatus = useCallback(
    async (newStatus: string, revMsg?: string) => {
      if (!ticketId) return;
      setStatusSaving(true);
      setStatusError(null);
      try {
        const payload: Record<string, string> = { ticketId, status: newStatus };
        if (revMsg && revMsg.trim()) payload.revisionMessage = revMsg.trim();

        const res = await fetch("/api/customer/tickets/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            json?.error ||
            "We couldn't update this request. Please try again.";
          setStatusError(typeof msg === "string" ? msg : String(msg));
          return;
        }
        // Refresh all data
        setRefreshCounter((c) => c + 1);
      } catch (err) {
        console.error("Status update error:", err);
        setStatusError("Unexpected error while updating status.");
      } finally {
        setStatusSaving(false);
      }
    },
    [ticketId],
  );

  const handleConfirmRevision = useCallback(async () => {
    if (!revisionMessage.trim()) {
      setRevisionMessageError("Please add a short message for your creative.");
      return;
    }
    await persistStatus("IN_PROGRESS", revisionMessage.trim());
    setShowRevisionModal(false);
    setRevisionMessage("");
    setRevisionMessageError(null);
  }, [revisionMessage, persistStatus]);

  const handleCancelRevision = useCallback(() => {
    setShowRevisionModal(false);
    setRevisionMessage("");
    setRevisionMessageError(null);
  }, []);

  const handleConfirmDone = useCallback(async () => {
    await persistStatus("DONE");
    setShowDoneModal(false);
  }, [persistStatus]);

  // Inline editing
  const startEditing = useCallback(() => {
    if (!ticket) return;
    setEditForm({
      title: ticket.title,
      description: ticket.description ?? "",
      priority: ticket.priority,
      dueDate: ticket.dueDate ? ticket.dueDate.split("T")[0] : "",
      projectId: ticket.project?.id ?? "",
      jobTypeId: ticket.jobType?.id ?? "",
      tagIds: ticket.tags.map((t) => t.id),
    });
    setEditError(null);
    setEditing(true);
  }, [ticket]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setEditError(null);
  }, []);

  const saveEdits = useCallback(async () => {
    if (!ticketId) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const body: Record<string, unknown> = {
        title: editForm.title,
        description: editForm.description,
        priority: editForm.priority,
        dueDate: editForm.dueDate || null,
        projectId: editForm.projectId || null,
        jobTypeId: editForm.jobTypeId || null,
        tagIds: editForm.tagIds,
      };
      const res = await fetch(`/api/customer/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || "Failed to save changes.";
        setEditError(typeof msg === "string" ? msg : String(msg));
        return;
      }
      setEditing(false);
      setRefreshCounter((c) => c + 1);
    } catch (err) {
      console.error("Save edits error:", err);
      setEditError("Unexpected error while saving changes.");
    } finally {
      setEditSaving(false);
    }
  }, [ticketId, editForm]);

  // Comment handler
  const handleSubmitComment = useCallback(async () => {
    if (!ticketId) return;
    const trimmed = newComment.trim();
    if (!trimmed) return;
    setSubmittingComment(true);
    setCommentsError(null);
    try {
      const res = await fetch(
        `/api/customer/tickets/${ticketId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmed }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setCommentsError(
          json?.error || `Request failed with status ${res.status}`,
        );
        return;
      }
      const created = json?.comment as TicketComment | undefined;
      if (created) {
        setComments((prev) => [...(prev ?? []), created]);
        setNewComment("");
      }
    } catch (err) {
      console.error("Add comment error:", err);
      setCommentsError("Failed to add comment. Please try again.");
    } finally {
      setSubmittingComment(false);
    }
  }, [ticketId, newComment]);

  // Brief upload handler
  const handleUploadBriefFiles = useCallback(
    async (files: FileList | null) => {
      if (!ticketId) return;
      if (!files || files.length === 0) return;
      const incoming = Array.from(files);
      const accepted = incoming.filter((f) => f.type.startsWith("image/"));
      if (accepted.length === 0) {
        setBriefAssetsError("Only image files are supported for now.");
        return;
      }
      setUploadingBriefs(true);
      setUploadProgressText("Preparing uploads...");
      setBriefAssetsError(null);
      let failed = 0;
      for (let i = 0; i < accepted.length; i += 1) {
        const file = accepted[i];
        try {
          setUploadProgressText(
            `Uploading ${i + 1} of ${accepted.length}...`,
          );
          const presignRes = await fetch("/api/uploads/r2/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticketId,
              kind: "BRIEF_INPUT",
              contentType: file.type || "application/octet-stream",
              bytes: file.size,
              originalName: file.name,
            }),
          });
          const presignJson = await presignRes.json().catch(() => null);
          if (!presignRes.ok) {
            failed += 1;
            continue;
          }
          const uploadUrl: string | undefined = presignJson?.uploadUrl;
          const storageKey: string | undefined = presignJson?.storageKey;
          if (!uploadUrl || !storageKey) {
            failed += 1;
            continue;
          }
          const putRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          });
          if (!putRes.ok) {
            failed += 1;
            continue;
          }
          const dims = await getImageDimensions(file);
          const registerRes = await fetch("/api/assets/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticketId,
              kind: "BRIEF_INPUT",
              storageKey,
              mimeType: file.type || "application/octet-stream",
              bytes: file.size,
              width: dims?.width ?? null,
              height: dims?.height ?? null,
              originalName: file.name,
            }),
          });
          if (!registerRes.ok) {
            failed += 1;
          }
        } catch {
          failed += 1;
        }
      }
      setUploadProgressText(null);
      setUploadingBriefs(false);
      await loadBriefAssets(ticketId);
      if (failed > 0) {
        setBriefAssetsError(
          `Some uploads failed (${failed}). You can try again.`,
        );
      }
    },
    [ticketId, loadBriefAssets],
  );

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (state.status === "loading") {
    return <TicketDetailSkeleton />;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() =>
              router.push(
                fromBoard ? "/customer/board" : "/customer/tickets",
              )
            }
            className="mb-2 inline-flex items-center gap-1 text-xs text-[#7a7a7a] hover:text-[#424143]"
          >
            <span className="text-lg leading-none">&larr;</span>
            <span>{fromBoard ? "Back to board" : "Back to tickets"}</span>
          </button>

          <div className="flex items-center gap-3">
            {editing ? (
              <FormInput
                value={editForm.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditForm((f) => ({ ...f, title: e.target.value }))
                }
                disabled={editSaving}
                className="text-2xl font-semibold"
              />
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight">
                {ticket?.title ?? "Ticket"}
              </h1>
            )}
          </div>

          {ticket?.code && (
            <p className="mt-1 text-xs text-[#9a9892]">
              Ticket code:{" "}
              <span className="font-medium text-[#424143]">
                {ticket.code}
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {ticket && (
            <div className="flex items-center gap-2">
              <Badge variant={statusBadgeVariant(ticket.status)}>
                {STATUS_LABELS[ticket.status]}
              </Badge>
              <Badge variant={priorityBadgeVariant(ticket.priority)}>
                {PRIORITY_LABELS[ticket.priority]}
              </Badge>
            </div>
          )}

          {/* Edit / Save / Cancel buttons */}
          {userCanEdit && !editing && (
            <Button variant="secondary" size="sm" onClick={startEditing}>
              Edit
            </Button>
          )}
          {editing && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={saveEdits}
                loading={editSaving}
                loadingText="Saving…"
              >
                Save changes
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={cancelEditing}
                disabled={editSaving}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <InlineAlert variant="error" title="Something went wrong" className="mb-4">
          {error}
        </InlineAlert>
      )}

      {/* Status error (from status change attempt) */}
      {statusError && (
        <InlineAlert variant="error" title="Status update failed" className="mb-4">
          {statusError}
        </InlineAlert>
      )}

      {!error && ticket && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ============================================================= */}
          {/* LEFT COLUMN — main content (2/3 width)                        */}
          {/* ============================================================= */}
          <section className="space-y-4 lg:col-span-2">
            {/* Status action banner — IN_REVIEW */}
            {ticket.status === "IN_REVIEW" && normalizedRole && (
              <div className="flex items-center gap-3 rounded-xl border border-[#f5c4ad] bg-[#fff8f5] px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#424143]">
                    This request is ready for your review
                  </p>
                  <p className="mt-0.5 text-xs text-[#7a7a7a]">
                    Review the creative&apos;s work below, then approve it or
                    request changes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canEditTickets(normalizedRole) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowRevisionModal(true)}
                      disabled={statusSaving}
                    >
                      Request changes
                    </Button>
                  )}
                  {userCanMarkDone && (
                    <Button
                      size="sm"
                      className="bg-[#32b37b] hover:bg-[#2ba06a]"
                      onClick={() => setShowDoneModal(true)}
                      disabled={statusSaving}
                    >
                      Mark as done
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Brief card */}
            <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[#424143]">Brief</h2>
                {ticket.status === "TODO" && (
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-full border border-[#d4d2cc] bg-white px-3 py-1 text-[11px] font-medium text-[#424143] hover:bg-[#f7f4f0] disabled:cursor-not-allowed disabled:opacity-60">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploadingBriefs}
                        onChange={(e) => {
                          void handleUploadBriefFiles(e.target.files);
                          e.currentTarget.value = "";
                        }}
                      />
                      Add images
                    </label>
                  </div>
                )}
              </div>

              {/* Description */}
              {editing ? (
                <div className="mt-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b1afa9]">
                    Description
                  </p>
                  <RichTextEditor
                    value={editForm.description}
                    onChange={(html) =>
                      setEditForm((f) => ({
                        ...f,
                        description: html,
                      }))
                    }
                    disabled={editSaving}
                    minHeight="60px"
                  />
                </div>
              ) : ticket.description ? (
                <SafeHtml
                  html={ticket.description}
                  className="mt-2 text-sm text-[#7a7a7a]"
                />
              ) : (
                <p className="mt-2 text-xs text-[#9a9892]">
                  No description was provided for this ticket.
                </p>
              )}

              {editError && (
                <InlineAlert variant="error" size="sm" className="mt-3">
                  {editError}
                </InlineAlert>
              )}

              {/* Brief attachments */}
              <div className="mt-4">
                {uploadProgressText && (
                  <div className="mb-2 rounded-md border border-[#eadfce] bg-[#fffaf1] px-3 py-2 text-[11px] text-[#6b6258]">
                    {uploadProgressText}
                  </div>
                )}

                {briefAssetsError && (
                  <InlineAlert variant="error" size="sm" className="mb-2">
                    {briefAssetsError}
                  </InlineAlert>
                )}

                {briefAssetsLoading && (
                  <div className="flex items-center gap-2 py-3">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#e3e1dc] border-t-[#9a9892]" />
                    <p className="text-xs text-[#9a9892]">
                      Loading attachments…
                    </p>
                  </div>
                )}

                {!briefAssetsLoading &&
                  !briefAssetsError &&
                  briefAssetEntries.length === 0 && (
                    <EmptyState
                      title="No attachments yet."
                      description="Add reference images to help your creative."
                    />
                  )}

                {!briefAssetsLoading &&
                  !briefAssetsError &&
                  briefAssetEntries.length > 0 && (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b1afa9]">
                          Brief attachments
                          <span className="ml-1.5 text-[#9a9892]">
                            ({briefAssetEntries.length})
                          </span>
                        </p>
                        <DownloadAllButton
                          assets={briefAssetEntries}
                          zipFilename="brief-attachments.zip"
                        />
                      </div>
                      {hasCreativeWork ? (
                        <BriefThumbnailRow assets={briefAssetEntries} />
                      ) : (
                        <RevisionImageLarge
                          assets={briefAssetEntries}
                          pinMode="view"
                        />
                      )}
                    </div>
                  )}
              </div>
            </div>

            {/* Revision History */}
            {ticket.status !== "TODO" && (
              <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
                <h2 className="text-sm font-semibold text-[#424143]">
                  Revision history
                </h2>

                {revisionsLoading && (
                  <div className="mt-3 flex items-center gap-2 py-3">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#e3e1dc] border-t-[#9a9892]" />
                    <p className="text-xs text-[#9a9892]">
                      Loading revisions…
                    </p>
                  </div>
                )}

                {revisionsError && (
                  <InlineAlert variant="error" size="sm" className="mt-3">
                    {revisionsError}
                  </InlineAlert>
                )}

                {!revisionsLoading &&
                  !revisionsError &&
                  (!revisions || revisions.length === 0) && (
                    <div className="mt-3">
                      <EmptyState
                        title="No revisions yet."
                        description="Once your creative sends this ticket for review, you'll see each version and your feedback here."
                      />
                    </div>
                  )}

                {!revisionsLoading &&
                  !revisionsError &&
                  revisions &&
                  revisions.length > 0 && (
                    <div className="mt-3 space-y-6">
                      {[...revisions].reverse().map((rev) => {
                        const revAssets: AssetEntry[] = rev.assets.map(
                          (a) => ({
                            id: a.id,
                            url: a.url,
                            originalName: a.originalName,
                            pinCount: a.pinCount,
                          }),
                        );

                        return (
                          <div key={rev.version}>
                            <div className="mb-2 flex items-center justify-between">
                              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b1afa9]">
                                <span>Version {rev.version}</span>
                                {rev.submittedAt && (
                                  <span className="font-normal normal-case tracking-normal text-[#9a9892]">
                                    — {formatBoardDate(rev.submittedAt)}{" "}
                                    &middot; {revAssets.length} file
                                    {revAssets.length !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </p>
                              {revAssets.length > 0 && (
                                <DownloadAllButton
                                  assets={revAssets}
                                  zipFilename={`revision-v${rev.version}.zip`}
                                />
                              )}
                            </div>

                            {revAssets.length > 0 && (
                              <div className="mb-2">
                                {revAssets.length === 1 ? (
                                  <RevisionImageLarge
                                    assets={revAssets}
                                    pinMode={ticket.status === "IN_REVIEW" ? "review" : "view"}
                                  />
                                ) : (
                                  <RevisionImageGrid
                                    assets={revAssets}
                                    pinMode={ticket.status === "IN_REVIEW" ? "review" : "view"}
                                  />
                                )}
                              </div>
                            )}

                            {/* Feedback message */}
                            {rev.feedbackMessage && (
                              <div className="mt-2 rounded-lg border border-[#f5c4ad] bg-[#fff8f5] px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d6471b]">
                                  Your feedback
                                </p>
                                <p className="mt-1 text-xs text-[#424143]">
                                  {rev.feedbackMessage}
                                </p>
                                {rev.feedbackAt && (
                                  <p className="mt-1 text-[10px] text-[#9a9892]">
                                    {formatBoardDate(rev.feedbackAt)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            )}
          </section>

          {/* ============================================================= */}
          {/* RIGHT COLUMN — sidebar (1/3 width)                            */}
          {/* ============================================================= */}
          <aside className="space-y-4 lg:col-span-1">
            {/* Details card */}
            <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                Details
              </h3>
              <div className="space-y-3 text-xs">
                {/* Status */}
                <div>
                  <p className="text-[#9a9892]">Status</p>
                  <div className="mt-0.5">
                    <Badge variant={statusBadgeVariant(ticket.status)}>
                      {STATUS_LABELS[ticket.status]}
                    </Badge>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <p className="text-[#9a9892]">Priority</p>
                  {editing ? (
                    <FormSelect
                      size="sm"
                      value={editForm.priority}
                      onChange={(
                        e: React.ChangeEvent<HTMLSelectElement>,
                      ) =>
                        setEditForm((f) => ({
                          ...f,
                          priority: e.target.value,
                        }))
                      }
                      disabled={editSaving}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </FormSelect>
                  ) : (
                    <p className="mt-0.5 font-semibold text-[#424143]">
                      <span
                        className={priorityColorClass(ticket.priority)}
                      >
                        {priorityIconMap[ticket.priority]}
                      </span>{" "}
                      {PRIORITY_LABELS[ticket.priority]}
                    </p>
                  )}
                </div>

                {/* Project */}
                <div>
                  <p className="text-[#9a9892]">Project</p>
                  {editing ? (
                    <FormSelect
                      size="sm"
                      value={editForm.projectId}
                      onChange={(
                        e: React.ChangeEvent<HTMLSelectElement>,
                      ) =>
                        setEditForm((f) => ({
                          ...f,
                          projectId: e.target.value,
                        }))
                      }
                      disabled={editSaving || !editMeta}
                    >
                      <option value="">No specific project</option>
                      {(editMeta?.projects ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.code ? ` (${p.code})` : ""}
                        </option>
                      ))}
                    </FormSelect>
                  ) : (
                    <p className="mt-0.5 font-semibold text-[#424143]">
                      {ticket.project?.name || "—"}
                    </p>
                  )}
                </div>

                {/* Job type */}
                <div>
                  <p className="text-[#9a9892]">Job type</p>
                  {editing ? (
                    <FormSelect
                      size="sm"
                      value={editForm.jobTypeId}
                      onChange={(
                        e: React.ChangeEvent<HTMLSelectElement>,
                      ) =>
                        setEditForm((f) => ({
                          ...f,
                          jobTypeId: e.target.value,
                        }))
                      }
                      disabled={editSaving || !editMeta}
                    >
                      <option value="">Choose a job type</option>
                      {(editMeta?.jobTypes ?? []).map((jt) => (
                        <option key={jt.id} value={jt.id}>
                          {jt.name}
                        </option>
                      ))}
                    </FormSelect>
                  ) : (
                    <p className="mt-0.5 font-semibold text-[#424143]">
                      {ticket.jobType?.name || "—"}
                    </p>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <p className="text-[#9a9892]">Tags</p>
                  {editing ? (
                    <div className="mt-1">
                      <TagMultiSelect
                        availableTags={
                          (editMeta?.tags ?? []) as TagOption[]
                        }
                        selectedTagIds={editForm.tagIds}
                        onChange={(tagIds) =>
                          setEditForm((f) => ({ ...f, tagIds }))
                        }
                        onCreateTag={async (name, color) => {
                          try {
                            const res = await fetch(
                              "/api/customer/tags",
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ name, color }),
                              },
                            );
                            const json = await res
                              .json()
                              .catch(() => null);
                            if (!res.ok) {
                              setEditError(json?.error || "Failed to create tag");
                              return null;
                            }
                            const created = json.tag as TagOption;
                            setEditMeta((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    tags: [
                                      ...(prev.tags ?? []),
                                      created,
                                    ].sort((a, b) =>
                                      a.name.localeCompare(b.name),
                                    ),
                                  }
                                : prev,
                            );
                            return created;
                          } catch {
                            setEditError("Failed to create tag");
                            return null;
                          }
                        }}
                        canCreate={userCanManageTags}
                        disabled={editSaving}
                      />
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ticket.tags && ticket.tags.length > 0 ? (
                        ticket.tags.map((tag) => (
                          <TagBadge
                            key={tag.id}
                            name={tag.name}
                            color={tag.color as TagColorKey}
                          />
                        ))
                      ) : (
                        <p className="text-[11px] text-[#9a9892]">—</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Due date */}
                <div>
                  <p className="text-[#9a9892]">Due date</p>
                  {editing ? (
                    <FormInput
                      type="date"
                      size="sm"
                      value={editForm.dueDate}
                      onChange={(
                        e: React.ChangeEvent<HTMLInputElement>,
                      ) =>
                        setEditForm((f) => ({
                          ...f,
                          dueDate: e.target.value,
                        }))
                      }
                      disabled={editSaving}
                    />
                  ) : (
                    <>
                      <p
                        className={`mt-0.5 font-semibold ${isDueDateOverdue(ticket.dueDate) ? "text-[#b13832]" : "text-[#424143]"}`}
                      >
                        {formatBoardDate(ticket.dueDate)}
                      </p>
                      {(() => {
                        const countdown = formatDueDateCountdown(
                          ticket.dueDate,
                        );
                        if (!countdown) return null;
                        return (
                          <p
                            className={`mt-0.5 text-[10px] font-medium ${countdown.overdue ? "text-[#b13832]" : "text-[#7a7a7a]"}`}
                          >
                            {countdown.label}
                          </p>
                        );
                      })()}
                    </>
                  )}
                </div>

                {/* Token cost */}
                {ticket.effectiveCost != null && (
                  <div>
                    <p className="text-[#9a9892]">Token cost</p>
                    <p className="mt-0.5 font-semibold text-[#424143]">
                      {ticket.quantity > 1 && ticket.jobType
                        ? `${ticket.jobType.tokenCost} × ${ticket.quantity} = ${ticket.effectiveCost} tokens`
                        : `${ticket.effectiveCost} tokens`}
                    </p>
                    {ticket.tokenCostOverride != null && (
                      <p className="mt-0.5 text-[10px] text-[var(--bb-primary)]">
                        Admin override applied
                      </p>
                    )}
                  </div>
                )}

                {/* Quantity (when > 1) */}
                {ticket.quantity > 1 && (
                  <div>
                    <p className="text-[#9a9892]">Quantity</p>
                    <p className="mt-0.5 font-semibold text-[#424143]">
                      ×{ticket.quantity}
                    </p>
                  </div>
                )}

                {/* Created / Updated */}
                <div className="border-t border-[#ece9e1] pt-3">
                  <div className="space-y-2">
                    <div>
                      <p className="text-[#9a9892]">Created</p>
                      <p className="mt-0.5 font-semibold text-[#424143]">
                        {formatBoardDate(ticket.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#9a9892]">Updated</p>
                      <p className="mt-0.5 font-semibold text-[#424143]">
                        {formatBoardDate(ticket.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* People card */}
            <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                People
              </h3>
              <div className="space-y-3">
                {/* Requester */}
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{
                      backgroundColor: avatarColor(
                        ticket.createdBy?.name ||
                          ticket.createdBy?.email ||
                          "Unknown",
                      ),
                    }}
                  >
                    {getInitials(
                      ticket.createdBy?.name ?? null,
                      ticket.createdBy?.email ?? null,
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#424143]">
                      {ticket.createdBy?.name ||
                        ticket.createdBy?.email ||
                        "—"}
                    </p>
                    <p className="text-[10px] text-[#9a9892]">Requester</p>
                  </div>
                </div>

                {/* Assignment status */}
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                      ticket.isAssigned ? "bg-[#22C55E]" : "bg-[#9CA3AF]"
                    }`}
                  >
                    {ticket.isAssigned ? "\u2713" : "\u2014"}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#424143]">
                      {ticket.isAssigned ? "Assigned" : "Unassigned"}
                    </p>
                    <p className="text-[10px] text-[#9a9892]">Design team</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Comments card */}
            <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                Comments
              </h3>

              {commentsError && (
                <InlineAlert variant="error" size="sm" className="mb-2">
                  {commentsError}
                </InlineAlert>
              )}

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {commentsLoading && (
                  <p className="text-[11px] text-[#9a9892]">
                    Loading comments…
                  </p>
                )}
                {!commentsLoading &&
                  !commentsError &&
                  (comments?.length ?? 0) === 0 && (
                    <EmptyState
                      title="No comments yet."
                      description="Use the form below to start a thread with your team and the creative."
                    />
                  )}
                {!commentsLoading &&
                  !commentsError &&
                  (comments?.length ?? 0) > 0 &&
                  comments!.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg bg-[#f5f3f0] px-3 py-2 text-[11px]"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold text-[#424143]">
                          {c.author.name || c.author.email}
                        </span>
                        <span className="text-[10px] text-[#9a9892]">
                          {formatDateTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-[#424143]">
                        {c.body}
                      </p>
                    </div>
                  ))}
              </div>

              {/* Add comment form */}
              <div className="mt-3 border-t border-[#ebe7df] pt-3">
                <label className="mb-1 block text-[11px] font-medium text-[#424143]">
                  Add a comment
                </label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  placeholder="Share feedback, clarifications, or next steps for this ticket."
                  className="w-full rounded-md border border-[#d4d2cc] bg-[#fbf8f4] px-3 py-2 text-[11px] text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[10px] text-[#9a9892]">
                    Comments are visible to your team and Brandbite creatives.
                  </p>
                  <button
                    type="button"
                    disabled={
                      submittingComment || !newComment.trim() || !ticketId
                    }
                    onClick={handleSubmitComment}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${
                      submittingComment || !newComment.trim()
                        ? "cursor-not-allowed bg-[#e3ded4] text-[#9a9892]"
                        : "bg-[#f15b2b] text-white hover:bg-[#e44f22]"
                    }`}
                  >
                    {submittingComment ? "Sending…" : "Add comment"}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {!error && !ticket && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-[#fffaf2] px-4 py-3 text-sm text-amber-800">
          Ticket could not be loaded.
        </div>
      )}

      {/* ================================================================= */}
      {/* Request Changes Modal                                             */}
      {/* ================================================================= */}
      <Modal
        open={showRevisionModal}
        onClose={handleCancelRevision}
        size="md"
      >
        <ModalHeader
          title="Send this request back to your creative?"
          subtitle="Your creative will see your message and continue working on this request. The status will move back to In progress."
        />

        <div>
          <label className="block text-xs font-medium text-[#424143]">
            Message for your creative
          </label>
          <textarea
            value={revisionMessage}
            onChange={(e) => {
              setRevisionMessage(e.target.value);
              if (revisionMessageError) setRevisionMessageError(null);
            }}
            placeholder="For example: Could we make the hero headline larger and try a version with a darker background?"
            className="mt-1.5 h-28 w-full rounded-xl border border-[#e3e1dc] bg-white px-3 py-2.5 text-xs text-[#424143] outline-none placeholder:text-[#b1afa9] focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
          />
          {revisionMessageError && (
            <p className="mt-1 text-[11px] text-[#b13832]">
              {revisionMessageError}
            </p>
          )}
        </div>

        <ModalFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancelRevision}
            disabled={statusSaving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmRevision}
            loading={statusSaving}
            loadingText="Sending…"
          >
            Send back to creative
          </Button>
        </ModalFooter>
      </Modal>

      {/* ================================================================= */}
      {/* Mark as Done Modal                                                */}
      {/* ================================================================= */}
      <Modal
        open={showDoneModal}
        onClose={() => setShowDoneModal(false)}
        size="md"
      >
        <ModalHeader
          title="Mark this request as done?"
          subtitle="Once you mark this request as done, your creative will get paid for this job, and the ticket will move to Done."
        />

        <div className="rounded-xl bg-[#f7f5f0] px-3 py-3 text-xs text-[#424143]">
          <p className="font-semibold">{ticket?.title}</p>
          {ticket?.project?.name && (
            <p className="mt-1 text-[#7a7a7a]">
              Project: {ticket.project.name}
            </p>
          )}
          {ticket?.jobType?.name && (
            <p className="mt-0.5 text-[#7a7a7a]">
              Job type: {ticket.jobType.name}
            </p>
          )}
        </div>

        {/* Latest revision preview */}
        {(() => {
          if (!revisions || revisions.length === 0) return null;
          const latestRev = [...revisions].reverse()[0];
          const finalAssets = latestRev?.assets ?? [];
          if (finalAssets.length === 0) return null;

          const assetEntries: AssetEntry[] = finalAssets.map((a) => ({
            id: a.id,
            url: a.url,
            originalName: a.originalName,
            pinCount: a.pinCount,
          }));

          return (
            <div className="mt-3">
              <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b1afa9]">
                <span>Final work</span>
                <span className="font-normal normal-case tracking-normal text-[#9a9892]">
                  — Version {latestRev.version} &middot;{" "}
                  {finalAssets.length} file
                  {finalAssets.length !== 1 ? "s" : ""}
                </span>
              </p>

              {finalAssets.length === 1 ? (
                <RevisionImageLarge
                  assets={assetEntries}
                  pinMode="view"
                />
              ) : (
                <RevisionImageGrid
                  assets={assetEntries}
                  pinMode="view"
                />
              )}
            </div>
          );
        })()}

        <ModalFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDoneModal(false)}
            disabled={statusSaving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-[#32b37b] hover:bg-[#2ba06a]"
            onClick={handleConfirmDone}
            loading={statusSaving}
            loadingText="Approving…"
          >
            Approve &amp; mark done
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TicketDetailSkeleton() {
  return (
    <>
      {/* Header skeleton */}
      <div className="mb-4">
        <div className="mb-2 h-4 w-24 rounded bg-[#e3ded4]" />
        <div className="h-7 w-72 rounded bg-[#e3ded4]" />
        <div className="mt-2 h-3 w-40 rounded bg-[#e3ded4]" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left skeleton */}
        <div className="space-y-4 lg:col-span-2">
          <div className="h-48 rounded-2xl border border-[#e3e1dc] bg-white" />
          <div className="h-32 rounded-2xl border border-[#e3e1dc] bg-white" />
        </div>

        {/* Right skeleton */}
        <div className="space-y-4 lg:col-span-1">
          <div className="h-64 rounded-2xl border border-[#e3e1dc] bg-white" />
          <div className="h-24 rounded-2xl border border-[#e3e1dc] bg-white" />
          <div className="h-40 rounded-2xl border border-[#e3e1dc] bg-white" />
        </div>
      </div>
    </>
  );
}
