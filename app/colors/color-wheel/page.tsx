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
import { HARMONY_LABELS, harmony } from "@/lib/colors";
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
  const [kind, setKind] = useState<HarmonyKind>("complementary");
  const [savedKey, setSavedKey] = useState(0);

  const palette = useMemo(
    () => harmony(kind, { h: hue, s: saturation, l: 50 }),
    [kind, hue, saturation],
  );

  return (
    <div className="min-h-screen bg-[var(--bb-bg-page)] text-[var(--bb-secondary)]">
      <SiteHeader activePage="Color Tools" />
      <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-brand text-3xl font-bold md:text-4xl">Color Wheel</h1>
            <p className="mt-2 max-w-2xl text-[var(--bb-text-secondary)]">
              Drag the handle to choose a color, then pick a harmony to build a palette. Arrow keys
              nudge hue and saturation.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-6">
            <WheelInteractive
              hue={hue}
              saturation={saturation}
              harmonyKind={kind}
              onChange={({ hue: h, saturation: s }) => {
                setHue(h);
                setSaturation(s);
              }}
            />
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
