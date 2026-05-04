// -----------------------------------------------------------------------------
// @file: app/talent/schedule/[token]/page.tsx
// @purpose: Public, anonymous booking page. Reachable only via the
//           tokenized URL emailed to the candidate after the SITE_OWNER
//           accepts. Renders one of five states based on the read-API
//           response:
//
//             - OFFER     three slot buttons + "propose another" link
//             - PROPOSED  "we got your time, waiting on review"
//             - BOOKED    confirmation card with Meet link
//             - EXPIRED   "this link expired, contact us"
//             - INVALID   "this link doesn't work" (404 from the API)
//
//           Same minimal layout chrome as /login — slim brand bar at top,
//           no marketing nav, focused conversion surface.
//
//           Deep links via search params:
//             ?slot=N     pre-selects offer N (0/1/2)
//             ?propose=1  jumps straight to the propose-form view
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FormInput, FormTextarea } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";

type Offer = {
  state: "OFFER";
  candidateName: string;
  candidateTimezone: string;
  proposedSlotsIso: string[];
  customMessage: string | null;
  expiresAt: string;
};
type Booked = {
  state: "BOOKED";
  candidateName: string;
  candidateTimezone: string;
  interviewAt: string;
  meetLink: string;
};
type Proposed = {
  state: "PROPOSED";
  candidateName: string;
  candidateTimezone: string;
  proposedAt: string;
};
type Empty = { state: "EXPIRED" } | { state: "INVALID" };
type ApiResponse = Offer | Booked | Proposed | Empty;

type Status =
  | "loading"
  | "ready"
  | "submitting"
  | "picked" // local "we just submitted /pick" state, before re-render
  | "proposed" // local "we just submitted /propose"
  | "error";

