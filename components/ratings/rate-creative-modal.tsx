// -----------------------------------------------------------------------------
// @file: components/ratings/rate-creative-modal.tsx
// @purpose: Customer-side modal for rating the creative after a ticket is
//           marked DONE. Multi-dimensional (quality / communication / speed,
//           each 1-5) with optional feedback. Skippable — submit is not
//           required for the ticket to remain DONE.
//
// Admin-only signal: the creative never sees these ratings directly. Copy
// in the modal reflects that ("helps us assign you great creatives in the
// future" rather than "send feedback to X").
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormTextarea } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";

type RateCreativeModalProps = {
  open: boolean;
  ticketId: string;
  ticketTitle: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

type Dimension = "quality" | "communication" | "speed";

const DIMENSIONS: { key: Dimension; label: string; hint: string }[] = [
  { key: "quality", label: "Quality", hint: "How well did the result match what you needed?" },
  {
    key: "communication",
    label: "Communication",
    hint: "Clarity, responsiveness, and updates throughout.",
  },
  { key: "speed", label: "Speed", hint: "How fast was the delivery relative to your expectation?" },
];

function StarRow({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            role="radio"
            aria-checked={filled}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            className={`rounded-md p-1 text-2xl leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bb-primary)] ${
              filled ? "text-[var(--bb-primary)]" : "text-[var(--bb-border)]"
            }`}
          >
            {filled ? "\u2605" : "\u2606"}
          </button>
        );
      })}
    </div>
  );
}

export function RateCreativeModal({
  open,
  ticketId,
  ticketTitle,
  onClose,
  onSubmitted,
}: RateCreativeModalProps) {
  const [quality, setQuality] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const allScored = quality > 0 && communication > 0 && speed > 0;

  const handleSubmit = async () => {
    if (!allScored) {
      setError("Please score all three dimensions before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/customer/tickets/${ticketId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quality,
          communication,
          speed,
          feedback: feedback.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || "Could not submit the rating.");
        return;
      }
      onSubmitted?.();
      onClose();
    } catch (err) {
      console.error("[RateCreativeModal] submit failed", err);
      setError("Unexpected error while submitting the rating.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-creative-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <header className="mb-5">
          <h2
            id="rate-creative-modal-title"
            className="font-brand text-xl font-bold text-[var(--bb-secondary)]"
          >
            How did this request go?
          </h2>
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            Your feedback helps us match you with the right creatives next time.
          </p>
          {ticketTitle && (
            <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">
              <span className="font-semibold">{ticketTitle}</span>
            </p>
          )}
        </header>

        <div className="space-y-4">
          {DIMENSIONS.map(({ key, label, hint }) => {
            const value =
              key === "quality" ? quality : key === "communication" ? communication : speed;
            const setter =
              key === "quality"
                ? setQuality
                : key === "communication"
                  ? setCommunication
                  : setSpeed;
            return (
              <div key={key}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--bb-secondary)]">{label}</p>
                    <p className="text-[11px] text-[var(--bb-text-muted)]">{hint}</p>
                  </div>
                  <StarRow value={value} onChange={setter} label={label} />
                </div>
              </div>
            );
          })}

          <div>
            <label className="mb-1 block text-xs font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
              Anything else? (optional)
            </label>
            <FormTextarea
              placeholder="Notes for our team — not shared with the creative."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
            />
          </div>

          {error && <InlineAlert variant="error">{error}</InlineAlert>}
        </div>

        <footer className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={handleSkip} disabled={submitting}>
            Skip
          </Button>
          <Button onClick={handleSubmit} loading={submitting} loadingText="Submitting...">
            Submit rating
          </Button>
        </footer>
      </div>
    </div>
  );
}
