// -----------------------------------------------------------------------------
// @file: app/colors/color-wheel/page.tsx
// @purpose: Interactive color wheel. Move the handle to set hue/saturation and
//           see the selected harmony's palette; copy any color; save when authed.
// -----------------------------------------------------------------------------

"use client";

import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tabs, TabList, Tab } from "@/components/ui/tabs";
import { WheelInteractive } from "@/components/colors/wheel-interactive";
import { PaletteDisplay } from "@/components/colors/palette-display";
import { SavePaletteButton } from "@/components/colors/save-palette-button";
import { SavedPalettesList } from "@/components/colors/saved-palettes-list";
import { HARMONY_LABELS, harmony, hexToHsl, hslToHex, normalizeHex } from "@/lib/colors";
import type { HarmonyKind } from "@/lib/colors";

const HARMONY_KINDS: HarmonyKind[] = [
  "complementary",
  "analogous",
  "triadic",
  "tetradic",
  "monochromatic",
];

export default function ColorWheelPage() {
  const [hue, setHue] = useState(20);
  const [saturation, setSaturation] = useState(85);
  const [lightness, setLightness] = useState(50);
  const [kind, setKind] = useState<HarmonyKind>("complementary");
  const [savedKey, setSavedKey] = useState(0);
  // Editable hex text (kept in sync with the wheel/sliders). Free text so an
  // intermediate invalid value while typing doesn't reset the wheel.
  const [hexInput, setHexInput] = useState(() => hslToHex({ h: 20, s: 85, l: 50 }));

  const currentHex = hslToHex({ h: hue, s: saturation, l: lightness });
  const hexValid = normalizeHex(hexInput) !== null;

  // Commit an HSL selection from the wheel or sliders and mirror it into the
  // hex field so the text input always reflects the current color.
  const setFromHsl = (h: number, s: number, l: number) => {
    setHue(h);
    setSaturation(s);
    setLightness(l);
    setHexInput(hslToHex({ h, s, l }));
  };

  // A typed/picked hex drives the wheel + sliders.
  const handleHexInput = (value: string) => {
    setHexInput(value);
    const next = normalizeHex(value);
    if (next) {
      const hsl = hexToHsl(next);
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);
    }
  };

  const palette = useMemo(
    () => harmony(kind, { h: hue, s: saturation, l: lightness }),
    [kind, hue, saturation, lightness],
  );

  return (
    <div className="min-h-screen bg-[var(--bb-bg-page)] text-[var(--bb-secondary)]">
      <SiteHeader activePage="Color Tools" />
      <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-brand text-3xl font-bold md:text-4xl">Color Wheel</h1>
            <p className="mt-2 max-w-2xl text-[var(--bb-text-secondary)]">
              Drag the handle, type a hex, or pick a color — then choose a harmony to build a
              palette. Arrow keys nudge hue and saturation; the slider sets lightness.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-6">
            <WheelInteractive
              hue={hue}
              saturation={saturation}
              lightness={lightness}
              harmonyKind={kind}
              onChange={({ hue: h, saturation: s }) => setFromHsl(h, s, lightness)}
            />

            {/* Color input: swatch + hex field + native picker */}
            <div className="flex w-full max-w-[320px] items-center gap-2">
              <span
                className="h-10 w-10 shrink-0 rounded-lg border border-[var(--bb-border)]"
                style={{ backgroundColor: currentHex }}
                aria-hidden
              />
              <div className="relative flex-1">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-[var(--bb-text-muted)]">
                  #
                </span>
                <input
                  type="text"
                  aria-label="Hex color"
                  spellCheck={false}
                  value={hexInput.replace(/^#/, "").toUpperCase()}
                  onChange={(e) => handleHexInput(`#${e.target.value}`)}
                  className={`w-full rounded-lg border bg-[var(--bb-bg-page)] py-2 pr-3 pl-6 font-mono text-sm tracking-wide text-[var(--bb-secondary)] uppercase outline-none focus:border-[var(--bb-primary)] ${
                    hexValid
                      ? "border-[var(--bb-border-input)]"
                      : "border-[var(--bb-danger-border)]"
                  }`}
                />
              </div>
              <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-[var(--bb-border-input)]">
                <span
                  className="block h-full w-full"
                  style={{
                    background:
                      "conic-gradient(hsl(0,90%,55%),hsl(60,90%,55%),hsl(120,90%,55%),hsl(180,90%,55%),hsl(240,90%,55%),hsl(300,90%,55%),hsl(360,90%,55%))",
                  }}
                />
                <input
                  type="color"
                  aria-label="Pick a color"
                  value={currentHex}
                  onChange={(e) => handleHexInput(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>

            {/* Lightness slider — the wheel controls hue + saturation only */}
            <div className="w-full max-w-[320px]">
              <label
                htmlFor="cw-light"
                className="mb-1 flex justify-between text-xs font-semibold text-[var(--bb-text-tertiary)]"
              >
                <span>Lightness</span>
                <span className="font-mono">{Math.round(lightness)}%</span>
              </label>
              <input
                id="cw-light"
                type="range"
                min={0}
                max={100}
                value={Math.round(lightness)}
                onChange={(e) => setFromHsl(hue, saturation, Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full"
                style={{
                  background: `linear-gradient(to right, ${hslToHex({ h: hue, s: saturation, l: 0 })}, ${hslToHex(
                    { h: hue, s: saturation, l: 50 },
                  )}, ${hslToHex({ h: hue, s: saturation, l: 100 })})`,
                }}
              />
            </div>

            <Tabs value={kind} onValueChange={(v) => setKind(v as HarmonyKind)}>
              <TabList label="Harmony" className="flex-wrap justify-center">
                {HARMONY_KINDS.map((k) => (
                  <Tab key={k} value={k}>
                    {HARMONY_LABELS[k]}
                  </Tab>
                ))}
              </TabList>
            </Tabs>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">{HARMONY_LABELS[kind]} palette</h2>
            <PaletteDisplay
              palette={palette}
              savedSlot={
                <SavePaletteButton
                  palette={palette}
                  source="WHEEL"
                  onSaved={() => setSavedKey((k) => k + 1)}
                />
              }
            />
          </div>
        </div>

        <SavedPalettesList refreshKey={savedKey} />
      </main>
      <SiteFooter />
    </div>
  );
}