function formatSlot(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function TalentSchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const searchParams = useSearchParams();
  const initialSlotParam = searchParams.get("slot");
  const initialProposeParam = searchParams.get("propose") === "1";

  // Resolve params async (Next 15+ Promise<Params> contract).
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    params.then((p) => {
      if (!cancelled) setToken(p.token);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  // Pick state — index of selected offer (or null = none yet).
  const [pickedSlotIdx, setPickedSlotIdx] = useState<number | null>(
    initialSlotParam !== null ? Number(initialSlotParam) : null,
  );

  // Propose state — datetime-local string + optional note + show-flag.
  const [proposeOpen, setProposeOpen] = useState(initialProposeParam);
  const [proposeLocal, setProposeLocal] = useState("");
  const [proposeNote, setProposeNote] = useState("");

  // Local "we just succeeded" results so the page can render the success
  // state without round-tripping through the read API.
  const [bookedResult, setBookedResult] = useState<{
    interviewAt: string;
    meetLink: string;
  } | null>(null);
  const [proposedResult, setProposedResult] = useState<{ proposedAt: string } | null>(null);

  // -------- Initial fetch --------
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setStatus("loading");
    fetch(`/api/talent/schedule/${token}`, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as ApiResponse;
        if (cancelled) return;
        setData(body);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[talent-schedule] read failed", err);
        setError("Couldn't load the booking page. Please refresh.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const offer = useMemo(() => (data?.state === "OFFER" ? data : null), [data]);

  async function handlePick(idx: number) {
    if (!offer || !token) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch(`/api/talent/schedule/${token}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotIso: offer.proposedSlotsIso[idx] }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        interviewAt?: string;
        meetLink?: string;
        error?: string;
      } | null;
      if (!res.ok || !body?.ok || !body.interviewAt || !body.meetLink) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setBookedResult({ interviewAt: body.interviewAt, meetLink: body.meetLink });
      setStatus("picked");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed.");
      setStatus("ready");
    }
  }

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    if (!offer || !token || !proposeLocal) {
      setError("Pick a date and time first.");
      return;
    }
    setStatus("submitting");
    setError(null);
    try {
      const proposedIso = new Date(proposeLocal).toISOString();
      const res = await fetch(`/api/talent/schedule/${token}/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposedIso,
          note: proposeNote.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        proposedAt?: string;
        error?: string;
      } | null;
      if (!res.ok || !body?.ok || !body.proposedAt) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setProposedResult({ proposedAt: body.proposedAt });
      setStatus("proposed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Proposal failed.");
      setStatus("ready");
    }
  }

  // -------- Render --------
  return (
    <div className="min-h-screen bg-[var(--bb-bg-page)]">
      {/* Slim brand bar — same posture as /login */}
      <header className="border-b border-[var(--bb-border-subtle)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4">
          <Link href="/" className="text-xl font-bold text-[var(--bb-primary)]">
            brandbite
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        {status === "loading" && <LoadingState message="Loading your booking…" />}

        {status === "error" && (
          <InlineAlert variant="error" title="Something went wrong">
            {error ?? "Please refresh the page."}
          </InlineAlert>
        )}

        {/* Local success states — rendered directly so we don't refetch. */}
        {status === "picked" && bookedResult && offer && (
          <BookedView
            candidateName={offer.candidateName}
            interviewAt={bookedResult.interviewAt}
            meetLink={bookedResult.meetLink}
            timezone={offer.candidateTimezone}
          />
        )}

        {status === "proposed" && proposedResult && offer && (
          <ProposedView
            candidateName={offer.candidateName}
            proposedAt={proposedResult.proposedAt}
            timezone={offer.candidateTimezone}
          />
        )}

        {/* API-resolved states */}
        {status === "ready" && data?.state === "BOOKED" && (
          <BookedView
            candidateName={data.candidateName}
            interviewAt={data.interviewAt}
            meetLink={data.meetLink}
            timezone={data.candidateTimezone}
          />
        )}

        {status === "ready" && data?.state === "PROPOSED" && (
          <ProposedView
            candidateName={data.candidateName}
            proposedAt={data.proposedAt}
            timezone={data.candidateTimezone}
          />
        )}

        {status === "ready" && data?.state === "EXPIRED" && (
          <InlineAlert variant="warning" title="This booking link has expired">
            Booking links are valid for 7 days. Email{" "}
            <a className="underline" href="mailto:hello@brandbite.studio">
              hello@brandbite.studio
            </a>{" "}
            and we&apos;ll send a fresh one.
          </InlineAlert>
        )}

        {status === "ready" && data?.state === "INVALID" && (
          <InlineAlert variant="error" title="Booking link not found">
            This link doesn&apos;t match an active booking. Make sure you copied the full URL from
            your email.
          </InlineAlert>
        )}

        {/* OFFER — the main flow */}
        {(status === "ready" || status === "submitting") && offer && (
          <div className="space-y-6">
            <header>
              <h1 className="text-2xl font-bold text-[var(--bb-secondary)]">
                Hi {offer.candidateName}, pick a time
              </h1>
              <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">
                Times are shown in your timezone (<strong>{offer.candidateTimezone}</strong>). Pick
                a slot or propose another time.
              </p>
            </header>

            {offer.customMessage && (
              <div className="rounded-xl border border-[var(--bb-border-subtle)] bg-white p-4 text-sm text-[var(--bb-text-secondary)] italic">
                &ldquo;{offer.customMessage}&rdquo;
              </div>
            )}

            {error && <InlineAlert variant="error">{error}</InlineAlert>}

            {!proposeOpen && (
              <div className="space-y-3">
                {offer.proposedSlotsIso.map((iso, idx) => {
                  const isSelected = pickedSlotIdx === idx;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setPickedSlotIdx(idx)}
                      disabled={status === "submitting"}
                      className={`block w-full rounded-xl border p-4 text-left transition-colors ${
                        isSelected
                          ? "border-[var(--bb-primary)] bg-[var(--bb-primary)]/5"
                          : "border-[var(--bb-border)] bg-white hover:border-[var(--bb-border-strong)]"
                      }`}
                    >
                      <div className="text-xs font-semibold tracking-wider text-[var(--bb-text-muted)] uppercase">
                        Option {idx + 1}
                      </div>
                      <div className="mt-1 text-base font-medium text-[var(--bb-secondary)]">
                        {formatSlot(iso, offer.candidateTimezone)}
                      </div>
                    </button>
                  );
                })}

                <Button
                  className="w-full"
                  onClick={() => pickedSlotIdx !== null && handlePick(pickedSlotIdx)}
                  loading={status === "submitting"}
                  loadingText="Booking…"
                  disabled={pickedSlotIdx === null || status === "submitting"}
                >
                  Confirm this time
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setProposeOpen(true);
                    setError(null);
                  }}
                  className="block w-full text-center text-sm text-[var(--bb-primary)] hover:underline"
                >
                  None of these work? Propose another time
                </button>
              </div>
            )}

            {proposeOpen && (
              <form onSubmit={handlePropose} className="space-y-4">
                <h2 className="text-lg font-semibold text-[var(--bb-secondary)]">
                  Propose a different time
                </h2>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--bb-secondary)]">
                    Your preferred date and time
                  </span>
                  <FormInput
                    type="datetime-local"
                    value={proposeLocal}
                    onChange={(e) => setProposeLocal(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--bb-secondary)]">
                    Anything to add? (optional)
                  </span>
                  <FormTextarea
                    rows={3}
                    value={proposeNote}
                    onChange={(e) => setProposeNote(e.target.value)}
                    placeholder="e.g. Mornings work better for me, or could we do next Wednesday afternoon?"
                    maxLength={300}
                  />
                </label>
                <Button
                  type="submit"
                  className="w-full"
                  loading={status === "submitting"}
                  loadingText="Sending…"
                  disabled={!proposeLocal || status === "submitting"}
                >
                  Send my proposed time
                </Button>
                <button
                  type="button"
                  onClick={() => setProposeOpen(false)}
                  className="block w-full text-center text-sm text-[var(--bb-text-muted)] hover:underline"
                >
                  ← Back to the offered slots
                </button>
              </form>
            )}

            <p className="text-xs text-[var(--bb-text-muted)]">
              This link expires on{" "}
              {new Date(offer.expiresAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              .
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-views — kept inline because they're not reused outside this page.
// ---------------------------------------------------------------------------

function BookedView({
  candidateName,
  interviewAt,
  meetLink,
  timezone,
}: {
  candidateName: string;
  interviewAt: string;
  meetLink: string;
  timezone: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--bb-secondary)]">
          You&apos;re booked in, {candidateName} 🎉
        </h1>
        <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">
          We&apos;ve emailed you the confirmation and a calendar invite from Google.
        </p>
      </header>
      <div className="space-y-3 rounded-xl border border-[var(--bb-border)] bg-white p-5">
        <div>
          <div className="text-xs font-semibold tracking-wider text-[var(--bb-text-muted)] uppercase">
            When
          </div>
          <div className="mt-1 text-base text-[var(--bb-secondary)]">
            {formatSlot(interviewAt, timezone)} ({timezone})
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold tracking-wider text-[var(--bb-text-muted)] uppercase">
            Where
          </div>
          <a
            href={meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-base break-all text-[var(--bb-primary)] hover:underline"
          >
            {meetLink}
          </a>
        </div>
      </div>
    </div>
  );
}

function ProposedView({
  candidateName,
  proposedAt,
  timezone,
}: {
  candidateName: string;
  proposedAt: string;
  timezone: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--bb-secondary)]">Got it, {candidateName}</h1>
        <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">
          We&apos;ve sent your proposed time to the Brandbite team:
        </p>
      </header>
      <div className="rounded-xl border border-[var(--bb-border)] bg-white p-5">
        <div className="text-xs font-semibold tracking-wider text-[var(--bb-text-muted)] uppercase">
          You proposed
        </div>
        <div className="mt-1 text-base text-[var(--bb-secondary)]">
          {formatSlot(proposedAt, timezone)} ({timezone})
        </div>
      </div>
      <p className="text-sm text-[var(--bb-text-secondary)]">
        We&apos;ll review and email you back within a day or two — usually with a confirmation,
        sometimes with a small counter-proposal if there&apos;s a conflict.
      </p>
    </div>
  );
}
