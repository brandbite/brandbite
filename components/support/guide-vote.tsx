// -----------------------------------------------------------------------------
// @file: components/support/guide-vote.tsx
// @purpose: "Was this helpful?" at the end of a Support guide. One answer per
//           person per guide; picking the other button changes it.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useState } from "react";

const ENDPOINT = "/api/support/guide-votes";

function buttonClass(selected: boolean) {
  return `inline-flex min-h-10 min-w-16 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none disabled:opacity-60 ${
    selected
      ? "border-[var(--av2-accent)] bg-[var(--av2-selected)] text-[var(--av2-link)]"
      : "border-[var(--av2-border)] bg-[var(--av2-surface)] hover:bg-[var(--av2-bg)]"
  }`;
}

export function GuideVote({ slug }: { slug: string }) {
  const headingId = useId();
  const [vote, setVote] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${ENDPOINT}?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (alive && typeof json?.helpful === "boolean") setVote(json.helpful);
      })
      // Not knowing the earlier answer doesn't stop anyone from giving one.
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const cast = async (helpful: boolean) => {
    if (helpful === vote) return;
    const previous = vote;
    setVote(helpful);
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch(ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, helpful }),
      });
      if (!res.ok) throw new Error(`Vote failed: ${res.status}`);
    } catch {
      setVote(previous);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const disabled = !loaded || saving;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-5"
    >
      <h2 id={headingId} className="text-lg leading-7 font-semibold">
        Was this helpful?
      </h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {failed ? (
          <p role="alert" className="min-w-0 flex-1 basis-40 text-sm text-[var(--av2-error-text)]">
            We couldn&apos;t save your answer. Please try again.
          </p>
        ) : (
          <p role="status" className="min-w-0 flex-1 basis-40 text-sm text-[var(--av2-text-2)]">
            {vote !== null
              ? "Thanks for letting us know. You can change your answer."
              : "Your answer helps us improve this guide."}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={vote === true}
            disabled={disabled}
            onClick={() => cast(true)}
            className={buttonClass(vote === true)}
          >
            Yes
          </button>
          <button
            type="button"
            aria-pressed={vote === false}
            disabled={disabled}
            onClick={() => cast(false)}
            className={buttonClass(vote === false)}
          >
            No
          </button>
        </div>
      </div>
    </section>
  );
}
