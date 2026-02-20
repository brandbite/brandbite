// -----------------------------------------------------------------------------
// @file: app/customer/tickets/new/NewTicketForm.tsx
// @purpose: Client-side form for creating a new design ticket (role-aware)
// @version: v1.6.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  type CompanyRole,
  normalizeCompanyRole,
  canCreateTickets,
  isBillingReadOnly,
} from "@/lib/permissions/companyRoles";
import { Button } from "@/components/ui/button";
import { FormInput, FormSelect } from "@/components/ui/form-field";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { TagMultiSelect, type TagOption } from "@/components/ui/tag-multi-select";
import { JobTypePicker } from "@/components/ui/job-type-picker";
import type { TagColorKey } from "@/lib/tag-colors";
import { canManageTags as canManageTagsCheck } from "@/lib/permissions/companyRoles";

type ProjectOption = {
  id: string;
  name: string;
  code: string | null;
};

type JobTypeOption = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  tokenCost?: number;
  hasQuantity?: boolean;
  quantityLabel?: string | null;
  defaultQuantity?: number;
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
  initialJobTypeId?: string;
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

async function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
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
  initialJobTypeId,
}: Props) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [jobTypeId, setJobTypeId] = useState<string>(initialJobTypeId ?? "");
  const [priority, setPriority] = useState<TicketPriorityValue>("MEDIUM");
  const [dueDate, setDueDate] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [localTags, setLocalTags] = useState<TagOption[]>(tagsProp ?? []);

  // Sync when tags prop changes (e.g. after parent re-fetches)
  useEffect(() => {
    if (tagsProp) setLocalTags(tagsProp);
  }, [tagsProp]);

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
    () => (jobTypeId ? jobTypes.find((jt) => jt.id === jobTypeId) ?? null : null),
    [jobTypeId, jobTypes],
  );

  // Effective cost = unit cost × quantity
  const effectiveCost =
    selectedJobType?.tokenCost != null
      ? selectedJobType.tokenCost * quantity
      : null;

  // True when a job type is selected and its cost exceeds the company balance
  const insufficientTokens =
    tokenBalance != null &&
    effectiveCost != null &&
    tokenBalance < effectiveCost;

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
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Company role (for limited access / billing-only users)
  // ---------------------------------------------------------------------------

  const [companyRole, setCompanyRole] = useState<CompanyRole | null>(null);
  const [companyRoleLoading, setCompanyRoleLoading] =
    useState<boolean>(true);

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
        console.error(
          "[NewTicketForm] Failed to load company role from settings endpoint",
          err,
        );
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

  const isLimitedAccess =
    companyRole !== null && isBillingReadOnly(companyRole);

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

    const accepted = incoming.filter((f) => {
      // Allow images for now (fits annotation vision).
      // If later you want PDFs, add "application/pdf" etc.
      return f.type.startsWith("image/");
    });

    if (accepted.length !== incoming.length) {
      setError("Some files were skipped. Only image files are supported for now.");
    }

    setBriefFiles((prev) => {
      const room = Math.max(0, maxBriefFiles - prev.length);
      const next = accepted.slice(0, room).map((file) => ({
        id: crypto.randomUUID(),
        file,
      }));

      if (accepted.length > room) {
        setError(`You can attach up to ${maxBriefFiles} images.`);
      }

      return [...prev, ...next];
    });
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

    let succeeded = 0;
    let failed = 0;

    // Sequential uploads keep it predictable (and easier to debug)
    for (let i = 0; i < briefFiles.length; i += 1) {
      const entry = briefFiles[i];
      const file = entry.file;

      try {
        setUploadProgressText(
          `Uploading attachment ${i + 1} of ${briefFiles.length}...`,
        );

        // 1) Presign
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
          console.error("[NewTicketForm] Presign failed:", presignJson);
          continue;
        }

        const uploadUrl: string | undefined = presignJson?.uploadUrl;
        const storageKey: string | undefined = presignJson?.storageKey;

        if (!uploadUrl || !storageKey) {
          failed += 1;
          console.error("[NewTicketForm] Presign missing uploadUrl/storageKey");
          continue;
        }

        // 2) PUT to R2
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!putRes.ok) {
          failed += 1;
          console.error("[NewTicketForm] R2 PUT failed:", putRes.status);
          continue;
        }

        // 3) Register in DB
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

        const registerJson = await registerRes.json().catch(() => null);

        if (!registerRes.ok) {
          failed += 1;
          console.error("[NewTicketForm] Asset register failed:", registerJson);
          continue;
        }

        succeeded += 1;
      } catch (err) {
        failed += 1;
        console.error("[NewTicketForm] Brief upload error:", err);
      }
    }

    setUploadProgressText(null);
    setUploadingBriefs(false);

    return { attempted: briefFiles.length, succeeded, failed };
  }

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Billing-only users: UI-level guard (API tarafında da ayrıca kilit var)
    if (isLimitedAccess) {
      setError(
        "You don't have permission to create tickets. Please ask your company owner or project manager.",
      );
      return;
    }

    if (!title.trim()) {
      setError("Please enter a title for your request.");
      return;
    }

    // Güvenlik olarak rolesi henüz yüklenmediyse create'e izin vermeyelim
    if (companyRoleLoading) {
      setError("We are still loading your permissions. Please wait a moment.");
      return;
    }

    // İleride MEMBER'ı kısıtlamak istersek tek yerden değiştirebiliriz
    if (companyRole !== null && !canCreateTickets(companyRole)) {
      setError(
        "You don't have permission to create tickets. Please ask your company owner or project manager.",
      );
      return;
    }

    // Token balance guard — prevent submission when cost exceeds balance
    if (insufficientTokens) {
      setError(
        `Not enough tokens. This request costs ${effectiveCost} tokens but your balance is ${tokenBalance} tokens.`,
      );
      return;
    }

    // Due date validation — reject past dates and dates beyond 2 years
    if (dueDate) {
      if (dueDate < todayStr) {
        setError("Due date cannot be in the past.");
        return;
      }
      if (dueDate > maxDateStr) {
        setError("Due date cannot be more than 2 years in the future.");
        return;
      }
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
          }),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 403) {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Limited access banner for BILLING role */}
      {!companyRoleLoading && isLimitedAccess && (
        <div className="rounded-lg border border-[#f6c89f] bg-[#fff4e6] px-3 py-2 text-xs text-[#7a7a7a]">
          <p className="text-[11px] font-medium text-[#9a5b2b]">
            Limited access
          </p>
          <p className="mt-1">
            You can review existing tickets, but only your company owner or
            project manager can create new tickets for this workspace.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-[#fff7f7] px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-[#f0fff6] px-3 py-2 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      {uploadProgressText && (
        <div className="rounded-lg border border-[#eadfce] bg-[#fffaf1] px-3 py-2 text-xs text-[#6b6258]">
          {uploadProgressText}
        </div>
      )}

      {/* Title */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">Title</label>
        <FormInput
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Briefly describe what you need designed"
          disabled={isBusy}
        />
        <p className="text-[11px] text-[#9a9892]">
          This will be the main line your designer sees on the board.
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">Details</label>
        <RichTextEditor
          value={description}
          onChange={setDescription}
          placeholder="Share links, context, and any requirements that will help your designer"
          disabled={isBusy}
          minHeight="60px"
        />
        <p className="text-[11px] text-[#9a9892]">
          You can always add more context later from the ticket view.
        </p>
      </div>

      {/* Brief attachments */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-[#424143]">
            Brief attachments (optional)
          </label>
          <p className="text-[11px] text-[#9a9892]">
            {briefFiles.length}/{maxBriefFiles}
          </p>
        </div>

        <div className="rounded-md border border-dashed border-[#d4d2cc] bg-white px-3 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] text-[#6b6258]">
              Attach reference images (logos, screenshots, inspiration).
              <span className="ml-1 text-[#9a9892]">
                Total: {formatBytes(totalBriefBytes)}
              </span>
            </div>

            <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[#d4d2cc] bg-white px-4 py-2 text-xs font-medium text-[#424143] hover:bg-[#f7f4f0] disabled:cursor-not-allowed disabled:opacity-60">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={isBusy || isLimitedAccess || !canAddMoreBriefs}
                onChange={(e) => {
                  handleAddBriefFiles(e.target.files);
                  // reset input so selecting same file again triggers change
                  e.currentTarget.value = "";
                }}
              />
              Add images
            </label>
          </div>

          {briefFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {briefFiles.map((bf) => (
                <div
                  key={bf.id}
                  className="flex items-center justify-between rounded-md border border-[#eee7dc] bg-[#fffaf1] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[#424143]">
                      {bf.file.name}
                    </p>
                    <p className="text-[11px] text-[#9a9892]">
                      {formatBytes(bf.file.size)} • {bf.file.type || "file"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveBriefFile(bf.id)}
                    disabled={isBusy}
                    className="ml-3 rounded-full border border-[#d4d2cc] bg-white px-3 py-1.5 text-[11px] font-medium text-[#424143] hover:bg-[#f7f4f0] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <p className="text-[11px] text-[#9a9892]">
                Attachments will be uploaded right after the ticket is created.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">
          Priority
        </label>
        <FormSelect
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriorityValue)}
          disabled={isBusy}
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </FormSelect>
        <p className="text-[11px] text-[#9a9892]">
          Higher priority requests are more likely to be picked up first.
        </p>
      </div>

      {/* Due date */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">
          Due date
        </label>
        <FormInput
          type="date"
          value={dueDate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)}
          disabled={isBusy}
          min={todayStr}
          max={maxDateStr}
        />
        <p className="text-[11px] text-[#9a9892]">
          Set a target date for delivery. Optional.
        </p>
      </div>

      {/* Project */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">
          Project
        </label>
        <FormSelect
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
        </FormSelect>
        <p className="text-[11px] text-[#9a9892]">
          Use projects to group related requests together.
        </p>
      </div>

      {/* Job type */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">
          Job type
        </label>
        <JobTypePicker
          jobTypes={jobTypes}
          value={jobTypeId}
          onChange={handleJobTypeChange}
          disabled={isBusy}
        />

        {/* Quantity stepper — visible when a job type with hasQuantity is selected */}
        {selectedJobType?.hasQuantity && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-[#9a9892]">
              {selectedJobType.quantityLabel || "Quantity"}
            </span>
            <div className="inline-flex items-center rounded-md border border-[var(--bb-border-input)]">
              <button
                type="button"
                disabled={isBusy || quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-7 w-7 items-center justify-center text-sm text-[#6b6258] hover:bg-[var(--bb-bg-warm)] disabled:opacity-40 disabled:cursor-not-allowed rounded-l-md"
              >
                −
              </button>
              <span className="flex h-7 w-8 items-center justify-center border-x border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] text-xs font-semibold text-[#424143]">
                {quantity}
              </span>
              <button
                type="button"
                disabled={isBusy || quantity >= 10}
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                className="flex h-7 w-7 items-center justify-center text-sm text-[#6b6258] hover:bg-[var(--bb-bg-warm)] disabled:opacity-40 disabled:cursor-not-allowed rounded-r-md"
              >
                +
              </button>
            </div>
            {quantity > 1 && (
              <span className="text-[11px] text-[#9a9892]">
                ×{quantity}
              </span>
            )}
          </div>
        )}

        {/* Token balance + cost preview */}
        {tokenBalance != null ? (
          <div className="flex items-center gap-1.5 text-[11px]">
            {effectiveCost != null && selectedJobType?.tokenCost != null ? (
              <>
                <span className="text-[#9a9892]">
                  Cost:{" "}
                  <span className="font-semibold text-[#424143]">
                    {quantity > 1
                      ? `${selectedJobType.tokenCost} × ${quantity} = ${effectiveCost} tokens`
                      : `${effectiveCost} tokens`}
                  </span>
                </span>
                <span className="text-[#d4d2cc]">·</span>
                {(() => {
                  const remaining = tokenBalance - effectiveCost;
                  const isNegative = remaining < 0;
                  return (
                    <span className={isNegative ? "text-[#b13832]" : "text-[#9a9892]"}>
                      Remaining after:{" "}
                      <span className={`font-semibold ${isNegative ? "text-[#b13832]" : "text-[#424143]"}`}>
                        {remaining.toLocaleString()} tokens
                      </span>
                    </span>
                  );
                })()}
              </>
            ) : (
              <span className="text-[#9a9892]">
                Your balance: <span className="font-semibold text-[#424143]">{tokenBalance.toLocaleString()} tokens</span>
              </span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-[#9a9892]">
            Job types are linked to token costs and designer payouts.
          </p>
        )}

        {insufficientTokens && (
          <div className="mt-1.5 rounded-md border border-red-200 bg-[#fff7f7] px-2.5 py-1.5 text-[11px] text-red-700">
            Not enough tokens to create this ticket. Choose a different job type or top up your balance.
          </div>
        )}
      </div>

      {/* Tags */}
      {localTags.length > 0 || canCreateTagsProp ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#424143]">Tags</label>
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
                  [...prev, created].sort((a, b) =>
                    a.name.localeCompare(b.name),
                  ),
                );
                onTagCreated?.(created);
                return created;
              } catch {
                setError("Failed to create tag");
                return null;
              }
            }}
            canCreate={canCreateTagsProp ?? (companyRole !== null && canManageTagsCheck(companyRole))}
            disabled={isBusy}
          />
          <p className="text-[11px] text-[#9a9892]">
            Add up to 5 tags to categorize this request.
          </p>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => router.push(redirectTo ?? "/customer/tickets")}
          disabled={isBusy}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isLimitedAccess || insufficientTokens}
          loading={isBusy}
          loadingText={uploadingBriefs ? "Uploading attachments..." : "Creating..."}
        >
          Create ticket
        </Button>
      </div>
    </form>
  );
}
