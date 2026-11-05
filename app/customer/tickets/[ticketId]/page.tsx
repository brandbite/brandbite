// -----------------------------------------------------------------------------
// @file: app/customer/tickets/[ticketId]/page.tsx
// @purpose: Customer-facing ticket detail page — full 2-column layout with
//           revisions, inline editing, status actions, tags, and comments.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2025-12-28
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { IconClock } from "@/components/admin/v2/icons";
import {
  Button,
  Callout,
  Card,
  DASH,
  EmptyState,
  Eyebrow,
  Field,
  IconTile,
  KeyValueList,
  plural,
  Select,
  Skeleton,
  TabPanel,
  Tabs,
  TextArea,
  TextInput,
} from "@/components/admin/v2/ui";
import {
  BackLink,
  CollapsedVersion,
  CommentsPanel,
  CurrentVersionCard,
  DetailColumns,
  DetailSkeleton,
  DownloadFilesButton,
  FilePreviews,
  PersonRow,
  PriorityBadge,
  StatusBadge,
  TicketHeader,
  TicketTitle,
  tokenCount,
  versionAssets,
  VersionsHeading,
  type TicketComment,
  type TicketVersion,
} from "@/components/dashboard/tickets/shared";
import { useToast } from "@/components/ui/toast-provider";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SafeHtml } from "@/components/ui/safe-html";
import { Modal, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RateCreativeModal } from "@/components/ratings/rate-creative-modal";
import { TagBadge } from "@/components/ui/tag-badge";
import { TagMultiSelect, type TagOption } from "@/components/ui/tag-multi-select";
import type { TagColorKey } from "@/lib/tag-colors";
import { BRIEF_ACCEPT_ATTR, BRIEF_ACCEPTED_LABEL, isBriefMimeAllowed } from "@/lib/upload-helpers";
import type { AssetEntry } from "@/components/ui/revision-image";
import { formatBoardDate, formatDueDateCountdown } from "@/lib/board";
import type { TicketStatus, TicketPriority } from "@/lib/board";
import {
  CompanyRole,
  normalizeCompanyRole,
  canEditTickets,
  canManageTags,
  isCompanyAdminRole,
  canMarkTicketsDoneForCompany,
} from "@/lib/permissions/companyRoles";
import { RevisionCompare } from "@/components/ui/revision-compare";
import { AiTicketControls } from "@/components/ui/ai-ticket-controls";
import { TicketActivityPanel } from "@/components/dashboard/ticket-activity-panel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TicketMoodboard = {
  id: string;
  title: string;
  itemCount: number;
};

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
    creativeMode: "DESIGNER" | "AI";
    createdBy: { id: string; name: string | null; email: string } | null;
    completedAt: string | null;
    completedBy: { id: string; name: string | null; email: string } | null;
    tags: { id: string; name: string; color: string }[];
    moodboards?: TicketMoodboard[];
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
  openPins: number;
  resolvedPins: number;
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
  // Mirrors the global TAGS_ENABLED AppSetting. When false, the Tags
  // row in the edit panel is hidden. Treated as `true` when undefined
  // so older deploys keep working.
  tagsEnabled?: boolean;
};

type DetailTab = "current" | "brief" | "versions" | "comments" | "activity";

const TAB_PREFIX = "request-detail";

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

