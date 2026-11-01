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

import { Field, TextArea, TextInput } from "@/components/admin/v2/ui";
import { useToast } from "@/components/ui/toast-provider";

import {
  AddButton,
  BlockSaveFooter,
  FormSection,
  RepeaterItem,
  ReorderActions,
  Req,
  useDirtyBaseline,
} from "./block-form-ui";

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

  // Presentation only: drives the SaveBar status + disables Save when clean.
  const { dirty, markSaved } = useDirtyBaseline(JSON.stringify([eyebrow, title, steps]));

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

      markSaved();
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
      <FormSection title="Section heading" description="Both optional.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_2fr]">
          <Field label="Eyebrow (optional)" htmlFor="hiw-eyebrow">
            <TextInput
              id="hiw-eyebrow"
              value={eyebrow}
              onChange={(e) => setEyebrow(e.target.value)}
              placeholder="HOW IT WORKS"
              maxLength={50}
            />
          </Field>
          <Field label="Section title (optional)" htmlFor="hiw-title">
            <TextInput
              id="hiw-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Three steps to your first design"
              maxLength={120}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Steps"
        count={`${steps.length} / ${MAX_STEPS}`}
        action={
          <AddButton onClick={addStep} disabled={steps.length >= MAX_STEPS}>
            Add step
          </AddButton>
        }
      >
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <RepeaterItem
              key={idx}
              label={`Step ${idx + 1}`}
              actions={
                <ReorderActions
                  noun={`step ${idx + 1}`}
                  index={idx}
                  count={steps.length}
                  onMove={(d) => moveStep(idx, d)}
                  onRemove={() => removeStep(idx)}
                  removeDisabled={steps.length <= MIN_STEPS}
                />
              }
            >
              <div className="space-y-4">
                <Field
                  label={
                    <>
                      Title
                      <Req />
                    </>
                  }
                  htmlFor={`hiw-step-title-${idx}`}
                >
                  <TextInput
                    id={`hiw-step-title-${idx}`}
                    value={step.title}
                    onChange={(e) => updateStep(idx, { title: e.target.value })}
                    placeholder="Submit a creative request"
                    maxLength={80}
                  />
                </Field>
                <Field
                  label={
                    <>
                      Description
                      <Req />
                    </>
                  }
                  htmlFor={`hiw-step-desc-${idx}`}
                >
                  <TextArea
                    id={`hiw-step-desc-${idx}`}
                    value={step.description}
                    onChange={(e) => updateStep(idx, { description: e.target.value })}
                    placeholder="Short sentence explaining what happens at this step."
                    rows={2}
                    maxLength={300}
                    className="min-h-20"
                  />
                </Field>
              </div>
            </RepeaterItem>
          ))}
        </div>
      </FormSection>

      <BlockSaveFooter
        error={error}
        dirty={dirty}
        submitting={submitting}
        label="Save how it works"
      />
    </form>
  );
}
