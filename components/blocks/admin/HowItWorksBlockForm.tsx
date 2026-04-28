// -----------------------------------------------------------------------------
// @file: components/blocks/admin/HowItWorksBlockForm.tsx
// @purpose: Admin form for editing the HOW_IT_WORKS block. Optional
//           eyebrow + title above a list of 1-to-5 step rows. Each step
//           row has a title and description. Saves via
//           PUT /api/admin/page-blocks/[pageKey]/HOW_IT_WORKS.
//
//           Constrained editing (3 to 5 steps cap): the section's grid
//           layout breaks down past 5, and below 1 there's nothing to
//           render. The cap also keeps the schema honest — Zod enforces
//           the same 1-5 range server-side.
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-28
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast-provider";

import type { HowItWorksData } from "@/lib/blocks/types";

type HowItWorksBlockFormProps = {
  /** Initial values — DB row's data when present, defaults otherwise. */
  initial: HowItWorksData;
  /** Page key the block belongs to (e.g. "home"). */
  pageKey: string;
};

/** Hard cap on rows. Mirrors the Zod schema in lib/blocks/types.ts so the
 *  client can fail fast before a save round-trip. */
const MIN_STEPS = 1;
const MAX_STEPS = 5;

type StepDraft = { title: string; description: string };

export function HowItWorksBlockForm({ initial, pageKey }: HowItWorksBlockFormProps) {
  const { showToast } = useToast();

  const [eyebrow, setEyebrow] = useState<string>(initial.eyebrow ?? "");
  const [title, setTitle] = useState<string>(initial.title ?? "");
  const [steps, setSteps] = useState<StepDraft[]>(
    // Defensive deep-copy — every step is a fresh object so React state
    // updates don't accidentally mutate the caller's defaults.
    initial.steps.map((s) => ({ title: s.title, description: s.description })),
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStep = (idx: number, patch: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    if (steps.length >= MAX_STEPS) return;
    setSteps((prev) => [...prev, { title: "", description: "" }]);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= MIN_STEPS) return;
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    if (steps.length < MIN_STEPS) {
      setError("At least one step is required.");
      return;
    }
    if (steps.length > MAX_STEPS) {
      setError(`No more than ${MAX_STEPS} steps allowed.`);
      return;
    }
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (!s.title.trim()) {
        setError(`Step ${i + 1} needs a title.`);
        return;
      }
      if (!s.description.trim()) {
        setError(`Step ${i + 1} needs a description.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const data: HowItWorksData = {
        ...(eyebrow.trim() ? { eyebrow: eyebrow.trim() } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        steps: steps.map((s) => ({
          title: s.title.trim(),
          description: s.description.trim(),
        })),
      };

      const res = await fetch(`/api/admin/page-blocks/${pageKey}/HOW_IT_WORKS`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        reason?: string;
      } | null;
      if (!res.ok) {
        throw new Error(json?.reason || json?.error || "Save failed.");
      }

      showToast({
        type: "success",
        title: "How it works saved",
        description: "Reload the landing page to see your changes.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Eyebrow + title (both optional) ------------------------------ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr]">
        <div>
          <label
            htmlFor="hiw-eyebrow"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Eyebrow (optional)
          </label>
          <FormInput
            id="hiw-eyebrow"
            value={eyebrow}
            onChange={(e) => setEyebrow(e.target.value)}
            placeholder="HOW IT WORKS"
            maxLength={50}
          />
        </div>
        <div>
          <label
            htmlFor="hiw-title"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Section title (optional)
          </label>
          <FormInput
            id="hiw-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Three steps to your first design"
            maxLength={120}
          />
        </div>
      </div>

      {/* Steps -------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">
            Steps ({steps.length}/{MAX_STEPS})
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addStep}
            disabled={steps.length >= MAX_STEPS}
          >
            Add step
          </Button>
        </div>

        {steps.map((step, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] px-4 py-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
                Step {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveStep(idx, -1)}
                  disabled={idx === 0}
                  aria-label={`Move step ${idx + 1} up`}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveStep(idx, 1)}
                  disabled={idx === steps.length - 1}
                  aria-label={`Move step ${idx + 1} down`}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStep(idx)}
                  disabled={steps.length <= MIN_STEPS}
                  aria-label={`Remove step ${idx + 1}`}
                >
                  Remove
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor={`hiw-step-title-${idx}`}
                  className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
                >
                  Title <span className="text-[var(--bb-primary)]">*</span>
                </label>
                <FormInput
                  id={`hiw-step-title-${idx}`}
                  value={step.title}
                  onChange={(e) => updateStep(idx, { title: e.target.value })}
                  placeholder="Submit a creative request"
                  maxLength={80}
                />
              </div>
              <div>
                <label
                  htmlFor={`hiw-step-desc-${idx}`}
                  className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
                >
                  Description <span className="text-[var(--bb-primary)]">*</span>
                </label>
                <textarea
                  id={`hiw-step-desc-${idx}`}
                  value={step.description}
                  onChange={(e) => updateStep(idx, { description: e.target.value })}
                  placeholder="Short sentence explaining what happens at this step."
                  rows={2}
                  maxLength={300}
                  className="w-full rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Error + submit ---------------------------------------------- */}
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          loadingText="Saving…"
          disabled={submitting}
        >
          Save how it works
        </Button>
      </div>
    </form>
  );
}
