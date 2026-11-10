"use client";

// -----------------------------------------------------------------------------
// @file: components/moodboard/link-job-modal.tsx
// @purpose: Lets a creative tie their moodboard to one of their jobs, which is
//           what decides which customer it can be shared with.
// -----------------------------------------------------------------------------

import React, { useEffect, useState } from "react";

import { Modal, ModalHeader } from "@/components/ui/modal";

type Job = { id: string; title: string; status: string };

type LinkJobModalProps = {
  open: boolean;
  currentTicketId: string | null;
  onClose: () => void;
  onPick: (ticketId: string | null) => void;
};

export function LinkJobModal({ open, currentTicketId, onClose, onPick }: LinkJobModalProps) {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setJobs(null);
    setFailed(false);
    fetch("/api/creative/tickets", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (alive) setJobs(json.tickets ?? []);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const itemClass =
    "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none";

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader title="Link to a request" onClose={onClose} />
      {failed ? (
        <p role="alert" className="text-sm text-[var(--av2-error-text)]">
          We couldn&apos;t load your requests. Please try again.
        </p>
      ) : jobs === null ? (
        <p role="status" className="text-sm text-[var(--av2-text-2)]">
          Loading your requests…
        </p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-[var(--av2-text-2)]">You don&apos;t have any requests yet.</p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {jobs.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                aria-current={job.id === currentTicketId ? "true" : undefined}
                onClick={() => onPick(job.id)}
                className={`${itemClass} ${job.id === currentTicketId ? "bg-[var(--av2-selected)] font-semibold" : ""}`}
              >
                <span className="min-w-0 truncate">{job.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {currentTicketId && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className={`${itemClass} mt-2 font-medium text-[var(--av2-error-text)]`}
        >
          Remove the link
        </button>
      )}
    </Modal>
  );
}
