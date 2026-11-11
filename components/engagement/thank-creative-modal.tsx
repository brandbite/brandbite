// -----------------------------------------------------------------------------
// @file: components/engagement/thank-creative-modal.tsx
// @purpose: Opens when a customer approves a delivery. One window, two parts:
//
//           1. "Thank your creative": one-tap tags the creative gets to see
//              (notification, profile, portfolio).
//           2. A small optional rating for brandbite (quality, communication,
//              speed). Only our team sees it; it feeds creative matching.
//
//           Either part can be skipped. ApprovalFeedbackModal picks between
//           this and the older rating-only window by the owner's switch.
// -----------------------------------------------------------------------------

"use client";

import { useId, useState } from "react";

import { Button } from "@/components/admin/v2/ui";
import { RateCreativeModal } from "@/components/ratings/rate-creative-modal";
import { Modal } from "@/components/ui/modal";
import { THANKS_TAG_LABELS, THANKS_TAGS, type ThanksTag } from "@/lib/engagement/thanks";
import { useEngagementSwitches } from "@/lib/hooks/use-engagement-switches";

type Props = {
  open: boolean;
  ticketId: string;
  ticketTitle: string;
  onClose: () => void;
};

const DIMENSIONS = [
  { key: "quality", label: "Quality" },
  { key: "communication", label: "Communication" },
  { key: "speed", label: "Speed" },
] as const;

type Dimension = (typeof DIMENSIONS)[number]["key"];

function Stars({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      <div className="flex items-center" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            // Tapping the current score again clears it.
            onClick={() => onChange(n === value ? 0 : n)}
            className={`flex h-9 w-8 items-center justify-center rounded-md text-xl leading-none focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none ${
              n <= value ? "text-[var(--av2-accent)]" : "text-[var(--av2-border)]"
            }`}
          >
            {n <= value ? "★" : "☆"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ThankCreativeModal({ open, ticketId, onClose }: Props) {
  const titleId = useId();
  const [tags, setTags] = useState<ThanksTag[]>([]);
  const [scores, setScores] = useState<Record<Dimension, number>>({
    quality: 0,
    communication: 0,
    speed: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const scored = DIMENSIONS.filter((d) => scores[d.key] > 0).length;
  const nothingChosen = tags.length === 0 && scored === 0;

  const toggle = (tag: ThanksTag) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`/api/customer/tickets/${ticketId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok || res.status === 409) return; // 409: already sent, nothing to redo
    const json = await res.json().catch(() => null);
    throw new Error(json?.error || "Something went wrong. Please try again.");
  };

  const submit = async () => {
    if (scored > 0 && scored < DIMENSIONS.length) {
      setError("Score all three, or clear the stars to skip the rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (tags.length > 0) await post("thanks", { tags });
      if (scored === DIMENSIONS.length) await post("rating", scores);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={submitting ? () => {} : onClose} size="lg" labelledBy={titleId}>
      <div className="text-[var(--av2-text)]">
        <div className="flex items-start justify-between gap-4">
          <p className="flex items-center gap-3 text-xl font-semibold text-[#256b3a] dark:text-[#7fd396]">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2f7a45] text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 12.5 10 17 19 7.5"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Delivery approved
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
          >
            &times;
          </button>
        </div>

        <h2 id={titleId} className="mt-5 text-2xl leading-8 font-semibold">
          Thank your creative
        </h2>
        <p className="mt-1 text-base text-[var(--av2-text-2)]">
          Tap any tags to let them know what went well.
        </p>

        <div className="mt-5 space-y-3">
          {THANKS_TAGS.map((tag) => {
            const checked = tags.includes(tag);
            return (
              <label
                key={tag}
                className={`flex min-h-14 cursor-pointer items-center gap-4 rounded-xl border px-4 text-lg font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--av2-accent)] ${
                  checked
                    ? "border-[var(--av2-fill-green)] bg-[var(--av2-success-bg)]"
                    : "border-[var(--av2-border)] hover:border-[var(--av2-text-2)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(tag)}
                  className="h-5 w-5 shrink-0 accent-[#2f7a45]"
                />
                {THANKS_TAG_LABELS[tag]}
              </label>
            );
          })}
        </div>

        <fieldset className="mt-6 border-t border-[var(--av2-border)] pt-5">
          <legend className="sr-only">Private rating for brandbite</legend>
          <p className="text-sm font-semibold">Rate this request for brandbite (optional)</p>
          <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
            Only our team sees this, not your creative. It helps us match you with the right people.
          </p>
          <div className="mt-2 space-y-0.5">
            {DIMENSIONS.map((d) => (
              <Stars
                key={d.key}
                label={d.label}
                value={scores[d.key]}
                onChange={(n) => setScores((prev) => ({ ...prev, [d.key]: n }))}
              />
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-[var(--av2-error-text)]">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Skip
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting || nothingChosen}>
            {submitting ? "Sending…" : tags.length > 0 ? "Send thanks" : "Send"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * What opens after an approval: the thank-you window when the owner has
 * switched thank-yous on, otherwise the rating-only window as before.
 */
export function ApprovalFeedbackModal(props: Props) {
  const { thankYous } = useEngagementSwitches();
  return thankYous ? <ThankCreativeModal {...props} /> : <RateCreativeModal {...props} />;
}
