// -----------------------------------------------------------------------------
// @file: components/brief/brief-generator.tsx
// @purpose: The creative brief generator: a guided form beside a live preview,
//           with copy, download and print-to-PDF. The draft stays in this
//           browser only (localStorage); nothing is sent anywhere.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { CheckIcon, CopyIcon, DownloadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { useStudioCopy } from "@/components/colors/studio/use-studio-copy";
import {
  briefFileName,
  briefProgress,
  briefSections,
  briefToMarkdown,
  briefToText,
  EMPTY_BRIEF,
  EXAMPLE_BRIEF,
  parseStoredBrief,
  PROJECT_TYPES,
  SUGGESTED_DELIVERABLES,
  TONES,
  type Brief,
} from "@/lib/brief/brief";
import { normalizeHex } from "@/lib/colors";

import "./brief-print.css";

const STORAGE_KEY = "bb-brief-draft";

const INPUT =
  "w-full rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2.5 text-base leading-6 placeholder:text-[#8a8b93] focus:border-[var(--cs-text)]";

function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm leading-5 font-semibold">
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm leading-5 text-[var(--cs-muted)]">{hint}</p> : null}
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5">
      <h2 className="flex items-center gap-3 text-lg leading-7 font-semibold">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cs-soft)] text-sm text-[var(--cs-soft-text)]">
          {number}
        </span>
        {title}
      </h2>
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Toggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-2 text-left text-sm leading-5 font-medium transition-colors ${
        pressed
          ? "border-[var(--cs-text)] bg-[var(--cs-text)] text-white"
          : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]"
      }`}
    >
      {pressed ? <CheckIcon /> : null}
      {children}
    </button>
  );
}

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}

function downloadText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** HEX codes found in free text, for swatches next to the colors field. */
function hexesIn(text: string): string[] {
  const found = text.match(/#?[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? [];
  return [
    ...new Set(found.map((value) => normalizeHex(value)).filter((v): v is string => !!v)),
  ].slice(0, 12);
}

export function BriefPreview({ brief }: { brief: Brief }) {
  const sections = briefSections(brief);
  return (
    <article className="brief-print flex flex-col gap-5 text-sm leading-5">
      <h2 className="text-2xl leading-8 font-bold break-words">
        {brief.projectName.trim() || "Creative brief"}
      </h2>
      {sections.length === 0 ? (
        <p className="text-[var(--cs-muted)]">Your brief appears here as you fill in the form.</p>
      ) : (
        sections.map((section) => (
          <section key={section.heading}>
            <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-[var(--cs-muted)] uppercase">
              {section.heading}
            </h3>
            {section.rows.every((row) => !row.label) ? (
              <ul className="list-disc pl-5">
                {section.rows.map((row) => (
                  <li key={row.value} className="break-words whitespace-pre-line">
                    {row.value}
                  </li>
                ))}
              </ul>
            ) : (
              <dl className="flex flex-col gap-1.5">
                {section.rows.map((row) => (
                  <div key={row.label}>
                    <dt className="inline font-semibold">{row.label}: </dt>
                    <dd className="inline break-words whitespace-pre-line">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))
      )}
    </article>
  );
}

export function BriefGenerator() {
  const id = useId();
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [loaded, setLoaded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [customDeliverable, setCustomDeliverable] = useState("");
  const { copy, isCopied } = useStudioCopy();
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore the draft after hydration, so server and client HTML match.
  useEffect(() => {
    try {
      const saved = parseStoredBrief(window.localStorage.getItem(STORAGE_KEY));
      // Reading storage during render would make server and client HTML differ.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setBrief(saved);
    } catch {
      // Storage blocked (private window, policy): start empty.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(brief));
      } catch {
        // Saving is a convenience only.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [brief, loaded]);

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    [],
  );

  function set<K extends keyof Brief>(key: K, value: Brief[K]) {
    setBrief((current) => ({ ...current, [key]: value }));
  }

  function text(key: keyof Brief) {
    return {
      id: `${id}-${key}`,
      value: brief[key] as string,
      onChange: (event: { target: { value: string } }) => set(key, event.target.value as never),
    };
  }

  function clear() {
    if (!confirmClear) {
      setConfirmClear(true);
      clearTimer.current = setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    setConfirmClear(false);
    setBrief(EMPTY_BRIEF);
  }

  function addCustomDeliverable() {
    const value = customDeliverable.trim();
    if (!value) return;
    if (!brief.deliverables.includes(value)) set("deliverables", [...brief.deliverables, value]);
    setCustomDeliverable("");
  }

  const progress = briefProgress(brief);
  const suggestions = brief.projectType ? SUGGESTED_DELIVERABLES[brief.projectType] : [];
  const custom = brief.deliverables.filter((item) => !suggestions.includes(item));
  const swatches = hexesIn(brief.brandColors);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_420px] items-start gap-6 max-[1023px]:grid-cols-1">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={studioButtonClasses("secondary")}
            onClick={() => setBrief(EXAMPLE_BRIEF)}
          >
            Fill with an example
          </button>
          <button type="button" className={studioButtonClasses("tertiary")} onClick={clear}>
            {confirmClear ? "Click again to clear everything" : "Start over"}
          </button>
          <p className="text-sm leading-5 text-[var(--cs-muted)]">
            Saved in this browser only. Nothing is sent to us.
          </p>
        </div>

        <Step number={1} title="The project">
          <Field label="Project name" htmlFor={`${id}-projectName`}>
            <input
              {...text("projectName")}
              className={INPUT}
              placeholder="Spring launch campaign"
              maxLength={120}
            />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm leading-5 font-semibold">What do you need?</legend>
            <div className="flex flex-wrap gap-2">
              {PROJECT_TYPES.map((type) => (
                <Toggle
                  key={type.id}
                  pressed={brief.projectType === type.id}
                  onClick={() => set("projectType", brief.projectType === type.id ? "" : type.id)}
                >
                  {type.label}
                </Toggle>
              ))}
            </div>
          </fieldset>
          <Field
            label="Summary"
            htmlFor={`${id}-summary`}
            hint="One or two sentences a designer could repeat back to you."
          >
            <textarea {...text("summary")} className={INPUT} rows={2} maxLength={600} />
          </Field>
        </Step>

        <Step number={2} title="Background">
          <Field label="Company or brand" htmlFor={`${id}-company`}>
            <input {...text("company")} className={INPUT} maxLength={120} />
          </Field>
          <Field label="What it does" htmlFor={`${id}-companyDescription`}>
            <textarea {...text("companyDescription")} className={INPUT} rows={2} maxLength={600} />
          </Field>
          <Field
            label="Who is it for?"
            htmlFor={`${id}-audience`}
            hint="Who they are, what they care about, and what they think of you today."
          >
            <textarea {...text("audience")} className={INPUT} rows={3} maxLength={1000} />
          </Field>
        </Step>

        <Step number={3} title="The goal">
          <Field
            label="Objective"
            htmlFor={`${id}-objective`}
            hint="What should change because of this work? Be specific."
          >
            <textarea {...text("objective")} className={INPUT} rows={2} maxLength={600} />
          </Field>
          <Field label="How will you measure it?" htmlFor={`${id}-successMeasure`}>
            <input {...text("successMeasure")} className={INPUT} maxLength={300} />
          </Field>
        </Step>

        <Step number={4} title="Message and tone">
          <Field
            label="Key message"
            htmlFor={`${id}-keyMessage`}
            hint="The one thing people should remember."
          >
            <input {...text("keyMessage")} className={INPUT} maxLength={300} />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm leading-5 font-semibold">Tone (pick up to 3)</legend>
            <div className="flex flex-wrap gap-2">
              {TONES.map((tone) => (
                <Toggle
                  key={tone}
                  pressed={brief.tones.includes(tone)}
                  onClick={() => {
                    if (!brief.tones.includes(tone) && brief.tones.length >= 3) return;
                    set("tones", toggle(brief.tones, tone));
                  }}
                >
                  {tone}
                </Toggle>
              ))}
            </div>
          </fieldset>
          <Field
            label="Must include"
            htmlFor={`${id}-mustInclude`}
            hint="Logo, legal lines, products."
          >
            <textarea {...text("mustInclude")} className={INPUT} rows={2} maxLength={600} />
          </Field>
          <Field label="Avoid" htmlFor={`${id}-avoid`}>
            <textarea {...text("avoid")} className={INPUT} rows={2} maxLength={600} />
          </Field>
        </Step>

        <Step number={5} title="Deliverables">
          {suggestions.length > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm leading-5 font-semibold">
                Common for this project
              </legend>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <Toggle
                    key={item}
                    pressed={brief.deliverables.includes(item)}
                    onClick={() => set("deliverables", toggle(brief.deliverables, item))}
                  >
                    {item}
                  </Toggle>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="text-sm leading-5 text-[var(--cs-muted)]">
              Pick a project type in step 1 to see common deliverables.
            </p>
          )}
          <Field
            label="Add your own"
            htmlFor={`${id}-custom-deliverable`}
            hint="Include sizes where you can."
          >
            <div className="flex gap-2">
              <input
                id={`${id}-custom-deliverable`}
                value={customDeliverable}
                onChange={(event) => setCustomDeliverable(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomDeliverable();
                  }
                }}
                className={INPUT}
                maxLength={200}
                placeholder="YouTube thumbnail 1280 × 720"
              />
              <button
                type="button"
                className={studioButtonClasses("secondary")}
                onClick={addCustomDeliverable}
              >
                Add
              </button>
            </div>
          </Field>
          {custom.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Your deliverables">
              {custom.map((item) => (
                <li key={item}>
                  <Toggle
                    pressed
                    onClick={() => set("deliverables", toggle(brief.deliverables, item))}
                  >
                    {item}
                  </Toggle>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm leading-5">
            Not sure of the exact sizes?{" "}
            <Link
              href="/sizes"
              className="font-semibold text-[var(--cs-brand-strong)] hover:underline"
            >
              See every platform&apos;s sizes
            </Link>
            .
          </p>
        </Step>

        <Step number={6} title="Brand">
          <Field label="Brand colors" htmlFor={`${id}-brandColors`} hint="HEX codes or names.">
            <input {...text("brandColors")} className={INPUT} maxLength={300} />
          </Field>
          {swatches.length > 0 ? (
            <div className="flex flex-wrap gap-2" aria-hidden="true">
              {swatches.map((hex) => (
                <span
                  key={hex}
                  className="h-8 w-8 rounded-md border border-[var(--cs-border)]"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          ) : null}
          <p className="text-sm leading-5">
            No palette yet?{" "}
            <Link
              href="/colors/color-palette-generator"
              className="font-semibold text-[var(--cs-brand-strong)] hover:underline"
            >
              Make one in Color Studio
            </Link>
            .
          </p>
          <Field label="Fonts" htmlFor={`${id}-brandFonts`}>
            <input {...text("brandFonts")} className={INPUT} maxLength={300} />
          </Field>
          <Field
            label="References"
            htmlFor={`${id}-references`}
            hint="Links or work you like, and what you like about it."
          >
            <textarea {...text("references")} className={INPUT} rows={3} maxLength={1000} />
          </Field>
        </Step>

        <Step number={7} title="Timeline">
          <div className="grid grid-cols-3 gap-4 max-[639px]:grid-cols-1">
            <Field label="Deadline" htmlFor={`${id}-deadline`}>
              <input {...text("deadline")} className={INPUT} maxLength={80} />
            </Field>
            <Field label="Revisions" htmlFor={`${id}-revisions`}>
              <input {...text("revisions")} className={INPUT} maxLength={80} />
            </Field>
            <Field label="Budget (optional)" htmlFor={`${id}-budget`}>
              <input {...text("budget")} className={INPUT} maxLength={80} />
            </Field>
          </div>
          <Field label="Anything else?" htmlFor={`${id}-notes`}>
            <textarea {...text("notes")} className={INPUT} rows={3} maxLength={1500} />
          </Field>
        </Step>
      </div>

      <aside
        aria-label="Your brief"
        className="brief-print-frame sticky top-6 flex max-h-[calc(100vh-48px)] flex-col gap-4 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[1023px]:static max-[1023px]:max-h-none"
      >
        <div>
          <p className="text-sm leading-5 font-semibold" aria-live="polite">
            {progress.done} of {progress.total} essentials done
          </p>
          <div className="mt-2 h-2 rounded-full bg-[var(--cs-background)]">
            <div
              className="h-2 rounded-full bg-[var(--cs-success)] transition-[width]"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          {progress.missing.length > 0 ? (
            <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">
              Still missing: {progress.missing.join(", ")}.
            </p>
          ) : null}
        </div>
        <div className="brief-print-frame min-h-0 flex-1 overflow-y-auto rounded-xl bg-[var(--cs-background)] p-5 max-[1023px]:overflow-visible">
          <BriefPreview brief={brief} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={studioButtonClasses("primary")}
            onClick={() => copy(briefToText(brief), "text", "brief")}
          >
            {isCopied("text") ? <CheckIcon /> : <CopyIcon />}
            Copy brief
          </button>
          <button
            type="button"
            className={studioButtonClasses("secondary")}
            onClick={() => copy(briefToMarkdown(brief), "markdown", "brief as Markdown")}
          >
            Copy Markdown
          </button>
          <button
            type="button"
            className={studioButtonClasses("secondary")}
            onClick={() => window.print()}
          >
            <DownloadIcon />
            Save as PDF
          </button>
          <button
            type="button"
            className={studioButtonClasses("tertiary")}
            onClick={() => downloadText(briefToMarkdown(brief), briefFileName(brief, "md"))}
          >
            Download .md
          </button>
        </div>
      </aside>
    </div>
  );
}
