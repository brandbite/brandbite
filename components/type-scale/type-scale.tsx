// -----------------------------------------------------------------------------
// @file: components/type-scale/type-scale.tsx
// @purpose: Type scale generator: choose a body size and a ratio, see every
//           heading and text size together, then copy the scale as CSS
//           variables, a Tailwind theme block or plain text. Fluid sizes grow
//           between a phone and a desktop width. Runs in the browser.
// -----------------------------------------------------------------------------

"use client";

import { useId, useState } from "react";

import { CopyIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  Segmented,
  TOOL_ERROR,
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
  scaleValues,
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

const DEFAULT_SAMPLE = "Good design is as little design as possible";

export function TypeScale() {
  const ids = useId();
  const [base, setBase] = useState("16");
  const [ratio, setRatio] = useState("1.25");
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
  const values = scaleValues(b, r, fluidOptions);
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

  return (
    <section
      aria-label="Type scale generator"
      className="grid grid-cols-[360px_minmax(0,1fr)] gap-6 max-[1023px]:grid-cols-1"
    >
      <div className={`flex flex-col gap-6 ${TOOL_PANEL}`}>
        <div>
          <label htmlFor={`${ids}-base`} className={TOOL_LABEL}>
            Body size (px)
          </label>
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
            className={`mt-2 ${TOOL_INPUT} tabular-nums`}
          />
          <p className={`mt-2 ${TOOL_HINT}`}>
            The size of your paragraphs. 16 is the browser default; {BASE_MIN} to {BASE_MAX} is
            allowed.
          </p>
        </div>

        <div>
          <label htmlFor={`${ids}-preset`} className={TOOL_LABEL}>
            Ratio
          </label>
          <select
            id={`${ids}-preset`}
            value={preset?.id ?? "custom"}
            onChange={(event) => {
              const chosen = RATIOS.find((item) => item.id === event.target.value);
              if (chosen) setRatio(String(chosen.value));
            }}
            className={`mt-2 ${TOOL_INPUT}`}
          >
            {RATIOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} · {item.value}
              </option>
            ))}
            {preset ? null : <option value="custom">Custom · {r}</option>}
          </select>
          <label htmlFor={`${ids}-ratio`} className="mt-3 block text-sm leading-5 font-medium">
            Or type your own
          </label>
          <input
            id={`${ids}-ratio`}
            type="number"
            inputMode="decimal"
            min={RATIO_MIN}
            max={RATIO_MAX}
            step={0.005}
            value={ratio}
            onChange={(event) => setRatio(event.target.value)}
            onBlur={() => setRatio(String(r))}
            className={`mt-1 ${TOOL_INPUT} tabular-nums`}
          />
          <p className={`mt-2 ${TOOL_HINT}`}>
            Each size is the one below it times this number. A small ratio gives calm pages; a large
            one gives dramatic headings.
          </p>
        </div>

        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-5 font-medium">
            <input
              type="checkbox"
              checked={fluid}
              onChange={(event) => setFluid(event.target.checked)}
              className="h-5 w-5 accent-[var(--cs-text)]"
            />
            Fluid sizes for phones
          </label>
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
                Headings use this ratio on a {DEFAULT_FLUID.minViewport}px screen and grow smoothly
                to your ratio at {DEFAULT_FLUID.maxViewport}px. The preview shows the desktop sizes.
              </p>
            </div>
          ) : (
            <p className={TOOL_HINT}>
              Headings shrink on small screens and grow on large ones, with no breakpoints.
            </p>
          )}
        </div>

        <Segmented<FontId>
          label="Preview font"
          options={FONTS.map((f) => ({ id: f.id, label: f.label }))}
          value={font}
          onChange={setFont}
        />

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

      <div className="flex min-w-0 flex-col gap-4">
        {warning ? (
          <p role="status" className={`${TOOL_PANEL} ${TOOL_ERROR}`}>
            {warning}
          </p>
        ) : null}

        <div className={TOOL_PANEL}>
          <h2 className={TOOL_LABEL}>Your scale</h2>
          <ul className="mt-3 flex flex-col divide-y divide-[var(--cs-border)]">
            {steps
              .slice()
              .reverse()
              .map((step) => (
                <li key={step.id} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0">
                  <p className="flex flex-wrap items-baseline gap-x-3 text-sm leading-5 tabular-nums">
                    <span className="font-semibold">{step.label}</span>
                    <span className="text-[var(--cs-muted)]">
                      {step.px}px · {step.rem}rem · line height {step.lineHeight}
                    </span>
                    <span className="text-[var(--cs-muted)]">{step.role}</span>
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
                </li>
              ))}
          </ul>
        </div>

        <div className={TOOL_PANEL}>
          <h2 className={TOOL_LABEL}>In a page</h2>
          <div
            className="mt-3 overflow-hidden rounded-xl border border-[var(--cs-border)] bg-white p-6 text-[#292827]"
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

        <div className={TOOL_PANEL}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Segmented<Output>
              label="Copy as"
              options={OUTPUTS}
              value={output}
              onChange={setOutput}
            />
            <button
              type="button"
              onClick={() => void copy()}
              className={studioButtonClasses("primary")}
            >
              <CopyIcon />
              Copy
            </button>
          </div>
          <pre
            tabIndex={0}
            aria-label="The scale as code"
            className="mt-3 max-h-80 overflow-auto rounded-xl border border-[var(--cs-border)] bg-[var(--cs-background)] p-4 text-[13px] leading-5"
          >
            <code>{code}</code>
          </pre>
          <p
            role="status"
            className={`mt-2 min-h-5 text-sm leading-5 ${message?.kind === "error" ? "font-medium text-[#b42318]" : "text-[#256b3a]"}`}
          >
            {message?.text ?? ""}
          </p>
          {output === "text" && fluid ? (
            <p className={TOOL_HINT}>The text version lists the desktop sizes.</p>
          ) : null}
          {output !== "text" ? (
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm leading-5 text-[var(--cs-muted)] tabular-nums">
              {values
                .filter(({ step }) => ["h1", "h2", "base"].includes(step.id))
                .reverse()
                .map(({ step, value }) => (
                  <li key={step.id}>
                    {step.label}: <code>{value}</code>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
