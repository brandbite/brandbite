// -----------------------------------------------------------------------------
// @file: components/newsletter/editor/fields.tsx
// @purpose: The small form pieces of the newsletter editor's side panels:
//           text fields, a slider, an optional color, a switch, a row of
//           choices, and the field for a picture (a web address, or an
//           upload for customers who can upload).
// -----------------------------------------------------------------------------

"use client";

import { useId, useState, type ReactNode } from "react";

import { UploadIcon } from "@/components/colors/studio/icons";
import { TOOL_ERROR, TOOL_FOCUS, TOOL_HINT } from "@/components/tools/tool-ui";
import { imageUrlProblem, NEWSLETTER_TEXT_MAX } from "@/lib/newsletter/newsletter";
import { NEWSLETTER_UPLOAD_ACCEPT } from "@/lib/newsletter/upload.client";

import { ImageCropDialog, ImageLibraryDialog } from "./image-dialogs";

export const FIELD_LABEL = "text-[13px] leading-5 font-semibold";
export const FIELD_INPUT = `h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm ${TOOL_FOCUS}`;
export const FIELD_TEXTAREA = `min-h-[104px] w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm leading-6 ${TOOL_FOCUS}`;
export const SMALL_BUTTON = `inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-[13px] font-semibold hover:border-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--cs-border)] ${TOOL_FOCUS}`;

/** A titled group of fields in a side panel. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-b border-[var(--cs-border)] px-5 py-5 last:border-b-0">
      <h3 className="text-[11px] leading-4 font-bold tracking-[0.08em] text-[var(--cs-muted)] uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A part of a side panel that opens and closes, for what is used now and then. */
export function Fold({
  title,
  icon,
  badge,
  children,
}: {
  title: string;
  /** The path of a 24 by 24 line icon. */
  icon: string;
  /** A short mark beside the title, such as "Plan". */
  badge?: string;
  children: ReactNode;
}) {
  return (
    <details className="group mx-5 mb-3 rounded-xl border border-[var(--cs-border)]">
      <summary
        className={`flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-4 text-sm leading-5 font-semibold [&::-webkit-details-marker]:hidden ${TOOL_FOCUS}`}
      >
        <svg
          aria-hidden
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d={icon} />
        </svg>
        {title}
        {badge ? (
          <span className="rounded-md bg-[var(--cs-soft)] px-1.5 text-[11px] leading-5 font-semibold text-[var(--cs-soft-text)]">
            {badge}
          </span>
        ) : null}
        <svg
          aria-hidden
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-auto shrink-0 transition-transform group-open:rotate-180"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="flex flex-col gap-4 px-4 pt-1 pb-4">{children}</div>
    </details>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength = 200,
  hint,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  hint?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={type === "url" ? "url" : undefined}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        // The editor moves focus to a block's main field when the block is picked.
        autoFocus={autoFocus}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 ${FIELD_INPUT}`}
      />
      {hint ? (
        <p id={`${id}-hint`} className={`mt-1.5 text-[13px] leading-5 text-[var(--cs-muted)]`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  maxLength = NEWSLETTER_TEXT_MAX,
  hint,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 ${FIELD_TEXTAREA}`}
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] leading-5 text-[var(--cs-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Choose one of a few, as a compact row. */
export function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className={FIELD_LABEL}>{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1 rounded-lg bg-[var(--cs-background)] p-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === value}
            onClick={() => onChange(option.id)}
            className={`min-h-8 flex-1 rounded-md px-2 text-[13px] font-medium whitespace-nowrap ${TOOL_FOCUS} ${
              option.id === value
                ? "bg-[var(--cs-surface)] font-semibold shadow-sm"
                : "text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 4,
  unit = "px",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={FIELD_LABEL}>
          {label}
        </label>
        <span className="text-[13px] leading-5 text-[var(--cs-muted)] tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 h-6 w-full accent-[var(--cs-text)]"
      />
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <label htmlFor={id} className={FIELD_LABEL}>
          {label}
        </label>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${TOOL_FOCUS} ${
            checked ? "bg-[var(--cs-text)]" : "bg-[var(--cs-border)]"
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`}
          />
        </button>
      </div>
      {hint ? <p className="text-[13px] leading-5 text-[var(--cs-muted)]">{hint}</p> : null}
    </div>
  );
}

