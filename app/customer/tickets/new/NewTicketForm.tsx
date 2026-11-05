// -----------------------------------------------------------------------------
// @file: app/customer/tickets/new/NewTicketForm.tsx
// @purpose: Client-side form for creating a new design ticket (role-aware)
// @version: v1.6.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Button,
  Callout,
  Card,
  DASH,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/admin/v2/ui";
import { tokenCount } from "@/components/dashboard/tickets/shared";
import { createTicketSchema } from "@/lib/schemas/ticket.schemas";
import {
  type CompanyRole,
  normalizeCompanyRole,
  canCreateTickets,
  isBillingReadOnly,
} from "@/lib/permissions/companyRoles";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { DraftAttachment, TicketDraftClient } from "@/lib/ticket-drafts";
import { TagMultiSelect, type TagOption } from "@/components/ui/tag-multi-select";
import { JobTypePicker } from "@/components/ui/job-type-picker";
import {
  InsufficientTokensModal,
  type InsufficientTokensInfo,
} from "@/components/tokens/insufficient-tokens-modal";
import { isInsufficientTokensBody } from "@/lib/errors/insufficient-tokens";
import type { TagColorKey } from "@/lib/tag-colors";
import { canManageTags as canManageTagsCheck } from "@/lib/permissions/companyRoles";
import {
  BRIEF_ACCEPT_ATTR,
  BRIEF_ACCEPTED_LABEL,
  isBriefMimeAllowed,
  MAX_UPLOAD_LABEL,
  readUploadError,
  validateFileSize,
} from "@/lib/upload-helpers";

type ProjectOption = {
  id: string;
  name: string;
  code: string | null;
};

type JobTypeOption = {
  id: string;
  name: string;
  category: string | null;
  categorySortOrder?: number;
  description: string | null;
  tokenCost?: number;
  hasQuantity?: boolean;
  quantityLabel?: string | null;
  defaultQuantity?: number;
};

type MoodboardOption = {
  id: string;
  title: string;
  itemCount: number;
};

type Props = {
  companySlug: string;
  projects: ProjectOption[];
  jobTypes: JobTypeOption[];
  tokenBalance?: number;
  tags?: TagOption[];
  canCreateTags?: boolean;
  onTagCreated?: (tag: TagOption) => void;
  redirectTo?: string;
  onCreated?: (ticket: { id: string; code?: string | null }) => void;
  onCancel?: () => void;
  initialJobTypeId?: string;
  /** Whether "Work with AI" mode is available (AI_TICKETS_MODE flag). When
   *  false, the mode selector is hidden and tickets are always DESIGNER. */
  aiEnabled?: boolean;
  /** A saved draft to carry on with. */
  initialDraft?: TicketDraftClient | null;
  /** Tells a parent which draft this form is saving to. */
  onDraftChange?: (draftId: string) => void;
  /** Lets a parent dialog ask before closing. Resolves true when it's safe to close. */
  closeGuardRef?: MutableRefObject<(() => Promise<boolean>) | null>;
};

/** How long typing has to pause before the draft saves itself. */
const AUTOSAVE_DELAY_MS = 3000;

type TicketPriorityValue = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const PRIORITY_OPTIONS: {
  value: TicketPriorityValue;
  label: string;
  helper: string;
}[] = [
  {
    value: "LOW",
    label: "Low",
    helper: "Nice to have, flexible timing.",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    helper: "Normal priority, default for most requests.",
  },
  {
    value: "HIGH",
    label: "High",
    helper: "Important, should be picked up soon.",
  },
  {
    value: "URGENT",
    label: "Urgent",
    helper: "Time-sensitive, jumps to the front of the queue.",
  },
];

type PendingBriefFile = {
  id: string;
  file: File;
};

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

