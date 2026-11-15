// -----------------------------------------------------------------------------
// @file: components/brand/onboarding-brand-step.tsx
// @purpose: The short "about your brand" step of customer onboarding: what
//           the company does, who it's for, a few tone words and a logo.
//           Everything is optional and lands in the brand guide, where it
//           can be filled out later.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

"use client";

import { useRef, useState, type ReactNode } from "react";

import { Button, Callout, Field, TextArea, TextInput } from "@/components/admin/v2/ui";
import { BRAND_FILE_ACCEPT, brandFileProblem } from "@/lib/brand/brand-files";
import { uploadBrandFile } from "@/lib/brand/upload-brand-file";

/** "warm, direct; playful" → ["warm", "direct", "playful"]. */
export function splitToneWords(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,;\n]+/)
        .map((word) => word.trim())
        .filter(Boolean),
    ),
  ].slice(0, 12);
}

export function OnboardingBrandStep({
  onDone,
  renderActions,
}: {
  /** Called to move on. `saved` says whether anything went into the guide. */
  onDone: (saved: boolean) => void;
  /** The wizard's footer, so this step's buttons sit where the others do. */
  renderActions: (actions: ReactNode) => ReactNode;
}) {
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const toneWords = splitToneWords(tone);
  const hasText = !!description.trim() || !!audience.trim() || toneWords.length > 0;
  const hasAnything = hasText || !!logo;

  const pickLogo = (file: File | null) => {
    setError(null);
    if (!file) return setLogo(null);
    const problem = brandFileProblem(file);
    if (problem) {
      setLogo(null);
      if (fileInput.current) fileInput.current.value = "";
      return setError(problem);
    }
    setLogo(file);
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      if (hasText) {
        const res = await fetch("/api/customer/brand", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description, audience, toneWords }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(json?.error ?? "Could not save your brand details.");
        }
      }
      if (logo) await uploadBrandFile(logo, "LOGO_PRIMARY");
      onDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your brand details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <h1 className="text-[32px] leading-10 font-bold tracking-tight">Tell us about your brand</h1>
      <p className="mt-2 text-sm text-[var(--av2-text-2)]">
        A few lines are enough. Your creatives read this before they start, and you can add colors,
        fonts and more in your brand guide later.
      </p>

      <div className="mt-6 space-y-5">
        <Field
          htmlFor="onb-brand-description"
          label="What does your company do?"
          hint="Two or three sentences."
        >
          <TextArea
            id="onb-brand-description"
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. We deliver fresh coffee to small offices every week."
          />
        </Field>
        <Field htmlFor="onb-brand-audience" label="Who is it for?">
          <TextArea
            id="onb-brand-audience"
            rows={2}
            maxLength={2000}
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. Office managers at companies with 10 to 50 people."
          />
        </Field>
        <Field
          htmlFor="onb-brand-tone"
          label="Three words for how your brand sounds"
          hint="Separate them with commas."
        >
          <TextInput
            id="onb-brand-tone"
            type="text"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="e.g. warm, direct, playful"
          />
        </Field>
        <Field
          htmlFor="onb-brand-logo"
          label="Your logo"
          hint="A vector file (SVG, AI, EPS or PDF) is best. PNG works too."
        >
          <input
            ref={fileInput}
            id="onb-brand-logo"
            type="file"
            accept={BRAND_FILE_ACCEPT}
            onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border file:border-solid file:border-[var(--av2-border)] file:bg-[var(--av2-surface)] file:px-4 file:text-sm file:font-semibold file:text-[var(--av2-text)]"
          />
        </Field>
      </div>

      {error && (
        <div className="mt-5">
          <Callout tone="error" title={error} />
        </div>
      )}

      {renderActions(
        <>
          <Button disabled={saving} onClick={() => onDone(false)}>
            Skip
          </Button>
          <Button
            variant="primary"
            disabled={saving || !hasAnything}
            aria-busy={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save and continue"}
          </Button>
        </>,
      )}
    </div>
  );
}
