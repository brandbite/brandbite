// -----------------------------------------------------------------------------
// @file: app/colors/tailwind-color-generator/page.tsx
// @purpose: Turn a single color into a full Tailwind shade scale (50–950),
//           à la uicolors.app. Copy any shade, or the whole scale as a
//           tailwind.config block or CSS variables. Client-only, no persistence.
// -----------------------------------------------------------------------------

"use client";

import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tabs, TabList, Tab } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useClipboard } from "@/components/hooks/use-clipboard";
import {
  formatHex,
  normalizeHex,
  readableTextOn,
  tailwindScale,
  tailwindScaleToConfig,
  tailwindScaleToCssVars,
} from "@/lib/colors";

const DEFAULT_HEX = "#ff6426";

export default function TailwindColorGeneratorPage() {
  const [input, setInput] = useState(DEFAULT_HEX);
  // The committed valid color drives the scale; it only advances when the input
  // parses, so the scale stays stable while the user types an intermediate
  // invalid value (e.g. mid-typing a hex).
  const [effective, setEffective] = useState(DEFAULT_HEX);
  const [name, setName] = useState("brand");
  const [exportKind, setExportKind] = useState<"config" | "css">("config");
  // Which stop the input color anchors to. null = auto (nearest by lightness).
  const [baseStop, setBaseStop] = useState<number | null>(null);
  const { copy, isCopied } = useClipboard();

  const normalized = useMemo(() => normalizeHex(input), [input]);

  const handleColorInput = (value: string) => {
    setInput(value);
    const next = normalizeHex(value);
    if (next) setEffective(next);
  };

  const shades = useMemo(
    () => tailwindScale(effective, baseStop ?? undefined),
    [effective, baseStop],
  );
  const exportText = useMemo(
    () =>
      exportKind === "config"
        ? tailwindScaleToConfig(name, shades)
        : tailwindScaleToCssVars(name, shades),
    [exportKind, name, shades],
  );

  return (
    <div className="min-h-screen bg-[var(--bb-bg-page)] text-[var(--bb-secondary)]">
      <SiteHeader activePage="Color Tools" />
      <main className="mx-auto max-w-5xl px-4 py-12 md:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-brand text-3xl font-bold md:text-4xl">
              Tailwind CSS Color Generator
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--bb-text-secondary)]">
              Enter a color and get a full Tailwind shade scale from 50 to 950. Click any shade to
              copy its hex, or export the whole scale as config or CSS variables.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Controls */}
        <div className="mb-8 flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="tw-hex"
              className="mb-1 block text-xs font-semibold text-[var(--bb-text-tertiary)]"
            >
              Base color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick base color"
                value={effective}
                onChange={(e) => handleColorInput(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--bb-border-input)] bg-transparent p-1"
              />
              <input
                id="tw-hex"
                type="text"
                value={input}
                spellCheck={false}
                onChange={(e) => handleColorInput(e.target.value)}
                placeholder="#ff6426"
                aria-invalid={!normalized}
                className={`w-32 rounded-lg border bg-[var(--bb-bg-page)] px-3 py-2 font-mono text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] ${
                  normalized
                    ? "border-[var(--bb-border-input)]"
                    : "border-[var(--bb-danger-border)]"
                }`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="tw-name"
              className="mb-1 block text-xs font-semibold text-[var(--bb-text-tertiary)]"
            >
              Color name
            </label>
            <input
              id="tw-name"
              type="text"
              value={name}
              spellCheck={false}
              onChange={(e) => setName(e.target.value)}
              placeholder="brand"
              className="w-40 rounded-lg border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2 font-mono text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)]"
            />
          </div>
        </div>

        {/* Scale header: base is selectable per swatch; Auto resets to nearest */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--bb-text-secondary)]">
            Shades{" "}
            <span className="font-normal text-[var(--bb-text-tertiary)]">
              — click a swatch to set it as the base
            </span>
          </h2>
          <button
            type="button"
            onClick={() => setBaseStop(null)}
            title="Auto-pick the base by lightness"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              baseStop === null
                ? "bg-[var(--bb-primary)] text-white"
                : "border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] text-[var(--bb-text-secondary)] hover:text-[var(--bb-primary)]"
            }`}
          >
            Auto
          </button>
        </div>

        {/* Scale */}
        <div className="mb-10 grid grid-cols-2 gap-2 sm:grid-cols-6 lg:grid-cols-11">
          {shades.map((shade) => {
            const label = formatHex(shade.hex);
            return (
              <div
                key={shade.stop}
                className={`group overflow-hidden rounded-xl border ${
                  shade.isBase
                    ? "border-[var(--bb-primary)] ring-1 ring-[var(--bb-primary)]"
                    : "border-[var(--bb-border)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setBaseStop(shade.stop)}
                  title={`Set ${shade.stop} as the base color`}
                  className="flex h-16 w-full items-start justify-between p-1.5"
                  style={{ backgroundColor: shade.hex, color: readableTextOn(shade.hex) }}
                >
                  <span className="text-[11px] font-semibold">{shade.stop}</span>
                  {shade.isBase ? (
                    <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase">
                      Base
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => void copy(label, `s-${shade.stop}`)}
                  title={`Copy ${label}`}
                  className="block w-full bg-[var(--bb-bg-card)] px-1.5 py-1 text-left font-mono text-[10px] text-[var(--bb-text-tertiary)] group-hover:text-[var(--bb-primary)]"
                >
                  {isCopied(`s-${shade.stop}`) ? "Copied!" : label}
                </button>
              </div>
            );
          })}
        </div>

        {/* Export */}
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Tabs value={exportKind} onValueChange={(v) => setExportKind(v as "config" | "css")}>
              <TabList label="Export format">
                <Tab value="config">Tailwind config</Tab>
                <Tab value="css">CSS variables</Tab>
              </TabList>
            </Tabs>
            <Button variant="secondary" size="sm" onClick={() => void copy(exportText, "export")}>
              {isCopied("export") ? "Copied!" : "Copy"}
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-[var(--bb-bg-page)] p-4 font-mono text-xs leading-relaxed text-[var(--bb-secondary)]">
            {exportText}
          </pre>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
