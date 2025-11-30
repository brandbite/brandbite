// -----------------------------------------------------------------------------
// @file: app/customer/tickets/new/NewTicketForm.tsx
// @purpose: Client-side form for creating a new design ticket (role-aware, with toasts)
// @version: v1.4.0
// @status: active
// @lastUpdate: 2025-11-30
// -----------------------------------------------------------------------------

"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  CompanyRole,
  normalizeCompanyRole,
  canCreateTickets,
  isBillingReadOnly,
} from "@/lib/permissions/companyRoles";
import { useToast } from "@/components/ui/toast-provider";

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

export default function NewTicketForm({
  companySlug,
  projects,
  jobTypes,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [jobTypeId, setJobTypeId] = useState<string>("");
  const [priority, setPriority] = useState<TicketPriorityValue>("MEDIUM");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    null,
  );

  // ---------------------------------------------------------------------------
  // Company role (for limited access / billing-only users)
  // ---------------------------------------------------------------------------

  const [companyRole, setCompanyRole] =
    useState<CompanyRole | null>(null);
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
          const role = normalizeCompanyRole(
            json?.user?.companyRole ?? null,
          );
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
  // Submit handler
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Billing-only users: UI-level guard (API tarafında da ayrıca kilit var)
    if (isLimitedAccess) {
      const msg =
        "You don't have permission to create tickets. Please ask your company owner or project manager.";
      setError(msg);
      showToast({
        type: "error",
        title: "You can’t create tickets",
        description: msg,
      });
      return;
    }

    if (!title.trim()) {
      const msg = "Please enter a title for your request.";
      setError(msg);
      showToast({
        type: "warning",
        title: "Missing title",
        description: msg,
      });
      return;
    }

    // Güvenlik olarak rolesi henüz yüklenmediyse create'e izin vermeyelim
    if (companyRoleLoading) {
      const msg =
        "We are still loading your permissions. Please wait a moment.";
      setError(msg);
      showToast({
        type: "warning",
        title: "Permissions are still loading",
        description: msg,
      });
      return;
    }

    // İleride MEMBER'ı kısıtlamak istersek tek yerden değiştirebiliriz
    if (companyRole !== null && !canCreateTickets(companyRole)) {
      const msg =
        "You don't have permission to create tickets. Please ask your company owner or project manager.";
      setError(msg);
      showToast({
        type: "error",
        title: "You can’t create tickets",
        description: msg,
      });
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
            priority,
          }),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const baseError =
          (json &&
            typeof json === "object" &&
            "error" in json &&
            typeof (json as any).error === "string" &&
            (json as any).error) ||
          (res.status === 403
            ? "You don't have permission to create tickets. Please ask your company owner or project manager."
            : "Failed to create ticket.");

        setError(baseError);

        showToast({
          type: "error",
          title: "We couldn't create your request",
          description: baseError,
        });

        return;
      }

      const ticket = (json as any)?.ticket;
      const ticketLabel =
        ticket?.code ?? ticket?.id ?? "your new request";

      const successText = `Ticket ${ticketLabel} created successfully.`;

      setSuccessMessage(successText);

      showToast({
        type: "success",
        title: "Request created",
        description: ticket?.code
          ? `We created ${ticket.code} and routed it to your design team.`
          : "Your request was created and routed to your design team.",
      });

      // Kısa bir an form üzerinde mesajı gösterip listeye dönelim
      setTimeout(() => {
        router.push("/customer/tickets");
      }, 800);
    } catch (err) {
      console.error("New ticket submit error:", err);
      const msg = "Unexpected error while creating ticket.";

      setError(msg);

      showToast({
        type: "error",
        title: "We couldn't create your request",
        description: msg,
      });
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

      {/* Priority */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">
          Priority
        </label>
        <select
          value={priority}
          onChange={(e) =>
            setPriority(e.target.value as TicketPriorityValue)
          }
          className="w-full rounded-md border border-[#d4d2cc] bg-white px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
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
          className="w-full rounded-md border border-[#d4d2cc] bg.white px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
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
          className="w-full rounded-md border border-[#d4d2cc] bg.white px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
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
          className="rounded-full bg-[#f15b2b] px-5 py-2 text-xs font-medium text.white shadow-sm transition-transform hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Creating..." : "Create ticket"}
        </button>
      </div>
    </form>
  );
}