async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
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
  const { showToast } = useToast();

  // Pin notes sent from the revision viewer move the ticket back to
  // IN_PROGRESS server-side; reload so the status and revisions catch up.
  const handlePinsSubmitted = useCallback(() => {
    setRefreshCounter((c) => c + 1);
    showToast({
      type: "success",
      title: "Changes requested",
      description: "Your pin notes have been sent to your creative.",
    });
  }, [showToast]);

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
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const briefInputRef = useRef<HTMLInputElement>(null);

  // Section tabs. Null until the customer picks one, so the default can follow
  // the data: the current version when one exists, otherwise the brief.
  const [tab, setTab] = useState<DetailTab | null>(null);

  // Revisions
  const [revisions, setRevisions] = useState<TicketRevisionEntry[] | null>(null);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  // Status action modals
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionMessage, setRevisionMessage] = useState("");
  const [revisionMessageError, setRevisionMessageError] = useState<string | null>(null);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
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
  const userCanManageTags = useMemo(() => canManageTags(normalizedRole), [normalizedRole]);

  // Cancel-with-refund permission. OWNER + PM only (matches server-side
  // isCompanyAdminRole gate). Only available while the ticket is still
  // TODO and not assigned to a creative — once work has started a refund
  // would be unfair to the creative who spent prep time.
  const userCanCancel = useMemo(
    () => ticket?.status === "TODO" && !ticket?.isAssigned && isCompanyAdminRole(normalizedRole),
    [ticket?.status, ticket?.isAssigned, normalizedRole],
  );

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = useCallback(async () => {
    if (!ticket?.id) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/customer/tickets/${ticket.id}/cancel`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setCancelError(body?.error || "Failed to cancel ticket");
        return;
      }
      // Send the user back to the list / board with the refund
      // confirmed. The next list fetch will exclude this row by default
      // (the API hides CANCELED) so they won't see it on return.
      setCancelOpen(false);
      router.push(fromBoard ? "/customer/board" : "/customer/tickets");
    } catch {
      setCancelError("Failed to cancel ticket");
    } finally {
      setCancelling(false);
    }
  }, [ticket?.id, router, fromBoard]);

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
      (typeof window !== "undefined" ? (window.location.pathname.split("/").pop() ?? "") : "");

    if (!resolvedTicketId) return;

    const load = async () => {
      setState({ status: "loading" });
      try {
        const res = await fetch(`/api/customer/tickets/${resolvedTicketId}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = json?.error || `Request failed with status ${res.status}`;
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
          setCompanyRole(json.role ? (normalizeCompanyRole(json.role) as CompanyRole) : null);
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
        const res = await fetch(`/api/customer/tickets/${ticketId}/comments`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          if (!cancelled)
            setCommentsError(json?.error || `Request failed with status ${res.status}`);
          return;
        }
        if (!cancelled) setComments((json?.comments as TicketComment[]) ?? []);
      } catch (err) {
        console.error("Ticket comments fetch error:", err);
        if (!cancelled) setCommentsError("Unexpected error while loading comments.");
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
      const res = await fetch(`/api/customer/tickets/${id}/assets?kind=BRIEF_INPUT`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setBriefAssetsError(json?.error || `Request failed with status ${res.status}`);
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
        const res = await fetch(`/api/customer/tickets/${ticketId}/revisions`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          if (!cancelled)
            setRevisionsError(json?.error || `Request failed with status ${res.status}`);
          return;
        }
        if (!cancelled) {
          setRevisions(((json as any)?.revisions ?? []) as TicketRevisionEntry[]);
        }
      } catch (err) {
        console.error("Revisions fetch error:", err);
        if (!cancelled) setRevisionsError("Unexpected error while loading revisions.");
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
          const msg = json?.error || "We couldn't update this request. Please try again.";
          setStatusError(typeof msg === "string" ? msg : String(msg));
          return;
        }
        // Prompt for a rating when the customer marks the ticket DONE. The
        // modal is skippable, so closing or dismissing it leaves the ticket
        // in DONE state with no rating attached.
        if (newStatus === "DONE" && ticket?.isAssigned) {
          setShowRatingModal(true);
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
    // The description editor lives on the brief tab.
    setTab("brief");
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
      const res = await fetch(`/api/customer/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setCommentsError(json?.error || `Request failed with status ${res.status}`);
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
      const accepted = incoming.filter((f) => isBriefMimeAllowed(f.type));
      if (accepted.length === 0) {
        setBriefAssetsError(`Unsupported file type. Allowed: ${BRIEF_ACCEPTED_LABEL}.`);
        return;
      }
      setUploadingBriefs(true);
      setUploadProgressText("Preparing uploads...");
      setBriefAssetsError(null);
      let failed = 0;
      for (let i = 0; i < accepted.length; i += 1) {
        const file = accepted[i];
        try {
          setUploadProgressText(`Uploading ${i + 1} of ${accepted.length}...`);
          const dims = await getImageDimensions(file);

          const body = new FormData();
          body.append("file", file);
          body.append("ticketId", ticketId);
          body.append("kind", "BRIEF_INPUT");
          if (dims?.width) body.append("width", String(dims.width));
          if (dims?.height) body.append("height", String(dims.height));

          const res = await fetch("/api/uploads/r2/upload", {
            method: "POST",
            body,
          });
          if (!res.ok) {
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
        setBriefAssetsError(`Some uploads failed (${failed}). You can try again.`);
      }
    },
    [ticketId, loadBriefAssets],
  );

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (state.status === "loading") {
    return <DetailSkeleton label="Loading request" />;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const backHref = fromBoard ? "/customer/board" : "/customer/tickets";
  const backLabel = fromBoard ? "Back to board" : "Back to requests";

  if (error || !ticket) {
    return (
      <>
        <BackLink href={backHref}>{backLabel}</BackLink>
        {error ? (
          <Callout tone="error" title="We couldn't load this request">
            {error}
          </Callout>
        ) : (
          <Callout tone="warning" title="Request could not be loaded" />
        )}
      </>
    );
  }

  const newestFirst: TicketVersion[] = revisions ? [...revisions].reverse() : [];
  const latest = newestFirst[0] ?? null;
  const pinMode = ticket.status === "IN_REVIEW" ? "review" : "view";
  const showCurrentTab =
    ticket.status !== "TODO" &&
    (revisions === null || revisions.length > 0 || ticket.creativeMode === "AI");
  const activeTab: DetailTab =
    tab && (tab !== "current" || showCurrentTab) ? tab : showCurrentTab ? "current" : "brief";
  const versionsLoading = ticket.status !== "TODO" && revisions === null && !revisionsError;
  const inReview = ticket.status === "IN_REVIEW";
  const canRequestChanges = !!normalizedRole && canEditTickets(normalizedRole);
  const canApprove = !!normalizedRole && userCanMarkDone;
  const versionCopy = { feedbackLabel: "Your feedback" };
  const dueCountdown = ticket.status === "DONE" ? null : formatDueDateCountdown(ticket.dueDate);
  const openCompare = () => setShowCompare(true);

  const versionsFeedback = revisionsError ? (
    <Callout tone="error" title="We couldn't load the versions">
      {revisionsError}
    </Callout>
  ) : versionsLoading || (revisionsLoading && !revisions) ? (
    <div aria-busy="true" aria-label="Loading versions" className="space-y-3">
      <Skeleton className="h-64" />
      <Skeleton className="h-16" />
    </div>
  ) : null;

  const noVersions = (
    <Card>
      <EmptyState
        title="No versions yet"
        description="Once your creative sends this request for review, you'll see each version and your feedback here."
      />
    </Card>
  );

  const tabs: { value: DetailTab; label: string }[] = [
    ...(showCurrentTab ? [{ value: "current" as const, label: "Current version" }] : []),
    { value: "brief", label: "Brief & files" },
    {
      value: "versions",
      label: revisions && revisions.length > 0 ? `Versions (${revisions.length})` : "Versions",
    },
    { value: "comments", label: comments ? `Comments (${comments.length})` : "Comments" },
    { value: "activity", label: "Activity" },
  ];

  return (
    <>
      <BackLink href={backHref}>{backLabel}</BackLink>

      <TicketHeader
        code={ticket.code}
        title={
          editing ? (
            <TextInput
              aria-label="Request title"
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              disabled={editSaving}
              className="!text-base font-semibold"
            />
          ) : (
            <TicketTitle>{ticket.title}</TicketTitle>
          )
        }
        badges={
          <>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </>
        }
        actions={
          editing ? (
            <>
              <Button variant="primary" onClick={saveEdits} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save changes"}
              </Button>
              <Button onClick={cancelEditing} disabled={editSaving}>
                Cancel
              </Button>
            </>
          ) : userCanEdit || userCanCancel ? (
            <>
              {userCanEdit ? <Button onClick={startEditing}>Edit request</Button> : null}
              {userCanCancel ? (
                <Button variant="danger" onClick={() => setCancelOpen(true)}>
                  Cancel & refund
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      <div className="space-y-6">
        {statusError ? (
          <Callout tone="error" title="Status update failed">
            {statusError}
          </Callout>
        ) : null}

        {inReview ? (
          <section className="flex items-start gap-4 rounded-2xl border border-[var(--av2-attention-border)] bg-gradient-to-r from-[var(--av2-attention-from)] to-[var(--av2-attention-to)] p-5">
            <IconTile tone="peach" round size={44}>
              <IconClock />
            </IconTile>
            <div className="min-w-0">
              <h2 className="text-xl leading-7 font-semibold">Ready for your review</h2>
              <p className="text-sm">
                {normalizedRole && !canRequestChanges && !canApprove
                  ? "The creative's work is below, waiting for your team's decision."
                  : "Review the creative's work below, then approve it or request a revision."}
              </p>
            </div>
          </section>
        ) : null}

        {ticket.status === "DONE" && ticket.completedAt ? (
          <Callout tone="success" title="Approved">
            {ticket.completedBy?.name || ticket.completedBy?.email || "Customer"} marked this as
            complete on {formatBoardDate(ticket.completedAt)}.
          </Callout>
        ) : null}

        <Tabs
          label="Request sections"
          idPrefix={TAB_PREFIX}
          tabs={tabs}
          value={activeTab}
          onChange={setTab}
        />

        <DetailColumns
          rail={
            <>
              <Card>
                <h2 className="mb-4 text-xl leading-7 font-semibold">Details</h2>
                {editing ? (
                  <div className="space-y-4">
                    <Field label="Priority" htmlFor="edit-priority">
                      <Select
                        id="edit-priority"
                        value={editForm.priority}
                        onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                        disabled={editSaving}
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </Select>
                    </Field>
                    <Field label="Project" htmlFor="edit-project">
                      <Select
                        id="edit-project"
                        value={editForm.projectId}
                        onChange={(e) => setEditForm((f) => ({ ...f, projectId: e.target.value }))}
                        disabled={editSaving || !editMeta}
                      >
                        <option value="">No specific project</option>
                        {(editMeta?.projects ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.code ? ` (${p.code})` : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Job type" htmlFor="edit-job-type">
                      <Select
                        id="edit-job-type"
                        value={editForm.jobTypeId}
                        onChange={(e) => setEditForm((f) => ({ ...f, jobTypeId: e.target.value }))}
                        disabled={editSaving || !editMeta}
                      >
                        <option value="">Choose a job type</option>
                        {(editMeta?.jobTypes ?? []).map((jt) => (
                          <option key={jt.id} value={jt.id}>
                            {jt.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {editMeta?.tagsEnabled === false ? null : (
                      <Field label="Tags">
                        <TagMultiSelect
                          availableTags={(editMeta?.tags ?? []) as TagOption[]}
                          selectedTagIds={editForm.tagIds}
                          onChange={(tagIds) => setEditForm((f) => ({ ...f, tagIds }))}
                          onCreateTag={async (name, color) => {
                            try {
                              const res = await fetch("/api/customer/tags", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name, color }),
                              });
                              const json = await res.json().catch(() => null);
                              if (!res.ok) {
                                setEditError(json?.error || "Failed to create tag");
                                return null;
                              }
                              const created = json.tag as TagOption;
                              setEditMeta((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      tags: [...(prev.tags ?? []), created].sort((a, b) =>
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
                      </Field>
                    )}
                    <Field label="Due date" htmlFor="edit-due-date">
                      <TextInput
                        id="edit-due-date"
                        type="date"
                        className="dark:[color-scheme:dark]"
                        value={editForm.dueDate}
                        onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))}
                        disabled={editSaving}
                      />
                    </Field>
                  </div>
                ) : (
                  <KeyValueList
                    rows={[
                      { label: "Status", value: <StatusBadge status={ticket.status} /> },
                      { label: "Priority", value: <PriorityBadge priority={ticket.priority} /> },
                      { label: "Project", value: ticket.project?.name || DASH },
                      { label: "Job type", value: ticket.jobType?.name || DASH },
                      ...(ticket.effectiveCost != null
                        ? [
                            {
                              label: "Token cost",
                              value: (
                                <>
                                  {ticket.quantity > 1 && ticket.jobType
                                    ? `${ticket.jobType.tokenCost} × ${ticket.quantity} = ${tokenCount(ticket.effectiveCost)}`
                                    : tokenCount(ticket.effectiveCost)}
                                  {ticket.tokenCostOverride != null ? (
                                    <span className="block text-xs font-normal text-[var(--av2-text-2)]">
                                      Admin override applied
                                    </span>
                                  ) : null}
                                </>
                              ),
                            },
                          ]
                        : []),
                      ...(ticket.quantity > 1
                        ? [{ label: "Quantity", value: `×${ticket.quantity}` }]
                        : []),
                      {
                        label: "Due date",
                        value: (
                          <>
                            <span
                              className={
                                dueCountdown?.overdue ? "text-[var(--av2-error-text)]" : undefined
                              }
                            >
                              {formatBoardDate(ticket.dueDate)}
                            </span>
                            {dueCountdown ? (
                              <span
                                className={`block text-xs font-normal ${
                                  dueCountdown.overdue
                                    ? "text-[var(--av2-error-text)]"
                                    : "text-[var(--av2-text-2)]"
                                }`}
                              >
                                {dueCountdown.label}
                              </span>
                            ) : null}
                          </>
                        ),
                      },
                      ...(ticket.tags && ticket.tags.length > 0
                        ? [
                            {
                              label: "Tags",
                              value: (
                                <span className="flex flex-wrap gap-1">
                                  {ticket.tags.map((tag) => (
                                    <TagBadge
                                      key={tag.id}
                                      name={tag.name}
                                      color={tag.color as TagColorKey}
                                    />
                                  ))}
                                </span>
                              ),
                            },
                          ]
                        : []),
                      { label: "Created", value: formatBoardDate(ticket.createdAt) },
                      { label: "Updated", value: formatBoardDate(ticket.updatedAt) },
                    ]}
                  />
                )}

                {ticket.moodboards && ticket.moodboards.length > 0 ? (
                  <div className="mt-4 border-t border-[var(--av2-border)] pt-4">
                    <p className="mb-2 text-sm text-[var(--av2-text-2)]">Moodboards</p>
                    <ul className="space-y-2">
                      {ticket.moodboards.map((mb) => (
                        <li key={mb.id}>
                          <Link
                            href={`/customer/moodboards/${mb.id}`}
                            className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[var(--av2-border)] px-3 py-2 text-sm hover:bg-[var(--av2-bg)]"
                          >
                            <span className="truncate font-medium">{mb.title}</span>
                            <span className="shrink-0 text-xs text-[var(--av2-text-2)]">
                              {mb.itemCount} {plural(mb.itemCount, "item", "items")}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>

              <Card>
                <h2 className="mb-4 text-xl leading-7 font-semibold">People</h2>
                <div className="space-y-4">
                  <PersonRow
                    name={ticket.createdBy?.name || ticket.createdBy?.email || DASH}
                    role="Requester"
                  />
                  <PersonRow
                    name="Creative team"
                    role={ticket.isAssigned ? "Assigned" : "Unassigned"}
                    assigned={ticket.isAssigned}
                  />
                </div>
              </Card>
            </>
          }
        >
          {activeTab === "current" ? (
            <TabPanel idPrefix={TAB_PREFIX} value="current">
              <div className="space-y-4">
                {ticket.creativeMode === "AI" ? (
                  <Card>
                    <AiTicketControls
                      ticketId={ticket.id}
                      ticketStatus={ticket.status}
                      hasRevisions={!!revisions && revisions.length > 0}
                      onGenerated={() => {
                        // Refresh revisions and ticket data
                        setRevisionsLoading(true);
                        fetch(`/api/customer/tickets/${ticket.id}/revisions`, { cache: "no-store" })
                          .then((r) => r.json())
                          .then((d) => setRevisions(d?.revisions ?? []))
                          .catch(() => {})
                          .finally(() => setRevisionsLoading(false));
                        setRefreshCounter((c) => c + 1);
                      }}
                    />
                  </Card>
                ) : null}

                {versionsFeedback ??
                  (latest ? (
                    <>
                      <CurrentVersionCard
                        version={latest}
                        pinMode={pinMode}
                        ticketId={ticket.id}
                        zipFilename={`revision-v${latest.version}.zip`}
                        onRevisionSubmitted={handlePinsSubmitted}
                        copy={versionCopy}
                      />
                      {newestFirst.length > 1 ? (
                        <>
                          <VersionsHeading
                            title="Previous versions"
                            count={newestFirst.length}
                            onCompare={openCompare}
                          />
                          {newestFirst.slice(1).map((rev) => (
                            <CollapsedVersion
                              key={rev.version}
                              version={rev}
                              pinMode={pinMode}
                              ticketId={ticket.id}
                              zipFilename={`revision-v${rev.version}.zip`}
                              onRevisionSubmitted={handlePinsSubmitted}
                              copy={versionCopy}
                            />
                          ))}
                        </>
                      ) : null}
                    </>
                  ) : (
                    noVersions
                  ))}
              </div>
            </TabPanel>
          ) : null}

          {activeTab === "brief" ? (
            <TabPanel idPrefix={TAB_PREFIX} value="brief">
              <div className="space-y-4">
                <Card>
                  <h2 className="text-xl leading-7 font-semibold">Brief</h2>
                  {editing ? (
                    <div className="mt-3">
                      <RichTextEditor
                        value={editForm.description}
                        onChange={(html) => setEditForm((f) => ({ ...f, description: html }))}
                        disabled={editSaving}
                        minHeight="120px"
                      />
                    </div>
                  ) : ticket.description ? (
                    <SafeHtml html={ticket.description} className="mt-2 text-base" />
                  ) : (
                    <p className="mt-2 text-sm text-[var(--av2-text-2)]">
                      No description was provided for this request.
                    </p>
                  )}

                  {editError ? (
                    <div className="mt-3">
                      <Callout tone="error" title="Changes weren't saved">
                        {editError}
                      </Callout>
                    </div>
                  ) : null}

                  <div className="mt-6 border-t border-[var(--av2-border)] pt-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <Eyebrow>
                        Brief attachments
                        {briefAssetEntries.length > 0 ? ` (${briefAssetEntries.length})` : ""}
                      </Eyebrow>
                      <div className="flex flex-wrap items-center gap-2">
                        {ticket.status === "TODO" ? (
                          <>
                            <input
                              ref={briefInputRef}
                              type="file"
                              aria-label="Add brief files"
                              accept={BRIEF_ACCEPT_ATTR}
                              multiple
                              hidden
                              disabled={uploadingBriefs}
                              onChange={(e) => {
                                void handleUploadBriefFiles(e.target.files);
                                e.currentTarget.value = "";
                              }}
                            />
                            <Button
                              disabled={uploadingBriefs}
                              onClick={() => briefInputRef.current?.click()}
                            >
                              Add files
                            </Button>
                          </>
                        ) : null}
                        <DownloadFilesButton
                          assets={briefAssetEntries}
                          zipFilename="brief-attachments.zip"
                        />
                      </div>
                    </div>

                    {uploadProgressText ? (
                      <p role="status" className="mb-3 text-sm text-[var(--av2-text-2)]">
                        {uploadProgressText}
                      </p>
                    ) : null}

                    {briefAssetsError ? (
                      <div className="mb-3">
                        <Callout tone="error" title="Attachments">
                          {briefAssetsError}
                        </Callout>
                      </div>
                    ) : null}

                    {briefAssetsLoading ? (
                      <Skeleton className="h-44" />
                    ) : briefAssetEntries.length > 0 ? (
                      <FilePreviews assets={briefAssetEntries} />
                    ) : briefAssetsError ? null : (
                      <p className="text-sm text-[var(--av2-text-2)]">
                        No attachments yet.
                        {ticket.status === "TODO"
                          ? ` Add reference files (${BRIEF_ACCEPTED_LABEL}) to help your creative.`
                          : ""}
                      </p>
                    )}
                  </div>
                </Card>

                {ticket.status === "TODO" ? (
                  <Callout tone="info" title="Handoff">
                    Waiting for creative work to begin.
                  </Callout>
                ) : null}
              </div>
            </TabPanel>
          ) : null}

          {activeTab === "versions" ? (
            <TabPanel idPrefix={TAB_PREFIX} value="versions">
              {ticket.status === "TODO" ? (
                noVersions
              ) : (
                <div className="space-y-4">
                  {versionsFeedback ??
                    (newestFirst.length === 0 ? (
                      noVersions
                    ) : (
                      <>
                        <VersionsHeading
                          title="All versions"
                          count={newestFirst.length}
                          onCompare={openCompare}
                        />
                        {newestFirst.map((rev, i) => (
                          <CollapsedVersion
                            key={rev.version}
                            version={rev}
                            isCurrent={i === 0}
                            pinMode={pinMode}
                            ticketId={ticket.id}
                            zipFilename={`revision-v${rev.version}.zip`}
                            onRevisionSubmitted={handlePinsSubmitted}
                            copy={versionCopy}
                          />
                        ))}
                      </>
                    ))}
                </div>
              )}
            </TabPanel>
          ) : null}

          {activeTab === "comments" ? (
            <TabPanel idPrefix={TAB_PREFIX} value="comments">
              <CommentsPanel
                comments={comments}
                loading={commentsLoading}
                error={commentsError}
                value={newComment}
                onChange={setNewComment}
                onSubmit={handleSubmitComment}
                submitting={submittingComment}
                placeholder="Share feedback, clarifications, or next steps for this request."
                visibilityNote="Comments are visible to your team and brandbite creatives."
                emptyDescription="Use the form below to start a thread with your team and the creative."
              />
            </TabPanel>
          ) : null}

          {activeTab === "activity" ? (
            <TabPanel idPrefix={TAB_PREFIX} value="activity">
              <TicketActivityPanel url={`/api/customer/tickets/${ticket.id}/activity`} />
            </TabPanel>
          ) : null}
        </DetailColumns>

        {/* Review actions stay in view however long the content gets. */}
        {inReview ? (
          <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-3 sm:gap-3 sm:p-4">
            {normalizedRole && !canRequestChanges && !canApprove ? (
              <p className="min-w-0 flex-1 text-sm text-[var(--av2-text-2)]">
                Your role can view this review, but can&apos;t approve it or request a revision.
              </p>
            ) : null}
            {/* Phones: the version card has its own download; keep the two decisions in one row. */}
            {latest ? (
              <span className="max-sm:hidden">
                <DownloadFilesButton
                  assets={versionAssets(latest)}
                  zipFilename={`revision-v${latest.version}.zip`}
                />
              </span>
            ) : null}
            {canRequestChanges ? (
              <Button
                className="max-sm:flex-1 max-sm:!px-2"
                onClick={() => setShowRevisionModal(true)}
                disabled={statusSaving}
              >
                Request revision
              </Button>
            ) : null}
            {canApprove ? (
              <Button
                variant="primary"
                className="max-sm:flex-1 max-sm:!px-2"
                onClick={() => setShowDoneModal(true)}
                disabled={statusSaving}
              >
                Approve & complete
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ================================================================= */}
      {/* Request revision modal                                            */}
      {/* ================================================================= */}
      <Modal open={showRevisionModal} onClose={handleCancelRevision} size="md">
        <ModalHeader
          title="Send this request back to your creative?"
          subtitle="Your creative will see your message and continue working on this request. The status will move back to In progress."
        />

        <Field
          label="Message for your creative"
          htmlFor="revision-message"
          error={revisionMessageError}
        >
          <TextArea
            id="revision-message"
            value={revisionMessage}
            aria-invalid={!!revisionMessageError}
            onChange={(e) => {
              setRevisionMessage(e.target.value);
              if (revisionMessageError) setRevisionMessageError(null);
            }}
            placeholder="For example: Could we make the hero headline larger and try a version with a darker background?"
            className="h-28"
          />
        </Field>

        <ModalFooter>
          <Button onClick={handleCancelRevision} disabled={statusSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirmRevision} disabled={statusSaving}>
            {statusSaving ? "Sending…" : "Send back to creative"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ================================================================= */}
      {/* Approve modal                                                     */}
      {/* ================================================================= */}
      <Modal open={showDoneModal} onClose={() => setShowDoneModal(false)} size="md" scrollable>
        <ModalHeader
          title="Approve and complete this request?"
          subtitle="Once you approve this request, your creative will get paid for this job, and it will move to Done."
        />

        <div className="rounded-xl bg-[var(--av2-bg)] p-3 text-sm">
          <p className="font-semibold">{ticket.title}</p>
          {ticket.project?.name ? (
            <p className="mt-1 text-[var(--av2-text-2)]">Project: {ticket.project.name}</p>
          ) : null}
          {ticket.jobType?.name ? (
            <p className="mt-0.5 text-[var(--av2-text-2)]">Job type: {ticket.jobType.name}</p>
          ) : null}
        </div>

        {latest && latest.assets.length > 0 ? (
          <div className="mt-3">
            <p className="mb-2 text-sm font-semibold">
              Final work{" "}
              <span className="font-normal text-[var(--av2-text-2)]">
                Version {latest.version}, {latest.assets.length}{" "}
                {plural(latest.assets.length, "file", "files")}
              </span>
            </p>
            <FilePreviews assets={versionAssets(latest)} />
          </div>
        ) : null}

        <ModalFooter>
          <Button onClick={() => setShowDoneModal(false)} disabled={statusSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirmDone} disabled={statusSaving}>
            {statusSaving ? "Approving…" : "Approve & complete"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Cancel-with-refund confirmation. Server enforces OWNER/PM + TODO
          + unassigned; UI just gates the entry point and surfaces any
          server error inline (e.g. lost race with auto-assign). */}
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => {
          if (!cancelling) {
            setCancelOpen(false);
            setCancelError(null);
          }
        }}
        onConfirm={handleCancel}
        title="Cancel this ticket?"
        description={
          cancelError
            ? cancelError
            : "The ticket will be removed from your board and the full token cost will be refunded to your company. Brief uploads stay on file. This can't be undone."
        }
        confirmLabel="Cancel & refund"
        loading={cancelling}
      />

      {/* Revision comparison overlay */}
      {showCompare && revisions && revisions.length >= 2 && (
        <RevisionCompare
          revisions={revisions.map((r) => ({
            version: r.version,
            submittedAt: r.submittedAt,
            assets: r.assets.map((a) => ({
              id: a.id,
              url: a.url,
              originalName: a.originalName,
              pinCount: a.pinCount,
            })),
          }))}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* Creative rating modal — opens when the customer marks the ticket DONE */}
      <RateCreativeModal
        open={showRatingModal}
        ticketId={ticket.id}
        ticketTitle={ticket.title}
        onClose={() => setShowRatingModal(false)}
      />
    </>
  );
}
