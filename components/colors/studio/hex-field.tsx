// -----------------------------------------------------------------------------
// @file: components/colors/studio/hex-field.tsx
// @purpose: Labelled color input: swatch with native picker, HEX text field and
//           copy. Accepts #RGB and #RRGGBB and shows the normalized form on blur.
//           The parent only receives valid values, so typing a partial hex never
//           disturbs the color it is editing.
// -----------------------------------------------------------------------------

"use client";

import { useId, useState } from "react";

import { formatHex, parseOpaqueHex } from "@/lib/colors";

import { CheckIcon, CopyIcon } from "./icons";
import { useStudioCopy } from "./use-studio-copy";

export function HexField({
  label,
  value,
  onChange,
}: {
  label: string;
  /** The current valid color. */
  value: string;
  onChange: (hex: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const { copy, isCopied } = useStudioCopy();
  const [draft, setDraft] = useState(() => formatHex(value));
  const [lastValue, setLastValue] = useState(value);
  const [emitted, setEmitted] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  // A value we did not emit ourselves (undo, swap, another tool) replaces the
  // draft. Our own value coming back must not, or "#abc" would expand mid-typing.
  if (value !== lastValue) {
    setLastValue(value);
    setEmitted(null);
    if (value !== emitted) {
      setDraft(formatHex(value));
      setShowError(false);
    }
  }

  const emit = (hex: string) => {
    setEmitted(hex);
    onChange(hex);
  };

  const handleText = (text: string) => {
    setDraft(text);
    const parsed = parseOpaqueHex(text);
    if (parsed) {
      setShowError(false);
      if (parsed !== value) emit(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseOpaqueHex(draft);
    if (parsed) setDraft(formatHex(parsed));
    else setShowError(true);
  };

  const handlePicker = (hex: string) => {
    setDraft(formatHex(hex));
    setShowError(false);
    emit(hex);
  };

  const displayHex = formatHex(value);
  const copied = isCopied("hex");

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm leading-5 font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] border border-[var(--cs-border)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--cs-text)]"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            aria-label={`Pick ${label}`}
            value={value}
            onChange={(e) => handlePicker(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            type="text"
            value={draft}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={showError || undefined}
            aria-describedby={showError ? errorId : undefined}
            onChange={(e) => handleText(e.target.value)}
            onBlur={handleBlur}
            className={`h-12 w-full rounded-[10px] border bg-[var(--cs-surface)] pr-12 pl-3 font-mono text-sm leading-5 ${
              showError ? "border-[var(--cs-danger)]" : "border-[var(--cs-border)]"
            }`}
          />
          <button
            type="button"
            aria-label={`Copy ${label} ${displayHex}`}
            onClick={() => void copy(displayHex, "hex")}
            className="absolute top-0.5 right-0.5 flex h-11 w-11 items-center justify-center rounded-[10px] text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
      </div>
      {showError ? (
        <p id={errorId} className="mt-2 text-sm leading-5 text-[var(--cs-danger)]">
          Enter a 3 or 6 digit hex color, like #FF6426. Transparency isn&apos;t supported.
        </p>
      ) : null}
    </div>
  );
}
