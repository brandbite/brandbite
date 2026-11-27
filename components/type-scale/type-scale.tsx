// -----------------------------------------------------------------------------
// @file: components/type-scale/type-scale.tsx
// @purpose: Type scale generator, in three steps (settings, preview, export): choose a body size and a ratio, see every
//           heading and text size together, then copy the scale as CSS
//           variables, a Tailwind theme block or plain text. Fluid sizes grow
//           between a phone and a desktop width. Runs in the browser.
// -----------------------------------------------------------------------------

"use client";

import { useId, useState } from "react";

import { CopyIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { StepHeading } from "@/components/tools/tool-page";
import {
  TOOL_ERROR,
  TOOL_FOCUS,
  TOOL_HINT,
  TOOL_INPUT,
  TOOL_LABEL,
  TOOL_PANEL,
} from "@/components/tools/tool-ui";
import {
  BASE_MAX,
  BASE_MIN,
  cleanBase,
  cleanRatio,
  DEFAULT_FLUID,
  RATIO_MAX,
  RATIO_MIN,
  ratioPreset,
  RATIOS,
  scaleCss,
  scaleTailwind,
  scaleText,
  scaleWarning,
  typeScale,
} from "@/lib/type-scale/scale";

/** Fonts that are on the visitor's device already, so nothing is downloaded. */
const FONTS = [
  { id: "sans", label: "Sans", stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { id: "serif", label: "Serif", stack: 'Georgia, "Times New Roman", serif' },
  { id: "mono", label: "Mono", stack: 'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace' },
] as const;
type FontId = (typeof FONTS)[number]["id"];

type Output = "css" | "tailwind" | "text";
const OUTPUTS: { id: Output; label: string }[] = [
  { id: "css", label: "CSS" },
  { id: "tailwind", label: "Tailwind" },
  { id: "text", label: "Text" },
];

const DEFAULT_SAMPLE = "Set the tone.";

/** "Heading 1" → "H1"; the other steps keep their name. */
const shortLabel = (label: string) => label.replace(/^Heading /, "H");

const TAB = `flex h-11 items-center justify-center rounded-[10px] border px-5 text-sm font-semibold whitespace-nowrap transition-colors ${TOOL_FOCUS}`;
const TAB_ON = "border-[var(--cs-selected)] bg-[var(--cs-soft)] text-[var(--cs-soft-text)]";
const TAB_OFF = "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]";
const RADIO_ROW =
  "flex min-h-12 items-center gap-3 rounded-[10px] px-3 py-1 text-sm leading-5 font-medium";

export function TypeScale() {
  const ids = useId();
  const [base, setBase] = useState("16");
  const [ratio, setRatio] = useState("1.25");
  /** True while the ratio is typed by hand instead of picked from the list. */
  const [custom, setCustom] = useState(false);
  const [font, setFont] = useState<FontId>("sans");
  const [sample, setSample] = useState("");
  const [fluid, setFluid] = useState(false);
  const [minRatio, setMinRatio] = useState(String(DEFAULT_FLUID.minRatio));
  const [output, setOutput] = useState<Output>("css");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const b = cleanBase(base);
  const r = cleanRatio(ratio);
  const steps = typeScale(b, r);
  const fluidOptions = fluid ? { ...DEFAULT_FLUID, minRatio: cleanRatio(minRatio) } : null;
  const warning = fluid ? null : scaleWarning(steps);
  const preset = ratioPreset(r);
  const stack = FONTS.find((f) => f.id === font)?.stack ?? FONTS[0].stack;
  const text = sample.trim() || DEFAULT_SAMPLE;

  const code =
    output === "css"
      ? scaleCss(b, r, fluidOptions)
      : output === "tailwind"
        ? scaleTailwind(b, r, fluidOptions)
        : scaleText(b, r);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setMessage({ kind: "ok", text: "Copied." });
    } catch {
      setMessage({
        kind: "error",
        text: "Your browser didn't allow the copy. Select the text and copy it.",
      });
    }
  };

  const usingPreset = !custom && preset !== null;

  return (
    <section aria-label="Type scale generator" className="flex flex-col gap-8">
      <div className="grid grid-cols-[340px_minmax(0,1fr)] items-start gap-6 max-[1023px]:grid-cols-1">
        <div>
          <StepHeading
            number={1}
            title="Settings"
            hint="Choose your base size, ratio and options."
          />
          <div className={`mt-4 flex flex-col gap-6 ${TOOL_PANEL}`}>
            <div>
              <label htmlFor={`${ids}-base`} className={TOOL_LABEL}>
                Base size
              </label>
              <div className="relative mt-2">
                <input
                  id={`${ids}-base`}
                  type="number"
                  inputMode="decimal"
                  min={BASE_MIN}
                  max={BASE_MAX}
                  step={1}
                  value={base}
                  onChange={(event) => setBase(event.target.value)}
                  onBlur={() => setBase(String(b))}
                  className={`${TOOL_INPUT} pr-10 tabular-nums`}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-0 right-3 flex h-11 items-center text-sm text-[var(--cs-muted)]"
                >
                  px
                </span>
              </div>
              <p className={`mt-2 ${TOOL_HINT}`}>
                Body text size ({BASE_MIN} – {BASE_MAX}px). 16 is the browser default.
              </p>
            </div>

            <fieldset>
              <legend className={TOOL_LABEL}>Ratio</legend>
              <div className="mt-2 flex flex-col gap-1">
                <div className={`${RADIO_ROW} ${usingPreset ? "bg-[var(--cs-soft)]" : ""}`}>
                  <input
                    type="radio"
                    name={`${ids}-ratio-kind`}
                    aria-label="Choose a ratio from the list"
                    checked={usingPreset}
                    onChange={() => {
                      setCustom(false);
                      if (!preset) setRatio("1.25");
                    }}
                    className="h-5 w-5 shrink-0 accent-[var(--cs-selected)]"
                  />
                  <select
                    aria-label="Ratio from the list"
                    value={preset?.id ?? "major-third"}
                    onChange={(event) => {
                      const chosen = RATIOS.find((item) => item.id === event.target.value);
                      if (!chosen) return;
                      setCustom(false);
                      setRatio(String(chosen.value));
                    }}
                    className={`${TOOL_INPUT} !h-10 min-w-0 flex-1`}
                  >
                    {RATIOS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} ({item.value})
                      </option>
                    ))}
                  </select>
                </div>
                <div className={`${RADIO_ROW} ${usingPreset ? "" : "bg-[var(--cs-soft)]"}`}>
                  <input
                    id={`${ids}-custom`}
                    type="radio"
                    name={`${ids}-ratio-kind`}
                    checked={!usingPreset}
                    onChange={() => setCustom(true)}
                    className="h-5 w-5 shrink-0 accent-[var(--cs-selected)]"
                  />
                  <label htmlFor={`${ids}-custom`} className="flex-1 cursor-pointer">
                    Custom
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label="Custom ratio"
                    min={RATIO_MIN}
                    max={RATIO_MAX}
                    step={0.005}
                    value={ratio}
                    onFocus={() => setCustom(true)}
                    onChange={(event) => {
                      setCustom(true);
                      setRatio(event.target.value);
                    }}
                    onBlur={() => setRatio(String(r))}
                    className={`${TOOL_INPUT} !h-10 !w-24 tabular-nums`}
                  />
                </div>
              </div>
              <p className={`mt-2 ${TOOL_HINT}`}>
                Each size is the one below it times this number. A small ratio gives calm pages; a
                large one gives dramatic headings.
              </p>
            </fieldset>

            <div>
              <div className="flex items-center justify-between gap-3">
                <span id={`${ids}-fluid`} className={TOOL_LABEL}>
                  Fluid scale
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={fluid}
                  aria-labelledby={`${ids}-fluid`}
                  onClick={() => setFluid((on) => !on)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${TOOL_FOCUS} ${
                    fluid ? "bg-[var(--cs-selected)]" : "bg-[#C9C5BE]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      fluid ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>
              {fluid ? (
                <div className="mt-2">
                  <label htmlFor={`${ids}-min`} className="text-sm leading-5 font-medium">
                    Ratio on a phone
                  </label>
                  <input
                    id={`${ids}-min`}
                    type="number"
                    inputMode="decimal"
                    min={RATIO_MIN}
                    max={RATIO_MAX}
                    step={0.005}
                    value={minRatio}
                    onChange={(event) => setMinRatio(event.target.value)}
                    onBlur={() => setMinRatio(String(cleanRatio(minRatio)))}
                    className={`mt-1 ${TOOL_INPUT} tabular-nums`}
                  />
                  <p className={`mt-2 ${TOOL_HINT}`}>
                    Headings use this ratio on a {DEFAULT_FLUID.minViewport}px screen and grow
                    smoothly to your ratio at {DEFAULT_FLUID.maxViewport}px. The preview shows the
                    desktop sizes.
                  </p>
                </div>
              ) : (
                <p className={`mt-1 ${TOOL_HINT}`}>
                  Headings shrink on small screens and grow on large ones, with no breakpoints.
                </p>
              )}
            </div>

            <fieldset>
              <legend className={TOOL_LABEL}>Font</legend>
              <div className="mt-2 flex gap-2">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={font === f.id}
                    onClick={() => setFont(f.id)}
                    className={`${TAB} flex-1 !px-2 ${font === f.id ? TAB_ON : TAB_OFF}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor={`${ids}-sample`} className={TOOL_LABEL}>
                Preview text
              </label>
              <input
                id={`${ids}-sample`}
                value={sample}
                maxLength={80}
                placeholder={DEFAULT_SAMPLE}
                onChange={(event) => setSample(event.target.value)}
                className={`mt-2 ${TOOL_INPUT}`}
              />
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <StepHeading
            number={2}
            title="Scale preview"
            hint="A complete type hierarchy using your settings."
          />
          {warning ? (
            <p role="status" className={`mt-4 ${TOOL_PANEL} !py-4 ${TOOL_ERROR}`}>
              {warning}
            </p>
          ) : null}
          <div className={`mt-4 ${TOOL_PANEL}`}>
            <ul className="flex flex-col divide-y divide-[var(--cs-border)]">
              {steps
                .slice()
                .reverse()
                .map((step) => (
                  <li
                    key={step.id}
                    className="grid grid-cols-[104px_minmax(0,1fr)_auto] items-center gap-4 py-3 first:pt-0 last:pb-0 max-[639px]:grid-cols-[84px_minmax(0,1fr)]"
                  >
                    <p className="text-sm leading-5">
                      <span className="block font-semibold">{shortLabel(step.label)}</span>
                      <span className="block text-[var(--cs-muted)]">{step.role}</span>
                    </p>
                    <p
                      className="overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{
                        fontFamily: stack,
                        fontSize: step.px,
                        lineHeight: step.lineHeight,
                        fontWeight: step.step > 0 ? 600 : 400,
                      }}
                    >
                      {text}
                    </p>
                    <p className="text-right text-sm leading-5 tabular-nums max-[639px]:col-span-2 max-[639px]:text-left">
                      <span className="block font-medium">{step.px} px</span>
                      <span className="block text-[var(--cs-muted)]">
                        {step.rem} rem · line {step.lineHeight}
                      </span>
                    </p>
                  </li>
                ))}
            </ul>
          </div>

          <details className={`group mt-4 ${TOOL_PANEL} !p-0`}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-6 py-3 text-base leading-6 font-semibold max-[767px]:px-5 [&::-webkit-details-marker]:hidden">
              See it in a page
              <svg
                aria-hidden
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 transition-transform group-open:rotate-180"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="px-6 pb-6 max-[767px]:px-5 max-[767px]:pb-5">
              <div
                className="overflow-hidden rounded-xl border border-[var(--cs-border)] bg-white p-6 text-[#292827]"
                style={{ fontFamily: stack }}
              >
                {(
                  [
                    ["h1", "A page title that sets the tone", 600],
                    [
                      "base",
                      "The opening paragraph explains what the page is about. It is set in your body size, the one every other size is measured from.",
                      400,
                    ],
                    ["h2", "A section heading", 600],
                    [
                      "base",
                      "Sections break a long page into parts a reader can scan. The step between this heading and the text under it comes from your ratio.",
                      400,
                    ],
                    ["h4", "A card title", 600],
                    ["sm", "Secondary text sits one step under the body size.", 400],
                    ["xs", "Captions and labels use the smallest size.", 400],
                  ] as const
                ).map(([id, line, weight], index) => {
                  const step = steps.find((s) => s.id === id)!;
                  return (
                    <p
                      key={index}
                      style={{
                        fontSize: step.px,
                        lineHeight: step.lineHeight,
                        fontWeight: weight,
                        marginTop: index === 0 ? 0 : step.step > 0 ? "0.9em" : "0.5em",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          </details>
        </div>
      </div>

      <div>
        <StepHeading
          number={3}
          title="Export"
          hint="Copy your type scale as CSS, Tailwind or plain text."
        />
        <div className={`mt-4 ${TOOL_PANEL}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <fieldset>
              <legend className="sr-only">Copy as</legend>
              <div className="flex flex-wrap gap-2">
                {OUTPUTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={output === item.id}
                    onClick={() => setOutput(item.id)}
                    className={`${TAB} ${output === item.id ? TAB_ON : TAB_OFF}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              onClick={() => void copy()}
              className={`${studioButtonClasses("primary")} !h-12 !px-6`}
            >
              <CopyIcon />
              Copy scale
            </button>
          </div>
          <pre
            tabIndex={0}
            aria-label="The scale as code"
            className="mt-4 max-h-96 overflow-auto rounded-xl border border-[var(--cs-border)] bg-[var(--cs-background)] p-4 text-[13px] leading-5"
          >
            <code>{code}</code>
          </pre>
          <p
            role="status"
            className={`mt-2 text-sm leading-5 ${
              message?.kind === "error"
                ? "font-medium text-[#b42318]"
                : message
                  ? "text-[#256b3a]"
                  : "text-[var(--cs-muted)]"
            }`}
          >
            {message?.text ??
              (output === "text"
                ? fluid
                  ? "The text version lists the desktop sizes."
                  : "A plain list for a brief or a brand guide."
                : "Sizes are in rem, so text follows the size a reader has set in their browser.")}
          </p>
        </div>
      </div>
    </section>
  );
}