function hasText(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim().length > 0
  );
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  // Only attempt for images
  if (!file.type.startsWith("image/")) return null;

  return await new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const w = Number(img.naturalWidth) || 0;
      const h = Number(img.naturalHeight) || 0;
      URL.revokeObjectURL(url);

      if (w > 0 && h > 0) {
        resolve({ width: w, height: h });
      } else {
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

export default function NewTicketForm({
  companySlug,
  projects,
  jobTypes,
  tokenBalance,
  tags: tagsProp,
  canCreateTags: canCreateTagsProp,
  onTagCreated,
  redirectTo,
  onCreated,
  onCancel,
  initialJobTypeId,
  aiEnabled = false,
  initialDraft = null,
  onDraftChange,
  closeGuardRef,
}: Props) {
  const router = useRouter();
  const ids = useId();
  const briefInputRef = useRef<HTMLInputElement>(null);

  // A draft isn't checked against the catalog when it's saved, so anything that
  // has since been removed falls back to empty here instead of failing on submit.
  const [creativeMode, setCreativeMode] = useState<"DESIGNER" | "AI">(
    aiEnabled && initialDraft?.creativeMode === "AI" ? "AI" : "DESIGNER",
  );
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [description, setDescription] = useState(initialDraft?.description ?? "");
  const [projectId, setProjectId] = useState<string>(
    projects.some((p) => p.id === initialDraft?.projectId) ? initialDraft!.projectId : "",
  );
  const [jobTypeId, setJobTypeId] = useState<string>(
    initialDraft
      ? jobTypes.some((j) => j.id === initialDraft.jobTypeId)
        ? initialDraft.jobTypeId
        : ""
      : (initialJobTypeId ?? ""),
  );
  const [priority, setPriority] = useState<TicketPriorityValue>(
    PRIORITY_OPTIONS.find((o) => o.value === initialDraft?.priority)?.value ?? "MEDIUM",
  );
  const [dueDate, setDueDate] = useState<string>(initialDraft?.dueDate ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    (initialDraft?.tagIds ?? []).filter((id) => (tagsProp ?? []).some((t) => t.id === id)),
  );
  const [localTags, setLocalTags] = useState<TagOption[]>(tagsProp ?? []);
  const [moodboardId, setMoodboardId] = useState<string>(initialDraft?.moodboardId ?? "");
  const [moodboards, setMoodboards] = useState<MoodboardOption[]>([]);

  // Sync when tags prop changes (e.g. after parent re-fetches)
  useEffect(() => {
    if (tagsProp) setLocalTags(tagsProp);
  }, [tagsProp]);

  // Load moodboards for the "Attach moodboard" dropdown
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/moodboards");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json.moodboards)) {
          setMoodboards(
            json.moodboards
              .filter((mb: any) => !mb.isCreativeBoard)
              .map((mb: any) => ({
                id: mb.id,
                title: mb.title,
                itemCount: mb._count?.items ?? 0,
              })),
          );
        }
      } catch {
        // Moodboards are optional — silently ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Quantity multiplier (1–10), reset when job type changes
  const initialQty = initialJobTypeId
    ? (jobTypes.find((j) => j.id === initialJobTypeId)?.defaultQuantity ?? 1)
    : 1;
  const [quantity, setQuantity] = useState(initialDraft?.quantity ?? initialQty);

  const handleJobTypeChange = (id: string) => {
    setJobTypeId(id);
    const jt = jobTypes.find((j) => j.id === id);
    setQuantity(jt?.defaultQuantity ?? 1);
  };

  // Derive selected job type for token cost display
  const selectedJobType = useMemo(
    () => (jobTypeId ? (jobTypes.find((jt) => jt.id === jobTypeId) ?? null) : null),
    [jobTypeId, jobTypes],
  );

  // Effective cost = unit cost × quantity
  const effectiveCost =
    selectedJobType?.tokenCost != null ? selectedJobType.tokenCost * quantity : null;

  // True when a job type is selected and its cost exceeds the company balance
  const insufficientTokens =
    tokenBalance != null && effectiveCost != null && tokenBalance < effectiveCost;

  // Due date constraints: today → 2 years from now (YYYY-MM-DD format)
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  const maxDateStr = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().split("T")[0];
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [uploadingBriefs, setUploadingBriefs] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  // Per-file error messages from the brief upload pass. Surfaced inline
  // after the upload-loop returns so the user knows *which* files failed
  // and *why* (e.g. "logo.png is 6.2 MB. The current upload limit is
  // 4 MB."). Cleared on the next upload attempt.
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<InsufficientTokensInfo | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- AI brief parsing ---
  const [briefText, setBriefText] = useState("");
  const [briefParsing, setBriefParsing] = useState(false);
  const [briefHint, setBriefHint] = useState<string | null>(null);
  // AI assist drawer state — the AI brief textarea used to be its own
  // banner block above the form. It's now an opt-in drawer inside the
  // Brief section so the customer reads "Brief" as a single concept.
  const [briefAiOpen, setBriefAiOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Company role (for limited access / billing-only users)
  // ---------------------------------------------------------------------------

  const [companyRole, setCompanyRole] = useState<CompanyRole | null>(null);
  const [companyRoleLoading, setCompanyRoleLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const loadRole = async () => {
      try {
        const res = await fetch("/api/customer/settings", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          return;
        }

        if (!cancelled) {
          const role = normalizeCompanyRole(json?.user?.companyRole ?? null);
          setCompanyRole(role);
        }
      } catch (err) {
        console.error("[NewTicketForm] Failed to load company role from settings endpoint", err);
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

  const isLimitedAccess = companyRole !== null && isBillingReadOnly(companyRole);

  // ---------------------------------------------------------------------------
  // Brief uploads (selected locally, uploaded after ticket creation)
  // ---------------------------------------------------------------------------

  const [briefFiles, setBriefFilesState] = useState<PendingBriefFile[]>([]);
  // Files already stored with the draft.
  const [savedFiles, setSavedFilesState] = useState<DraftAttachment[]>(
    initialDraft?.attachments ?? [],
  );
  // Saving runs across awaits, so it reads the current lists from these.
  const briefFilesRef = useRef<PendingBriefFile[]>([]);
  const savedFilesRef = useRef<DraftAttachment[]>(initialDraft?.attachments ?? []);

  const setBriefFiles = (next: PendingBriefFile[]) => {
    briefFilesRef.current = next;
    setBriefFilesState(next);
  };
  const setSavedFiles = (next: DraftAttachment[]) => {
    savedFilesRef.current = next;
    setSavedFilesState(next);
  };

  const totalBriefBytes = useMemo(() => {
    return (
      briefFiles.reduce((sum, f) => sum + (f.file.size ?? 0), 0) +
      savedFiles.reduce((sum, f) => sum + f.bytes, 0)
    );
  }, [briefFiles, savedFiles]);

  const maxBriefFiles = 8;

  const attachedCount = briefFiles.length + savedFiles.length;
  const canAddMoreBriefs = attachedCount < maxBriefFiles;

  const handleAddBriefFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    setSuccessMessage(null);

    const incoming = Array.from(files);
    const rejections: string[] = [];

    // Validate BOTH type and size at pick time (not just at submit), and
    // accept every type the server allows — images, PDF, DOC, DOCX, TXT — so
    // the picker, this filter, and the API agree. Previously this rejected all
    // non-images (PDFs silently dropped) and never size-checked here, so an
    // oversized file was only rejected after the ticket was already created.
    const accepted = incoming.filter((f) => {
      if (!isBriefMimeAllowed(f.type)) {
        rejections.push(`${f.name}: unsupported type. Accepts ${BRIEF_ACCEPTED_LABEL}.`);
        return false;
      }
      const sizeErr = validateFileSize(f);
      if (sizeErr) {
        rejections.push(sizeErr);
        return false;
      }
      return true;
    });

    const prev = briefFilesRef.current;
    const room = Math.max(0, maxBriefFiles - prev.length - savedFilesRef.current.length);
    const next = accepted.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      file,
    }));

    if (accepted.length > room) {
      rejections.push(`You can attach up to ${maxBriefFiles} files — some were not added.`);
    }

    setBriefFiles([...prev, ...next]);

    // Persistent, per-file reasons (cleared on the next successful add or upload).
    setUploadErrors(rejections);
  };

  const handleRemoveBriefFile = (id: string) => {
    setBriefFiles(briefFilesRef.current.filter((x) => x.id !== id));
  };

  const handleRemoveSavedFile = async (attachment: DraftAttachment) => {
    setSavedFiles(savedFilesRef.current.filter((x) => x.id !== attachment.id));
    try {
      const res = await fetch(
        `/api/customer/ticket-drafts/${draftIdRef.current}/attachments/${attachment.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    } catch (err) {
      console.error("[NewTicketForm] Removing a draft file failed", err);
      setSavedFiles([...savedFilesRef.current, attachment]);
      setUploadErrors([`${attachment.originalName ?? "That file"} couldn't be removed.`]);
    }
  };

  async function uploadBriefsForTicket(ticketId: string): Promise<{
    attempted: number;
    succeeded: number;
    failed: number;
  }> {
    // Files a draft already holds move over on the server; these are the rest.
    const briefFiles = briefFilesRef.current;
    if (briefFiles.length === 0) {
      return { attempted: 0, succeeded: 0, failed: 0 };
    }

    setUploadingBriefs(true);
    setUploadProgressText("Preparing uploads...");
    setUploadErrors([]);

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    // Sequential uploads keep it predictable (and easier to debug)
    for (let i = 0; i < briefFiles.length; i += 1) {
      const entry = briefFiles[i];
      const file = entry.file;

      // Pre-validate against the platform body-size cap. Catches the
      // failure here rather than after a wasted round-trip — Vercel
      // would otherwise reject the request body before our route runs
      // and we'd see a generic platform error with no body to read.
      const sizeErr = validateFileSize(file);
      if (sizeErr) {
        failed += 1;
        errors.push(sizeErr);
        continue;
      }

      try {
        setUploadProgressText(`Uploading attachment ${i + 1} of ${briefFiles.length}...`);

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
          const message = await readUploadError(res);
          errors.push(`${file.name}: ${message}`);
          console.error("[NewTicketForm] Upload failed:", file.name, message);
          continue;
        }

        succeeded += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${file.name}: ${message}`);
        console.error("[NewTicketForm] Brief upload error:", err);
      }
    }

    setUploadProgressText(null);
    setUploadingBriefs(false);
    setUploadErrors(errors);

    return { attempted: briefFiles.length, succeeded, failed };
  }

  // ---------------------------------------------------------------------------
  // Drafts: saved by hand or after a pause in typing. Saves run one at a time so
  // the first one can't create two drafts.
  // ---------------------------------------------------------------------------

  const draftFields = useMemo(
    () => ({
      title,
      description,
      jobTypeId,
      projectId,
      quantity,
      priority,
      dueDate,
      tagIds: selectedTagIds,
      moodboardId,
      creativeMode,
    }),
    [
      title,
      description,
      jobTypeId,
      projectId,
      quantity,
      priority,
      dueDate,
      selectedTagIds,
      moodboardId,
      creativeMode,
    ],
  );
  const serializedFields = useMemo(() => JSON.stringify(draftFields), [draftFields]);

  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [savedFields, setSavedFields] = useState(serializedFields);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    initialDraft ? "saved" : "idle",
  );
  const [savedAt, setSavedAt] = useState<Date | null>(
    initialDraft ? new Date(initialDraft.updatedAt) : null,
  );
  const [leavePrompt, setLeavePrompt] = useState<((leave: boolean) => void) | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false);

  const draftIdRef = useRef<string | null>(initialDraft?.id ?? null);
  const savedFieldsRef = useRef(serializedFields);
  const latestFieldsRef = useRef(draftFields);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Nothing should save while the request is going out, or after it has.
  const submittingRef = useRef(false);
  const finishedRef = useRef(false);
  const leavePromptOpenRef = useRef(false);

  const canSaveDrafts =
    !companyRoleLoading &&
    !isLimitedAccess &&
    (companyRole === null || canCreateTickets(companyRole));

  const hasDraftContent =
    !!draftId ||
    !!title.trim() ||
    hasText(description) ||
    briefFiles.length > 0 ||
    savedFiles.length > 0;

  const needsSaving =
    canSaveDrafts && hasDraftContent && (serializedFields !== savedFields || briefFiles.length > 0);

  const needsSavingRef = useRef(needsSaving);

  useEffect(() => {
    latestFieldsRef.current = draftFields;
    needsSavingRef.current = needsSaving;
  });

  const createDraft = async (fields: typeof draftFields) => {
    const res = await fetch("/api/customer/ticket-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.draft?.id) throw new Error(json?.error || "Couldn't save the draft");

    draftIdRef.current = json.draft.id as string;
    setDraftId(json.draft.id);
    onDraftChange?.(json.draft.id);
    // On the full page, a reload carries on with this draft rather than starting over.
    if (!onCancel) {
      window.history.replaceState(
        window.history.state,
        "",
        `/customer/tickets/new?draft=${json.draft.id}`,
      );
    }
  };

  const runSave = async (): Promise<boolean> => {
    if (finishedRef.current) return true;

    const fields = latestFieldsRef.current;
    const serialized = JSON.stringify(fields);
    setSaveState("saving");

    try {
      if (!draftIdRef.current) {
        await createDraft(fields);
      } else if (serialized !== savedFieldsRef.current) {
        const res = await fetch(`/api/customer/ticket-drafts/${draftIdRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        if (res.status === 404) {
          // Deleted in another tab. What's on screen is still worth keeping.
          setSavedFiles([]);
          await createDraft(fields);
        } else if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
      }
      savedFieldsRef.current = serialized;
      setSavedFields(serialized);

      const errors: string[] = [];
      for (const entry of [...briefFilesRef.current]) {
        if (!briefFilesRef.current.some((x) => x.id === entry.id)) continue;

        const dims = await getImageDimensions(entry.file);
        const body = new FormData();
        body.append("file", entry.file);
        if (dims?.width) body.append("width", String(dims.width));
        if (dims?.height) body.append("height", String(dims.height));

        try {
          const res = await fetch(`/api/customer/ticket-drafts/${draftIdRef.current}/attachments`, {
            method: "POST",
            body,
          });
          if (!res.ok) {
            errors.push(`${entry.file.name}: ${await readUploadError(res)}`);
            continue;
          }
          const json = await res.json();
          setSavedFiles([...savedFilesRef.current, json.attachment]);
          setBriefFiles(briefFilesRef.current.filter((x) => x.id !== entry.id));
        } catch (err) {
          errors.push(
            `${entry.file.name}: ${err instanceof Error ? err.message : "Upload failed"}`,
          );
        }
      }
      setUploadErrors(errors);

      if (errors.length > 0) {
        setSaveState("error");
        return false;
      }
      setSavedAt(new Date());
      setSaveState("saved");
      return true;
    } catch (err) {
      console.error("[NewTicketForm] Saving the draft failed", err);
      setSaveState("error");
      return false;
    }
  };

  const saveDraft = (): Promise<boolean> => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    const run = saveQueueRef.current.then(runSave);
    saveQueueRef.current = run;
    return run;
  };

  const saveDraftRef = useRef(saveDraft);
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  });

  // Save after a pause in typing, or soon after a file is added. A failed save
  // waits for the next change rather than retrying in a loop.
  const pendingFileCount = briefFiles.length;
  useEffect(() => {
    if (!needsSavingRef.current || submitting) return;
    autosaveTimerRef.current = setTimeout(() => {
      if (!submittingRef.current) void saveDraftRef.current();
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [serializedFields, pendingFileCount, canSaveDrafts, submitting]);

  // Closing the tab can't wait for a save, so the browser asks.
  useEffect(() => {
    if (!needsSaving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [needsSaving]);

  // Following a link inside the app unmounts the form: save what's left on the way out.
  useEffect(() => {
    return () => {
      if (needsSavingRef.current && !finishedRef.current && !submittingRef.current) {
        void saveDraftRef.current();
      }
    };
  }, []);

  /** Resolves true when it's fine to leave: saved, or the person chose to go anyway. */
  const confirmLeave = async (): Promise<boolean> => {
    if (finishedRef.current || submittingRef.current) return true;
    // Escape reaches the dialog behind the prompt too; the prompt answers for both.
    if (leavePromptOpenRef.current) return false;
    const saved = needsSavingRef.current ? await saveDraft() : await saveQueueRef.current;
    if (saved) return true;

    leavePromptOpenRef.current = true;
    const leave = await new Promise<boolean>((resolve) => setLeavePrompt(() => resolve));
    leavePromptOpenRef.current = false;
    setLeavePrompt(null);
    if (leave) finishedRef.current = true;
    return leave;
  };

  const confirmLeaveRef = useRef(confirmLeave);
  useEffect(() => {
    confirmLeaveRef.current = confirmLeave;
  });
  const guard = useCallback(() => confirmLeaveRef.current(), []);

  useEffect(() => {
    if (!closeGuardRef) return;
    closeGuardRef.current = guard;
    return () => {
      closeGuardRef.current = null;
    };
  }, [closeGuardRef, guard]);

  // Saves first, so topping up can't cost anyone their brief, and hands the draft
  // to the billing page so it can bring them back.
  const handleTopUp = async () => {
    setError(null);
    if (!(await saveDraft())) {
      setError("We couldn't save your draft, so we've kept you here. Please try again.");
      return;
    }
    router.push(`/customer/settings?draft=${draftIdRef.current}`);
  };

  const handleDeleteDraft = async () => {
    setDeletingDraft(true);
    try {
      await saveQueueRef.current;
      const res = await fetch(`/api/customer/ticket-drafts/${draftIdRef.current}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) throw new Error(`Request failed: ${res.status}`);
      finishedRef.current = true;
      if (onCancel) onCancel();
      else router.push("/customer/tickets/drafts");
    } catch (err) {
      console.error("[NewTicketForm] Deleting the draft failed", err);
      setError("We couldn't delete this draft. Please try again.");
    } finally {
      setDeletingDraft(false);
      setConfirmingDelete(false);
    }
  };

  // ---------------------------------------------------------------------------
  // AI brief parsing — take the free-text brief, call the AI tool, pre-fill
  // the structured fields (title / description / jobTypeId / quantity /
  // priority). Customer can edit everything before submitting.
  // ---------------------------------------------------------------------------

  const handleParseBrief = async () => {
    if (briefText.trim().length < 10) {
      setBriefHint("Write at least 10 characters first — the AI needs something to work with.");
      return;
    }
    setBriefParsing(true);
    setBriefHint(null);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate/brief-parsing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: briefText }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 402 && isInsufficientTokensBody(json)) {
          setTokenError(json);
          return;
        }
        throw new Error(json?.error || `Parse failed (${res.status})`);
      }
      const parsed = json?.generation?.parsed as
        | {
            title: string;
            description: string;
            jobTypeId: string | null;
            quantity: number;
            priority: TicketPriorityValue;
          }
        | undefined;
      if (!parsed) throw new Error("The AI didn't return a usable result. Try rewording.");

      if (parsed.title) setTitle(parsed.title);
      if (parsed.description) setDescription(parsed.description);
      if (parsed.jobTypeId) setJobTypeId(parsed.jobTypeId);
      if (parsed.quantity && parsed.quantity > 0) setQuantity(parsed.quantity);
      if (parsed.priority) setPriority(parsed.priority);

      setBriefHint(
        "Fields pre-filled from your brief. Tweak anything before submitting — you're the author.",
      );
      // Collapse the AI drawer on success — the parsed content is now
      // visible in the rich-text editor below, no need to keep the
      // paste textarea open. Keeps it open on error so the user can
      // retry without retyping.
      setBriefAiOpen(false);
      setBriefText("");
    } catch (err) {
      console.error("[NewTicketForm] handleParseBrief error", err);
      setBriefHint(err instanceof Error ? err.message : "Something went wrong parsing the brief.");
    } finally {
      setBriefParsing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Billing-only users: UI-level guard (the API also enforces its own check)
    if (isLimitedAccess) {
      setError(
        "You don't have permission to create tickets. Please ask your company owner or project manager.",
      );
      return;
    }

    // Schema validation (title, dueDate, quantity, priority, etc.)
    const validation = createTicketSchema.safeParse({
      title,
      description,
      projectId: projectId || null,
      // Pass the raw value (not `|| null`) so an empty selection surfaces the
      // "Please select a job type." message rather than a generic type error.
      jobTypeId,
      quantity,
      priority,
      dueDate: dueDate || null,
      tagIds: selectedTagIds,
      creativeMode,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Validation failed");
      return;
    }

    // Permission & balance guards (depend on client state, not payload)
    if (companyRoleLoading) {
      setError("We are still loading your permissions. Please wait a moment.");
      return;
    }

    if (companyRole !== null && !canCreateTickets(companyRole)) {
      setError(
        "You don't have permission to create tickets. Please ask your company owner or project manager.",
      );
      return;
    }

    if (insufficientTokens) {
      setError(
        `Not enough tokens. This request costs ${effectiveCost} tokens but your balance is ${tokenBalance} tokens.`,
      );
      return;
    }

    setSubmitting(true);
    submittingRef.current = true;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    try {
      // A save in progress may still be creating the draft or storing its files.
      await saveQueueRef.current;

      // 1) Create ticket
      const res = await fetch(
        `/api/customer/tickets?companySlug=${encodeURIComponent(companySlug)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description,
            projectId: projectId || null,
            jobTypeId: jobTypeId || null,
            quantity: quantity > 1 ? quantity : undefined,
            priority,
            dueDate: dueDate || null,
            tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
            creativeMode,
            moodboardId: moodboardId || undefined,
            draftId: draftIdRef.current ?? undefined,
          }),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 402 && isInsufficientTokensBody(json)) {
          // Same moment as the top-up link: nothing is lost if they go and pay.
          await saveDraft();
          setTokenError(json);
        } else if (res.status === 403) {
          setError(
            json?.error ||
              "You don't have permission to create tickets. Please ask your company owner or project manager.",
          );
        } else {
          setError(json?.error || "Failed to create ticket.");
        }
        return;
      }

      const createdTicket = json?.ticket ?? null;

      if (!createdTicket?.id) {
        setError("Ticket was created, but the response was incomplete.");
        return;
      }

      finishedRef.current = true;

      // 2) Upload brief attachments (optional)
      const uploadResult = await uploadBriefsForTicket(createdTicket.id);

      const code = createdTicket?.code ?? createdTicket?.id ?? "";
      const draftMoved = json?.draftMoved !== false;
      if (draftMoved) {
        uploadResult.succeeded += savedFilesRef.current.length;
        uploadResult.attempted += savedFilesRef.current.length;
      }

      if (!draftMoved) {
        setSuccessMessage(
          `Ticket ${code} created, but the files on your draft couldn't be added. Your draft is still in Drafts, so you can add them from the ticket page.`,
        );
      } else if (uploadResult.attempted > 0) {
        if (uploadResult.failed === 0) {
          setSuccessMessage(
            `Ticket ${code} created successfully with ${uploadResult.succeeded} attachment(s).`,
          );
        } else if (uploadResult.succeeded > 0) {
          setSuccessMessage(
            `Ticket ${code} created. Uploaded ${uploadResult.succeeded}/${uploadResult.attempted} attachment(s). You can retry the missing ones from the ticket page later.`,
          );
        } else {
          setSuccessMessage(
            `Ticket ${code} created, but attachments failed to upload. You can add them from the ticket page later.`,
          );
        }
      } else {
        setSuccessMessage(`Ticket ${code} created successfully.`);
      }

      if (onCreated && createdTicket?.id) {
        onCreated({
          id: createdTicket.id,
          code: createdTicket.code ?? null,
        });
      } else {
        const target = redirectTo ?? "/customer/tickets";
        setTimeout(() => {
          router.push(target);
        }, 900);
      }
    } catch (err) {
      console.error("New ticket submit error:", err);
      setError("Unexpected error while creating ticket.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isBusy = submitting || uploadingBriefs;
  // The board opens this form in a dialog (it passes onCancel), which is
  // already a surface, so the sections drop their own card there.
  const embedded = !!onCancel;
  const Section = embedded ? PlainSection : CardSection;
  const remaining =
    tokenBalance != null && effectiveCost != null ? tokenBalance - effectiveCost : null;

  return (
    <form onSubmit={handleSubmit} className="@container">
      <div className="space-y-6">
        {!companyRoleLoading && isLimitedAccess ? (
          <Callout tone="warning" title="Limited access">
            Your billing role can review existing requests, but it can't create new ones for this
            workspace. Ask your company owner or a project manager to add one.
          </Callout>
        ) : null}

        <div className="grid items-start gap-6 @2xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
          {/* Left: what you need */}
          <Section>
            <div className="space-y-5">
              {/* Creative mode: only when "Work with AI" is enabled
                  (AI_TICKETS_MODE). Otherwise every ticket is a Designer ticket
                  and the choice is hidden. */}
              {aiEnabled ? (
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium">
                    How would you like this done?
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        {
                          value: "DESIGNER",
                          title: "Work with Designer",
                          text: "A creative from our team handles the work. 2-3 day turnaround.",
                        },
                        {
                          value: "AI",
                          title: "Work with AI",
                          text: "AI generates your design instantly. Ready in seconds.",
                        },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        aria-pressed={creativeMode === mode.value}
                        onClick={() => setCreativeMode(mode.value)}
                        disabled={isBusy}
                        className={`rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none ${
                          creativeMode === mode.value
                            ? "border-[var(--av2-accent)] bg-[var(--av2-selected)]"
                            : "border-[var(--av2-border)] hover:bg-[var(--av2-bg)]"
                        }`}
                      >
                        <span className="block text-sm font-semibold">{mode.title}</span>
                        <span className="mt-0.5 block text-xs text-[var(--av2-text-2)]">
                          {mode.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <Field
                label={<RequiredLabel>Title</RequiredLabel>}
                htmlFor={`${ids}-title`}
                hint={
                  creativeMode === "AI"
                    ? "This becomes the AI prompt for generating your design."
                    : "This will be the main line your creative sees on the board."
                }
              >
                <TextInput
                  id={`${ids}-title`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    creativeMode === "AI"
                      ? "Describe what you want AI to create"
                      : "Briefly describe what you need designed"
                  }
                  disabled={isBusy}
                />
              </Field>

              {/* Brief: the AI textarea is an opt-in drawer inside this block.
                  The rich-text editor is always the source of truth for what
                  gets persisted as Ticket.description. */}
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Brief</p>
                  {!isLimitedAccess && !briefAiOpen ? (
                    <Button
                      onClick={() => {
                        setBriefAiOpen(true);
                        setBriefHint(null);
                      }}
                      disabled={isBusy}
                      title="Paste plain text. AI structures it into Title, Brief, Job type and Priority."
                    >
                      ✨ Fill with AI
                    </Button>
                  ) : null}
                </div>

                {!isLimitedAccess && briefAiOpen ? (
                  <div className="mb-3 rounded-xl border border-[var(--av2-accent)]/40 bg-[var(--av2-selected)] p-4">
                    <label htmlFor={`${ids}-ai`} className="block text-sm">
                      Paste your request as plain text. AI fills Title, Brief, Job type, and
                      Priority. You can edit anything before submitting.
                    </label>
                    <TextArea
                      id={`${ids}-ai`}
                      value={briefText}
                      onChange={(e) => setBriefText(e.target.value)}
                      disabled={briefParsing}
                      rows={3}
                      placeholder="e.g. We need a square social post for our new espresso blend launching next Tuesday. Moody, warm tones, inspired by old Italian cafes. Needs to be ready by Monday."
                      className="mt-2"
                      maxLength={4000}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        onClick={handleParseBrief}
                        disabled={briefParsing || briefText.trim().length < 10}
                      >
                        {briefParsing ? "Parsing…" : "✨ Fill"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setBriefAiOpen(false);
                          setBriefText("");
                          setBriefHint(null);
                        }}
                        disabled={briefParsing}
                      >
                        Cancel
                      </Button>
                      {briefHint ? <span className="text-sm">{briefHint}</span> : null}
                    </div>
                  </div>
                ) : null}

                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Share links, context, and any requirements that will help your creative"
                  disabled={isBusy}
                  minHeight="140px"
                />
                <p className="mt-1.5 text-xs text-[var(--av2-text-2)]">
                  {!briefAiOpen && briefHint
                    ? briefHint
                    : "Write directly above, or paste plain text and click ✨ Fill with AI. You can add more context later from the request page."}
                </p>
              </div>

              {/* Brief attachments */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Brief attachments (optional)</p>
                  <p className="text-sm text-[var(--av2-text-2)] tabular-nums">
                    {attachedCount}/{maxBriefFiles}
                  </p>
                </div>

                <div className="rounded-xl border border-dashed border-[var(--av2-border)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="text-sm">
                        Attach reference files (logos, screenshots, briefs, inspiration).
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                        Accepts {BRIEF_ACCEPTED_LABEL}. Max {MAX_UPLOAD_LABEL} per file. Total:{" "}
                        {formatBytes(totalBriefBytes)}
                      </p>
                    </div>
                    <input
                      ref={briefInputRef}
                      type="file"
                      aria-label="Add brief attachments"
                      accept={BRIEF_ACCEPT_ATTR}
                      multiple
                      hidden
                      disabled={isBusy || isLimitedAccess || !canAddMoreBriefs}
                      onChange={(e) => {
                        handleAddBriefFiles(e.target.files);
                        // reset input so selecting same file again triggers change
                        e.currentTarget.value = "";
                      }}
                    />
                    <Button
                      disabled={isBusy || isLimitedAccess || !canAddMoreBriefs}
                      onClick={() => briefInputRef.current?.click()}
                    >
                      Add files
                    </Button>
                  </div>

                  {attachedCount > 0 ? (
                    <div className="mt-3">
                      <ul className="divide-y divide-[var(--av2-border)] rounded-lg border border-[var(--av2-border)]">
                        {savedFiles.map((sf) => (
                          <li
                            key={sf.id}
                            className="flex items-center justify-between gap-3 py-1 pr-1 pl-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {sf.originalName ?? "File"}
                              </p>
                              <p className="text-xs text-[var(--av2-text-2)]">
                                {formatBytes(sf.bytes)} · {sf.mimeType}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              aria-label={`Remove ${sf.originalName ?? "file"}`}
                              onClick={() => handleRemoveSavedFile(sf)}
                              disabled={isBusy}
                            >
                              Remove
                            </Button>
                          </li>
                        ))}
                        {briefFiles.map((bf) => (
                          <li
                            key={bf.id}
                            className="flex items-center justify-between gap-3 py-1 pr-1 pl-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{bf.file.name}</p>
                              <p className="text-xs text-[var(--av2-text-2)]">
                                {formatBytes(bf.file.size)} · {bf.file.type || "file"}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              aria-label={`Remove ${bf.file.name}`}
                              onClick={() => handleRemoveBriefFile(bf.id)}
                              disabled={isBusy}
                            >
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-[var(--av2-text-2)]">
                        Attachments are saved with your draft and added to the request when you
                        create it.
                      </p>
                    </div>
                  ) : null}

                  {/* Per-file reasons, e.g. "logo.png is 6.2 MB. The current
                      upload limit is 4 MB." Cleared on the next attempt. */}
                  {uploadErrors.length > 0 ? (
                    <div className="mt-3">
                      <Callout tone="error" title="Some attachments couldn't be added">
                        <ul className="list-disc space-y-0.5 pl-4">
                          {uploadErrors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </Callout>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Section>

          {/* Right: service and planning */}
          <div className="min-w-0 space-y-6">
            <Section title="Request details">
              <div className="space-y-4">
                <Field label={<RequiredLabel>Job type</RequiredLabel>}>
                  <div className="[&>button]:min-h-10 [&>button]:rounded-lg">
                    <JobTypePicker
                      jobTypes={jobTypes}
                      value={jobTypeId}
                      onChange={handleJobTypeChange}
                      disabled={isBusy}
                    />
                  </div>
                </Field>

                {selectedJobType?.hasQuantity ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">
                      {selectedJobType.quantityLabel || "Quantity"}
                    </span>
                    <div className="inline-flex items-center rounded-lg border border-[var(--av2-border)]">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={isBusy || quantity <= 1}
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-l-lg hover:bg-[var(--av2-bg)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        −
                      </button>
                      <span
                        aria-live="polite"
                        className="flex h-10 w-10 items-center justify-center border-x border-[var(--av2-border)] text-sm font-semibold tabular-nums"
                      >
                        {quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={isBusy || quantity >= 10}
                        onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-r-lg hover:bg-[var(--av2-bg)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : null}

                <Field
                  label="Project"
                  htmlFor={`${ids}-project`}
                  hint="Use projects to group related requests together."
                >
                  <Select
                    id={`${ids}-project`}
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    disabled={isBusy}
                  >
                    <option value="">No specific project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.code ? `(${p.code})` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Priority"
                  htmlFor={`${ids}-priority`}
                  hint="Higher priority requests are more likely to be picked up first."
                >
                  <Select
                    id={`${ids}-priority`}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TicketPriorityValue)}
                    disabled={isBusy}
                  >
                    {PRIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Due date"
                  htmlFor={`${ids}-due`}
                  hint="Set a target date for delivery. Optional."
                >
                  <TextInput
                    id={`${ids}-due`}
                    type="date"
                    className="dark:[color-scheme:dark]"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={isBusy}
                    min={todayStr}
                    max={maxDateStr}
                  />
                </Field>

                {localTags.length > 0 || canCreateTagsProp ? (
                  <Field label="Tags" hint="Add up to 5 tags to categorize this request.">
                    <TagMultiSelect
                      availableTags={localTags}
                      selectedTagIds={selectedTagIds}
                      onChange={setSelectedTagIds}
                      onCreateTag={async (name, color) => {
                        try {
                          const res = await fetch("/api/customer/tags", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name, color }),
                          });
                          const json = await res.json().catch(() => null);
                          if (!res.ok) {
                            setError(json?.error || "Failed to create tag");
                            return null;
                          }
                          const created = json.tag as TagOption;
                          setLocalTags((prev) =>
                            [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
                          );
                          onTagCreated?.(created);
                          return created;
                        } catch {
                          setError("Failed to create tag");
                          return null;
                        }
                      }}
                      canCreate={
                        canCreateTagsProp ??
                        (companyRole !== null && canManageTagsCheck(companyRole))
                      }
                      disabled={isBusy}
                    />
                  </Field>
                ) : null}

                {moodboards.length > 0 ? (
                  <Field
                    label="Attach moodboard (optional)"
                    htmlFor={`${ids}-moodboard`}
                    hint="Link a moodboard to share inspiration and references with your designer."
                  >
                    <Select
                      id={`${ids}-moodboard`}
                      value={moodboardId}
                      onChange={(e) => setMoodboardId(e.target.value)}
                      disabled={isBusy}
                    >
                      <option value="">No moodboard</option>
                      {moodboards.map((mb) => (
                        <option key={mb.id} value={mb.id}>
                          {mb.title} ({mb.itemCount} items)
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
              </div>
            </Section>

            <Section title="Cost summary">
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
                {tokenBalance != null ? (
                  <>
                    <dt className="text-[var(--av2-text-2)]">Current balance</dt>
                    <dd className="text-right font-semibold tabular-nums">
                      {tokenCount(tokenBalance)}
                    </dd>
                  </>
                ) : null}
                {/* No cost is shown until there's a job type to price. */}
                <dt className="text-[var(--av2-text-2)]">Cost</dt>
                <dd className="text-right font-semibold tabular-nums">
                  {effectiveCost != null && selectedJobType?.tokenCost != null
                    ? quantity > 1
                      ? `${selectedJobType.tokenCost} × ${quantity} = ${tokenCount(effectiveCost)}`
                      : tokenCount(effectiveCost)
                    : selectedJobType
                      ? DASH
                      : "Select a job type"}
                </dd>
                {remaining != null ? (
                  <>
                    <dt className="text-[var(--av2-text-2)]">Remaining after</dt>
                    <dd
                      className={`text-right font-semibold tabular-nums ${
                        remaining < 0 ? "text-[var(--av2-error-text)]" : ""
                      }`}
                    >
                      {tokenCount(remaining)}
                    </dd>
                  </>
                ) : null}
              </dl>

              {insufficientTokens ? (
                <div className="mt-3">
                  <Callout tone="error" title="Not enough tokens">
                    Choose a different job type, save this as a draft, or{" "}
                    <button
                      type="button"
                      onClick={handleTopUp}
                      className="cursor-pointer font-semibold underline"
                    >
                      top up your balance
                    </button>
                    . We&apos;ll save your draft first and you can come back to it.
                  </Callout>
                </div>
              ) : null}
            </Section>
          </div>
        </div>

        {/* Actions: results sit right above them, so they're seen after a click. */}
        <div
          className={
            embedded
              ? "sticky -bottom-5 z-10 -mx-5 -mb-5 space-y-3 border-t border-[var(--av2-border)] bg-[var(--av2-surface)] px-5 py-4"
              : "sticky bottom-4 z-10 space-y-3 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-4"
          }
        >
          {error ? (
            <Callout tone="error" title="This request wasn't created">
              {error}
            </Callout>
          ) : null}
          {successMessage ? <Callout tone="success">{successMessage}</Callout> : null}
          {uploadProgressText ? (
            <p role="status" className="text-sm text-[var(--av2-text-2)]">
              {uploadProgressText}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {canSaveDrafts ? (
              <p
                role="status"
                className={`mr-auto min-w-0 basis-full text-sm sm:basis-auto ${
                  saveState === "error"
                    ? "text-[var(--av2-error-text)]"
                    : "text-[var(--av2-text-2)]"
                }`}
              >
                {saveState === "saving"
                  ? "Saving draft…"
                  : saveState === "error"
                    ? "Your draft couldn't be saved. Try Save as draft again."
                    : saveState === "saved" && savedAt
                      ? `Draft saved ${savedAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : null}
              </p>
            ) : null}
            {draftId ? (
              <Button
                variant="ghost"
                onClick={() => setConfirmingDelete(true)}
                disabled={isBusy || deletingDraft}
              >
                Delete draft
              </Button>
            ) : null}
            <Button
              onClick={async () => {
                if (onCancel) {
                  // The parent's close runs the same check.
                  onCancel();
                } else if (await confirmLeave()) {
                  router.push(redirectTo ?? "/customer/tickets");
                }
              }}
              disabled={isBusy}
            >
              Cancel
            </Button>
            {canSaveDrafts ? (
              <Button
                variant={insufficientTokens ? "primary" : "secondary"}
                onClick={() => void saveDraft()}
                disabled={
                  isBusy ||
                  saveState === "saving" ||
                  (!hasDraftContent && !jobTypeId) ||
                  (!!draftId && !needsSaving && saveState === "saved")
                }
              >
                Save as draft
              </Button>
            ) : null}
            <Button
              type="submit"
              variant={insufficientTokens ? "secondary" : "primary"}
              disabled={isLimitedAccess || insufficientTokens || isBusy}
            >
              {isBusy
                ? uploadingBriefs
                  ? "Uploading attachments…"
                  : creativeMode === "AI"
                    ? "Generating…"
                    : "Creating…"
                : creativeMode === "AI"
                  ? "Create & Generate with AI"
                  : "Create request"}
            </Button>
          </div>
        </div>
      </div>

      {tokenError ? (
        <OnTopOfDialog>
          <InsufficientTokensModal
            info={tokenError}
            onClose={() => setTokenError(null)}
            upgradeHref={draftId ? `/customer/settings?draft=${draftId}` : undefined}
          />
        </OnTopOfDialog>
      ) : null}
      {leavePrompt ? (
        <OnTopOfDialog>
          <ConfirmDialog
            open
            onClose={() => leavePrompt(false)}
            onConfirm={() => leavePrompt(true)}
            variant="warning"
            title="Leave without saving?"
            description="We couldn't save your latest changes to this draft. If you leave now, they'll be lost."
            confirmLabel="Leave"
            cancelLabel="Keep editing"
          />
        </OnTopOfDialog>
      ) : null}
      {confirmingDelete ? (
        <OnTopOfDialog>
          <ConfirmDialog
            open
            onClose={() => setConfirmingDelete(false)}
            onConfirm={handleDeleteDraft}
            loading={deletingDraft}
            title="Delete this draft?"
            description="The draft and its files will be removed. This can't be undone."
            confirmLabel="Delete draft"
            cancelLabel="Keep draft"
          />
        </OnTopOfDialog>
      ) : null}
    </form>
  );
}

/**
 * The form can sit inside the board's dialog, whose panel would otherwise trap a
 * second dialog and clip it. Only rendered once something is open, so never on the server.
 */
function OnTopOfDialog({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <>
      {children}{" "}
      <span aria-hidden className="text-[var(--av2-link)]">
        *
      </span>
      <span className="sr-only">(required)</span>
    </>
  );
}

function CardSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Card>
      {title ? <h2 className="mb-4 text-xl leading-7 font-semibold">{title}</h2> : null}
      {children}
    </Card>
  );
}

function PlainSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      {title ? <h3 className="mb-3 text-base font-semibold">{title}</h3> : null}
      {children}
    </div>
  );
}
