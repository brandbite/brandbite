// -----------------------------------------------------------------------------
// @file: app/customer/consultation/page.tsx
// @purpose: Company OWNER/PM view for booking a consultation and tracking the
//           status of past / pending requests. Token-costed; form debits the
//           tokens on submit, admin schedules out-of-band.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormInput, FormTextarea } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";

type ConsultationStatus = "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELED";

type ConsultationRow = {
  id: string;
  description: string;
  preferredTimes: string[] | null;
  timezone: string | null;
  scheduledAt: string | null;
  videoLink: string | null;
  tokenCost: number;
  status: ConsultationStatus;
  createdAt: string;
  updatedAt: string;
  requestedBy: { id: string; name: string | null; email: string };
};

type ConsultationResponse = {
  consultations: ConsultationRow[];
  tokenCost: number;
};

type CompanyRole = "OWNER" | "PM" | "BILLING" | "MEMBER";

const STATUS_LABEL: Record<ConsultationStatus, string> = {
  PENDING: "Awaiting scheduling",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
};

const STATUS_VARIANT: Record<ConsultationStatus, "info" | "success" | "warning" | "neutral"> = {
  PENDING: "warning",
  SCHEDULED: "info",
  COMPLETED: "success",
  CANCELED: "neutral",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function CustomerConsultationPage() {
  const [rows, setRows] = useState<ConsultationRow[]>([]);
  const [tokenCost, setTokenCost] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyRole, setCompanyRole] = useState<CompanyRole | null>(null);
  const [companyRoleLoading, setCompanyRoleLoading] = useState(true);

  // Form state
  const [description, setDescription] = useState("");
  const [timezone, setTimezone] = useState<string>(() =>
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
  );
  const [slot1, setSlot1] = useState("");
  const [slot2, setSlot2] = useState("");
  const [slot3, setSlot3] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/consultations", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ConsultationResponse | null;
      if (!res.ok || !json) {
        throw new Error("Failed to load consultations.");
      }
      setRows(json.consultations);
      setTokenCost(json.tokenCost);
    } catch (err) {
      console.error("[CustomerConsultationPage] load error", err);
      setError(err instanceof Error ? err.message : "Failed to load consultations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Company role
  useEffect(() => {
    let cancelled = false;
    fetch("/api/customer/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const role = json?.user?.companyRole ?? null;
        if (["OWNER", "PM", "BILLING", "MEMBER"].includes(role)) {
          setCompanyRole(role);
        } else {
          setCompanyRole(null);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCompanyRoleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canBook = companyRole === "OWNER" || companyRole === "PM";

  const preferredSlots = useMemo(
    () => [slot1, slot2, slot3].map((s) => s.trim()).filter(Boolean),
    [slot1, slot2, slot3],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canBook) return;
    if (description.trim().length < 10) {
      setFormError("Tell us a bit more about what you want to discuss (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/customer/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          preferredTimes: preferredSlots.length > 0 ? preferredSlots : undefined,
          timezone: timezone.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError((json && json.error) || "Could not submit the consultation request.");
        return;
      }
      setSuccessMessage(
        `Request submitted. Your team will email you with a time slot. (${tokenCost} tokens debited.)`,
      );
      setDescription("");
      setSlot1("");
      setSlot2("");
      setSlot3("");
      load();
    } catch (err) {
      console.error("[CustomerConsultationPage] submit error", err);
      setFormError("Unexpected error while submitting.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 md:px-0">
      <header className="mb-6">
        <p className="text-xs font-bold tracking-[0.2em] text-[var(--bb-primary)] uppercase">
          Consultation
        </p>
        <h1 className="font-brand mt-2 text-3xl font-bold tracking-tight text-[var(--bb-secondary)] sm:text-4xl">
          Book a call with our team
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--bb-text-secondary)]">
          Get a 30-minute video consultation with the Brandbite team. Tell us what you want to
          discuss and when you&apos;re available, and we&apos;ll confirm a slot by email with a
          video link.
        </p>
      </header>

      {/* Access gate */}
      {!companyRoleLoading && !canBook && (
        <InlineAlert variant="info" className="mb-6">
          Consultations are available to company <strong>Owners</strong> and <strong>PM</strong>{" "}
          members. Ask a teammate with one of those roles to book on your behalf.
        </InlineAlert>
      )}

      {/* Form (only if user has permission) */}
      {canBook && (
        <section className="mb-10 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--bb-secondary)]">
              New consultation request
            </h2>
            <span className="rounded-full bg-[var(--bb-bg-warm)] px-3 py-1 text-[11px] font-semibold text-[var(--bb-secondary)]">
              {tokenCost} tokens
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                What do you want to discuss?
              </label>
              <FormTextarea
                placeholder="e.g. We want to refresh our brand identity across web + packaging before a product launch."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Preferred time slots (optional)
              </label>
              <p className="mb-2 text-[11px] text-[var(--bb-text-muted)]">
                Free-form — e.g. &quot;Tue 14:00&quot; or &quot;Thursday morning&quot;. Admin will
                confirm one.
              </p>
              <div className="space-y-2">
                <FormInput
                  placeholder="Slot 1"
                  value={slot1}
                  onChange={(e) => setSlot1(e.target.value)}
                />
                <FormInput
                  placeholder="Slot 2"
                  value={slot2}
                  onChange={(e) => setSlot2(e.target.value)}
                />
                <FormInput
                  placeholder="Slot 3"
                  value={slot3}
                  onChange={(e) => setSlot3(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Timezone
              </label>
              <FormInput
                placeholder="e.g. Europe/Istanbul"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>

            {formError && <InlineAlert variant="error">{formError}</InlineAlert>}
            {successMessage && <InlineAlert variant="success">{successMessage}</InlineAlert>}

            <div>
              <Button
                type="submit"
                loading={submitting}
                loadingText="Submitting..."
                disabled={description.trim().length < 10 || !canBook}
              >
                Submit request — {tokenCost} tokens
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* History */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">
          Your consultations
        </h2>

        {loading && <LoadingState />}
        {error && <InlineAlert variant="error">{error}</InlineAlert>}

        {!loading && !error && rows.length === 0 && (
          <EmptyState
            title="No consultations yet"
            description="Requests you submit will show up here with their current status."
          />
        )}

        {rows.length > 0 && (
          <div className="space-y-3">
            {rows.map((c) => (
              <article
                key={c.id}
                className="rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-4"
              >
                <header className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    <p className="mt-2 text-xs text-[var(--bb-text-muted)]">
                      Requested {formatDateTime(c.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--bb-text-tertiary)]">
                    {c.tokenCost} tokens
                  </span>
                </header>

                <p className="mb-3 line-clamp-3 text-sm text-[var(--bb-text-secondary)]">
                  {c.description}
                </p>

                {c.status === "SCHEDULED" && (
                  <div className="mt-2 rounded-lg border border-[var(--bb-border-subtle)] bg-white p-3 text-xs">
                    <p className="text-[var(--bb-text-muted)]">Scheduled for</p>
                    <p className="mt-0.5 font-semibold text-[var(--bb-secondary)]">
                      {formatDateTime(c.scheduledAt)}
                    </p>
                    {c.videoLink && (
                      <a
                        href={c.videoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block break-all text-[var(--bb-primary)] hover:underline"
                      >
                        Join call ↗
                      </a>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