/**
 * A color that can also be "not set": `value` "" means the block follows the
 * theme (or has no background), shown as `emptyLabel`.
 */
export function ColorField({
  label,
  value,
  onChange,
  emptyLabel,
  fallback,
  swatches = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** What "" means, e.g. "Theme color" or "None". Leave out when a color is required. */
  emptyLabel?: string;
  /** The color the picker opens on when none is set. */
  fallback: string;
  swatches?: { hex: string; name: string | null }[];
}) {
  const id = useId();
  const shown = value || fallback;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={FIELD_LABEL}>
          {label}
        </label>
        {emptyLabel && value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className={`min-h-8 text-[13px] font-medium text-[var(--cs-muted)] underline underline-offset-2 hover:text-[var(--cs-text)] ${TOOL_FOCUS}`}
          >
            Reset
          </button>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="color"
          value={shown}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--cs-border)] bg-transparent p-1"
        />
        <span className="text-[13px] leading-5 text-[var(--cs-muted)]">
          {value ? value.toUpperCase() : (emptyLabel ?? shown.toUpperCase())}
        </span>
        {swatches.slice(0, 6).map((swatch) => (
          <button
            key={swatch.hex}
            type="button"
            aria-label={`Use ${swatch.name ?? swatch.hex}`}
            title={swatch.name ?? swatch.hex}
            aria-pressed={value.toLowerCase() === swatch.hex.toLowerCase()}
            onClick={() => onChange(swatch.hex.toLowerCase())}
            className={`h-7 w-7 rounded-full border border-[var(--cs-border)] ${TOOL_FOCUS} aria-pressed:ring-2 aria-pressed:ring-[var(--cs-text)] aria-pressed:ring-offset-2`}
            style={{ background: swatch.hex }}
          />
        ))}
      </div>
    </div>
  );
}

/** A picture's web address, with an upload button for customers who can upload. */
export function ImageField({
  label,
  value,
  onChange,
  canUpload,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  canUpload: boolean;
  hint?: string;
}) {
  const id = useId();
  /** The file chosen from the device, while it is being cut and uploaded. */
  const [picked, setPicked] = useState<File | null>(null);
  const [library, setLibrary] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const problem = imageUrlProblem(value);

  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <input
        id={id}
        type="url"
        inputMode="url"
        value={value}
        placeholder="https://yourcompany.com/image.jpg"
        maxLength={500}
        onChange={(event) => {
          setFailure(null);
          onChange(event.target.value);
        }}
        className={`mt-1.5 ${FIELD_INPUT}`}
      />
      {canUpload ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <label
            className={`${SMALL_BUTTON} cursor-pointer focus-within:ring-2 focus-within:ring-[var(--cs-text)] focus-within:ring-offset-2`}
          >
            <UploadIcon />
            Upload an image
            <input
              type="file"
              accept={NEWSLETTER_UPLOAD_ACCEPT.join(",")}
              className="sr-only"
              onChange={(event) => {
                setFailure(null);
                setPicked(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </label>
          <button type="button" onClick={() => setLibrary(true)} className={SMALL_BUTTON}>
            Your pictures
          </button>
        </div>
      ) : null}
      {picked ? (
        <ImageCropDialog
          file={picked}
          onUploaded={(url) => {
            setPicked(null);
            onChange(url);
          }}
          onClose={() => setPicked(null)}
        />
      ) : null}
      {library ? <ImageLibraryDialog onPick={onChange} onClose={() => setLibrary(false)} /> : null}
      <p className={`mt-1.5 text-[13px] leading-5 text-[var(--cs-muted)]`}>
        {hint ??
          (canUpload
            ? "Upload it, pick one you uploaded before, or paste the https address of an image on the web."
            : "An email shows a picture only from the web: paste its https address.")}
      </p>
      <p role="alert" className={`mt-1 ${TOOL_ERROR} empty:hidden`}>
        {failure ?? problem ?? ""}
      </p>
    </div>
  );
}

export { TOOL_HINT };
