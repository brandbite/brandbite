// -----------------------------------------------------------------------------
// @file: components/tools/tool-ui.tsx
// @purpose: Small pieces the public hub tools share (Mockup Studio aside,
//           which has its own): who the visitor is, pill choices, color
//           choices with the visitor's brand colors first, and a file picker.
//           Styled with the public tools' --cs-* colors.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import type { ToolEntitlement } from "@/lib/tools/entitlement";

export type ToolAccess = ToolEntitlement & {
  brandColors: { hex: string; name: string | null }[];
  /** The signed-in customer's company name, or null. */
  companyName: string | null;
  /** Their brand guide has a logo the tools can load. */
  hasBrandLogo: boolean;
  /** "Extend with AI" is on for this visitor: on a plan, and the image model is set up. */
  aiExtend: boolean;
  aiExtendDailyLimit: number;
  /** The newsletter builder's "Write with AI" is on for this visitor: on a plan, text model set up. */
  newsletterAi: boolean;
  newsletterAiDailyLimit: number;
  /** They can upload pictures for a newsletter: on a plan, public asset domain set up. */
  newsletterUpload: boolean;
  /** They can send themselves a test newsletter: on a plan, email sending set up. */
  newsletterTest: boolean;
};

const SIGNED_OUT: ToolAccess = {
  signedIn: false,
  pro: false,
  reason: "signedOut",
  brandColors: [],
  companyName: null,
  hasBrandLogo: false,
  aiExtend: false,
  aiExtendDailyLimit: 10,
  newsletterAi: false,
  newsletterAiDailyLimit: 10,
  newsletterUpload: false,
  newsletterTest: false,
};

/** Whether the visitor is signed in and on a plan, and their brand guide colors. Signed out until known. */
export function useToolAccess(): ToolAccess {
  return useToolAccessStatus().access;
}

/**
 * The same, with `ready` turning true once the answer is in (or couldn't be
 * had), for tools that must not decide anything on the first "signed out".
 */
export function useToolAccessStatus(): { access: ToolAccess; ready: boolean } {
  const [state, setState] = useState<{ access: ToolAccess; ready: boolean }>({
    access: SIGNED_OUT,
    ready: false,
  });
  useEffect(() => {
    let live = true;
    fetch("/api/tools/entitlement", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ToolAccess | null) => {
        if (live) setState({ access: json ? { ...SIGNED_OUT, ...json } : SIGNED_OUT, ready: true });
      })
      .catch(() => {
        if (live) setState({ access: SIGNED_OUT, ready: true });
      });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/**
 * The signed-in customer's brand guide logo as a file, or null when there is
 * none (or they are signed out). `prefer` "icon" asks for the icon version first.
 */
export async function fetchBrandLogo(prefer: "primary" | "icon" = "primary"): Promise<File | null> {
  try {
    const res = await fetch(`/api/tools/brand-logo?prefer=${prefer}`, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const named = res.headers.get("X-Logo-Name");
    return new File([blob], named ? decodeURIComponent(named) : "logo", { type: blob.type });
  } catch {
    return null;
  }
}

export const TOOL_FOCUS =
  "focus-visible:ring-2 focus-visible:ring-[var(--cs-text)] focus-visible:ring-offset-2 focus-visible:outline-none";
export const TOOL_LABEL = "text-sm leading-5 font-semibold";
export const TOOL_HINT = "text-sm leading-5 text-[var(--cs-muted)]";
export const TOOL_PANEL =
  "rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5";
export const TOOL_ERROR = "text-sm leading-5 font-medium text-[#b42318]";
export const TOOL_INPUT = `h-11 w-full rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm ${TOOL_FOCUS}`;

function pill(selected: boolean): string {
  return `flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors ${TOOL_FOCUS} ${
    selected
      ? "border-[var(--cs-text)] bg-[var(--cs-text)] text-[var(--cs-surface)]"
      : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]"
  }`;
}

/** Choose one of a few. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className={TOOL_LABEL}>{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === value}
            onClick={() => onChange(option.id)}
            className={pill(option.id === value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Switch any number of a few on or off. */
export function ToggleGroup<T extends string>({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: { id: T; label: string }[];
  values: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className={TOOL_LABEL}>{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={values.includes(option.id)}
            onClick={() => onToggle(option.id)}
            className={pill(values.includes(option.id))}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Pick a color: the visitor's brand guide colors first (when signed in and
 * they have some), then a few defaults, then any color at all.
 */
export function ColorChoice({
  label,
  value,
  onChange,
  brandColors,
  presets,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  brandColors: { hex: string; name: string | null }[];
  presets: { hex: string; name: string }[];
}) {
  const id = useId();
  const swatch = (hex: string, name: string) => (
    <button
      key={`${name}-${hex}`}
      type="button"
      aria-label={`${name} (${hex})`}
      aria-pressed={value.toLowerCase() === hex.toLowerCase()}
      title={name}
      onClick={() => onChange(hex)}
      className={`h-11 w-11 rounded-full border ${TOOL_FOCUS} ${
        value.toLowerCase() === hex.toLowerCase()
          ? "border-[var(--cs-text)] ring-2 ring-[var(--cs-text)] ring-offset-2"
          : "border-[var(--cs-border)]"
      }`}
      style={{ background: hex }}
    />
  );
  return (
    <fieldset>
      <legend className={TOOL_LABEL}>{label}</legend>
      {brandColors.length > 0 ? (
        <>
          <p className={`mt-2 ${TOOL_HINT}`}>From your brand guide</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {brandColors.map((color) => swatch(color.hex, color.name ?? color.hex))}
          </div>
        </>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {presets.map((preset) => swatch(preset.hex, preset.name))}
        <label htmlFor={id} className="flex min-h-11 items-center gap-2 pl-1 text-sm leading-5">
          <input
            id={id}
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-[var(--cs-border)] bg-transparent p-0.5"
          />
          Any color
        </label>
      </div>
    </fieldset>
  );
}

/** A "Choose a file" button over a hidden file input. */
export function FilePicker({
  label,
  accept,
  multiple = false,
  onFiles,
  children,
}: {
  label: string;
  accept: string[];
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`${studioButtonClasses("secondary")} cursor-pointer focus-within:ring-2 focus-within:ring-[var(--cs-text)] focus-within:ring-offset-2`}
    >
      {children}
      {label}
      <input
        id={id}
        type="file"
        accept={accept.join(",")}
        multiple={multiple}
        className="sr-only"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </label>
  );
}
