// -----------------------------------------------------------------------------
// @file: app/customer/tickets/new/NewTicketForm.tsx
// @purpose: Client-side form for creating a new design ticket
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

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

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "Failed to create ticket.");
        return;
      }

      setSuccessMessage(
        `Ticket ${json.ticket?.code ?? json.ticket?.id ?? ""} created successfully.`,
      );

      // Optional: redirect back to tickets list after a short delay
      setTimeout(() => {
        router.push("/customer/tickets");
      }, 800);
    } catch (err: any) {
      console.error("New ticket submit error:", err);
      setError("Unexpected error while creating ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">
          Title <span className="text-[#f15b2b]">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short summary of the design request"
          className="w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[#424143]">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add context, links, brand guidelines, and what success looks like."
          rows={5}
          className="w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
        />
        <p className="mt-1 text-xs text-[#9a9892]">
          You can keep this high-level for now. Designers will ask follow-up
          questions if needed.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#424143]">
            Project
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
          >
            <option value="">No specific project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.code ? `(${p.code})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[#424143]">
            Job type
          </label>
          <select
            value={jobTypeId}
            onChange={(e) => setJobTypeId(e.target.value)}
            className="w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
          >
            <option value="">Select a job type</option>
            {jobTypes.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[#9a9892]">
            Job types control token usage and designer payouts. This list comes
            from your admin configuration.
          </p>
        </div>
      </div>

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
          disabled={submitting}
          className="rounded-full bg-[#f15b2b] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Creating..." : "Create ticket"}
        </button>
      </div>
    </form>
  );
}