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

type ProjectOption = {
  id: string;
  name: string;
  code: string | null;
};

type JobTypeOption = {
  id: string;
  name: string;
  description: string | null;
};

type Props = {
  companySlug: string;
  projects: ProjectOption[];
  jobTypes: JobTypeOption[];
  redirectTo?: string;
  onCreated?: (ticket: { id: string; code?: string | null }) => void;
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
  redirectTo,
  onCreated,
}: Props) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [jobTypeId, setJobTypeId] = useState<string>("");
  const [priority, setPriority] = useState<TicketPriorityValue>("MEDIUM");

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
            priority,
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
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Briefly describe what you need designed"
          className="w-full rounded-md border border-[#d4d2cc] bg-white px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
          disabled={isBusy}
        />
        <p className="text-[11px] text-[#9a9892]">
          This will be the main line your designer sees on the board.
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">Details</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Share links, context, and any requirements that will help your designer"
          rows={5}
          className="w-full rounded-md border border-[#d4d2cc] bg-white px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
          disabled={isBusy}
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
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriorityValue)}
          className="w-full rounded-md border border-[#d4d2cc] bg-white px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
          disabled={isBusy}
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-[#9a9892]">
          Higher priority requests are more likely to be picked up first.
        </p>
      </div>

      {/* Project */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">
          Project
        </label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full rounded-md border border-[#d4d2cc] bg-white px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
          disabled={isBusy}
        >
          <option value="">No specific project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.code ? `(${p.code})` : ""}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-[#9a9892]">
          Use projects to group related requests together.
        </p>
      </div>

      {/* Job type */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">
          Job type
        </label>
        <select
          value={jobTypeId}
          onChange={(e) => setJobTypeId(e.target.value)}
          className="w-full rounded-md border border-[#d4d2cc] bg-white px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
          disabled={isBusy}
        >
          <option value="">Choose a job type</option>
          {jobTypes.map((jt) => (
            <option key={jt.id} value={jt.id}>
              {jt.name}
              {jt.description ? ` — ${jt.description}` : ""}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-[#9a9892]">
          Job types are linked to token costs and designer payouts in the admin
          panel.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push(redirectTo ?? "/customer/tickets")}
          className="rounded-full border border-[#d4d2cc] px-4 py-2 text-xs font-medium text-[#424143] hover:bg-[#f7f4f0] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isBusy}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isBusy || isLimitedAccess}
          className="rounded-full bg-[#f15b2b] px-5 py-2 text-xs font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {uploadingBriefs
            ? "Uploading attachments..."
            : submitting
              ? "Creating..."
              : "Create ticket"}
        </button>
      </div>
    </form>
  );
}
