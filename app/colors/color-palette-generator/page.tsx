// -----------------------------------------------------------------------------
// @file: app/colors/color-palette-generator/page.tsx
// @purpose: Palette generator — random harmonious palettes with lock/reroll, or
//           dominant-color extraction from an uploaded image (client-side).
// -----------------------------------------------------------------------------

"use client";

import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PaletteDisplay } from "@/components/colors/palette-display";
import { ImageColorExtractor } from "@/components/colors/image-color-extractor";
import { SavePaletteButton } from "@/components/colors/save-palette-button";
import { SavedPalettesList } from "@/components/colors/saved-palettes-list";
import { randomPalette, toPaletteColor } from "@/lib/colors";
import type { Palette, PaletteSource } from "@/lib/colors";

type Mode = "random" | "image";

// Deterministic starter palette so the first (server-rendered) paint matches
// the client — avoids a hydration mismatch and the setState-in-effect pattern.
// "Generate palette" then rerolls into random harmonies.
const STARTER: Palette = ["#f15b2b", "#424143", "#fff0ea", "#7a7a7a", "#2bb0f1"].map((hex) =>
  toPaletteColor(hex),
);

export default function PaletteGeneratorPage() {
  const [mode, setMode] = useState<Mode>("random");
  const [palette, setPalette] = useState<Palette>(STARTER);
  const [savedKey, setSavedKey] = useState(0);

  const source: PaletteSource = mode === "image" ? "EXTRACTOR" : "GENERATOR";

  const toggleLock = (index: number) =>
    setPalette((prev) => prev.map((c, i) => (i === index ? { ...c, locked: !c.locked } : c)));

  const reroll = () =>
    setPalette((prev) => {
      const fresh = randomPalette(Math.max(5, prev.length));
      return prev.length === 0
        ? fresh
        : prev.map((c, i) => (c.locked ? c : { ...fresh[i % fresh.length], locked: false }));
    });

  const saveSlot = useMemo(
    () => (
      <SavePaletteButton
        palette={palette}
        source={source}
        onSaved={() => setSavedKey((k) => k + 1)}
      />
    ),
    [palette, source],
  );

  return (
    <div className="min-h-screen bg-[var(--bb-bg-page)] text-[var(--bb-secondary)]">
      <SiteHeader activePage="Color Tools" />
      <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-brand text-3xl font-bold md:text-4xl">Color Palette Generator</h1>
            <p className="mt-2 max-w-2xl text-[var(--bb-text-secondary)]">
              Roll harmonious palettes and lock the ones you like, or pull colors straight out of an
              image. Everything runs in your browser.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabList label="Generator mode" className="mb-6">
            <Tab value="random">Random harmonies</Tab>
            <Tab value="image">From image</Tab>
          </TabList>

          <TabPanel value="random">
            <div className="mb-4">
              <Button variant="primary" onClick={reroll}>
                Generate palette
              </Button>
              <span className="ml-3 text-sm text-[var(--bb-text-tertiary)]">
                Lock 🔒 any color to keep it when you regenerate.
              </span>
            </div>
            <PaletteDisplay palette={palette} onToggleLock={toggleLock} savedSlot={saveSlot} />
          </TabPanel>

          <TabPanel value="image">
            <div className="mb-6">
              <ImageColorExtractor colorCount={6} onExtracted={setPalette} />
            </div>
            <PaletteDisplay palette={palette} savedSlot={saveSlot} />
          </TabPanel>
        </Tabs>

        <SavedPalettesList refreshKey={savedKey} />
      </main>
      <SiteFooter />
    </div>
  );
}
