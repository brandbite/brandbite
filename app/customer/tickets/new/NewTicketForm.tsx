// -----------------------------------------------------------------------------
// @file: app/customer/tickets/new/NewTicketForm.tsx
// @purpose: Client-side form for creating a new design ticket (role-aware)
// @version: v1.6.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
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
import { RichTextEditor } from "@/components/ui/rich-text-editor";
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
};

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
}: Props) {
  const router = useRouter();
  const ids = useId();
  const briefInputRef = useRef<HTMLInputElement>(null);

  const [creativeMode, setCreativeMode] = useState<"DESIGNER" | "AI">("DESIGNER");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [jobTypeId, setJobTypeId] = useState<string>(initialJobTypeId ?? "");
  const [priority, setPriority] = useState<TicketPriorityValue>("MEDIUM");
  const [dueDate, setDueDate] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [localTags, setLocalTags] = useState<TagOption[]>(tagsProp ?? []);
  const [moodboardId, setMoodboardId] = useState<string>("");
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
  const [quantity, setQuantity] = useState(initialQty);

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

  const [briefFiles, setBriefFiles] = useState<PendingBriefFile[]>([]);

  const totalBriefBytes = useMemo(() => {
    return briefFiles.reduce((sum, f) => sum + (f.file.size ?? 0), 0);
  }, [briefFiles]);

  const maxBriefFiles = 8;

  const canAddMoreBriefs = briefFiles.length < maxBriefFiles;

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

    setBriefFiles((prev) => {
      const room = Math.max(0, maxBriefFiles - prev.length);
      const next = accepted.slice(0, room).map((file) => ({
        id: crypto.randomUUID(),
        file,
      }));

      if (accepted.length > room) {
        rejections.push(`You can attach up to ${maxBriefFiles} files — some were not added.`);
      }

      return [...prev, ...next];
    });

    // Persistent, per-file reasons (cleared on the next successful add or upload).
    setUploadErrors(rejections);
  };

  const handleRemoveBriefFile = (id: string) => {
    setBriefFiles((prev) => prev.filter((x) => x.id !== id));
  };

  async function uploadBriefsForTicket(ticketId: string): Promise<{
    attempted: number;
    succeeded: number;
    failed: number;
  }> {
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

    try {
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
          }),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 402 && isInsufficientTokensBody(json)) {
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

      // 2) Upload brief attachments (optional)
      const uploadResult = await uploadBriefsForTicket(createdTicket.id);

      const code = createdTicket?.code ?? createdTicket?.id ?? "";

      if (uploadResult.attempted > 0) {
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
                    {briefFiles.length}/{maxBriefFiles}
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

                  {briefFiles.length > 0 ? (
                    <div className="mt-3">
                      <ul className="divide-y divide-[var(--av2-border)] rounded-lg border border-[var(--av2-border)]">
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
                        Attachments will be uploaded right after the request is created.
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
                    Choose a different job type or{" "}
                    <a href="/customer/settings" className="font-semibold underline">
                      top up your balance
                    </a>
                    .
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
            <Button
              onClick={() => {
                if (onCancel) {
                  onCancel();
                } else {
                  router.push(redirectTo ?? "/customer/tickets");
                }
              }}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
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

      <InsufficientTokensModal info={tokenError} onClose={() => setTokenError(null)} />
    </form>
  );
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
