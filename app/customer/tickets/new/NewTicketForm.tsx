// -----------------------------------------------------------------------------
// @file: app/customer/tickets/new/NewTicketForm.tsx
// @purpose: Client-side form for creating a new design ticket (role-aware)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

type CompanyRoleString = "OWNER" | "PM" | "BILLING" | "MEMBER";

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
};

export default function NewTicketForm({
  companySlug,
  projects,
  jobTypes,
}: Props) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [jobTypeId, setJobTypeId] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Company role (for limited access / billing-only users)
  // ---------------------------------------------------------------------------

  const [companyRole, setCompanyRole] =
    useState<CompanyRoleString | null>(null);
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
          const role = json?.user?.companyRole ?? null;
          if (
            role === "OWNER" ||
            role === "PM" ||
            role === "BILLING" ||
            role === "MEMBER"
          ) {
            setCompanyRole(role);
          } else {
            setCompanyRole(null);
          }
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

  const isLimitedAccess = companyRole === "BILLING";

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Billing-only users: UI-level guard (API tarafında da ayrıca kilitleyebiliriz)
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

    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/customer/tickets?companySlug=${encodeURIComponent(
          companySlug,
        )}`,
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
          }),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 403) {
          // Permission-style error
          setError(
            json?.error ||
              "You don't have permission to create tickets. Please ask your company owner or project manager.",
          );
        } else {
          setError(json?.error || "Failed to create ticket.");
        }
        return;
      }

      setSuccessMessage(
        `Ticket ${
          json?.ticket?.code ?? json?.ticket?.id ?? ""
        } created successfully.`,
      );

      // Optional: redirect back to tickets list after a short delay
      setTimeout(() => {
        router.push("/customer/tickets");
      }, 800);
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

      {/* Title */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Briefly describe what you need designed"
          className="w-full rounded-md border border-[#d4d2cc] bg-white px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
        />
        <p className="text-[11px] text-[#9a9892]">
          This will be the main line your designer sees on the board.
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">
          Details
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Share links, context, and any requirements that will help your designer"
          rows={5}
          className="w-full rounded-md border border-[#d4d2cc] bg-white px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
        />
        <p className="text-[11px] text-[#9a9892]">
          You can always add more context later from the ticket view.
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
          Job types are linked to token costs and designer payouts in the
          admin panel.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push("/customer/tickets")}
          className="rounded-full border border-[#d4d2cc] px-4 py-2 text-xs font-medium text-[#424143] hover:bg-[#f7f4f0]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || isLimitedAccess}
          className="rounded-full bg-[#f15b2b] px-5 py-2 text-xs font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Creating..." : "Create ticket"}
        </button>
      </div>
    </form>
  );
}
