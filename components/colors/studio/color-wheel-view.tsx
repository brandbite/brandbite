// -----------------------------------------------------------------------------
// @file: components/colors/studio/color-wheel-view.tsx
// @purpose: Build a harmony from a base color. Starts from the workspace's
//           selected color; HEX, RGB and HSL are copied on separate rows.
// -----------------------------------------------------------------------------

"use client";

import { useMemo, useState } from "react";

import { WheelInteractive } from "@/components/colors/wheel-interactive";
import {
  createStudioPalette,
  formatHex,
  formatHsl,
  formatRgb,
  getSelectedColor,
  HARMONY_LABELS,
  harmony,
  hexToHsl,
  hexToRgb,
  hslToHex,
  studioPaletteToCss,
  type HarmonyKind,
  type HSL,
} from "@/lib/colors";

import { HexField } from "./hex-field";
import { usePaletteOpener } from "./open-palette";
import { PalettePreview } from "./palette-preview";
import { CopyRow, SavedPalettesStrip, SavePaletteAction, Segmented } from "./palette-parts";
import { StudioButton } from "./studio-button";
import { WorkspacePanel } from "./studio-shell";
import { useSavedPalettes } from "./use-saved-palettes";
import { useStudioCopy } from "./use-studio-copy";
import { useWorkspace } from "./workspace-store";

const DEFAULT_HEX = "#ff6426";
const KINDS = Object.keys(HARMONY_LABELS) as HarmonyKind[];

function colorLabel(kind: HarmonyKind, index: number): string {
  if (kind === "monochromatic") return `Tone ${index + 1}`;
  if (index === 0 || (kind === "analogous" && index === 2)) return "Base";
  return kind === "complementary" ? "Complement" : `Color ${index + 1}`;
}

export function ColorWheelView() {
  const workspace = useWorkspace();
  const store = useSavedPalettes();
  const { copy } = useStudioCopy();

  const [override, setOverride] = useState<HSL | null>(null);
  const [kind, setKind] = useState<HarmonyKind>("complementary");

  const base = override ?? hexToHsl(getSelectedColor(workspace)?.hex ?? DEFAULT_HEX);
  const baseHex = hslToHex(base);

  const colors = useMemo(() => harmony(kind, base), [kind, base]);
  const hexKey = colors.map((c) => c.hex).join();
  const palette = useMemo(
    () =>
      createStudioPalette({
        name: `${HARMONY_LABELS[kind]} palette`,
        hexes: hexKey.split(","),
        sourceTool: "wheel",
      }),
    [hexKey, kind],
  );

  const opener = usePaletteOpener(async (active) => (await store.save(active)).ok);

  return (
    <>
      <WorkspacePanel>
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-2xl leading-8 font-semibold">Build a harmony</h2>
          <StudioButton variant="tertiary" onClick={() => setOverride(hexToHsl(DEFAULT_HEX))}>
            Reset
          </StudioButton>
        </div>
        <Segmented
          label="Harmony"
          value={kind}
          onChange={setKind}
          options={KINDS.map((value) => ({ value, label: HARMONY_LABELS[value] }))}
        />

        <div className="mt-8 grid grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-8 max-[1023px]:grid-cols-1">
          <div className="flex flex-col items-center gap-4">
            <WheelInteractive
              hue={base.h}
              saturation={base.s}
              lightness={base.l}
              harmonyKind={kind}
              size={280}
              onChange={({ hue, saturation }) => setOverride({ h: hue, s: saturation, l: base.l })}
            />
            <div className="w-full">
              <HexField
                label="Base color"
                value={baseHex}
                onChange={(hex) => setOverride(hexToHsl(hex))}
              />
            </div>
            <label className="w-full text-sm leading-5 font-medium">
              <span className="flex justify-between">
                Lightness
                <span className="font-mono">{Math.round(base.l)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(base.l)}
                onChange={(event) => setOverride({ ...base, l: Number(event.target.value) })}
                className="mt-2 h-11 w-full cursor-pointer accent-[var(--cs-soft-text)]"
              />
            </label>
            <p className="w-full text-sm leading-5 text-[var(--cs-muted)]">
              Drag the handle, or focus the wheel and use the arrow keys.
            </p>
          </div>

          <div className="min-w-0">
            <h3 className="mb-4 text-lg leading-[26px] font-semibold">
              Your {HARMONY_LABELS[kind].toLowerCase()} palette
            </h3>
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
              {colors.map((color, index) => (
                <li
                  key={`${color.hex}-${index}`}
                  className="min-w-0 overflow-hidden rounded-2xl border border-[var(--cs-border)]"
                >
                  <div className="h-24 p-3" style={{ backgroundColor: color.hex }}>
                    <span className="rounded-full bg-[var(--cs-surface)] px-3 py-1 text-sm leading-5 font-medium">
                      {colorLabel(kind, index)}
                    </span>
                  </div>
                  <div className="px-3">
                    <CopyRow label="HEX" value={formatHex(color.hex)} />
                    <CopyRow label="RGB" value={formatRgb(hexToRgb(color.hex))} />
                    <CopyRow label="HSL" value={formatHsl(color.hsl)} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <StudioButton
                variant="secondary"
                onClick={() =>
                  void copy(
                    colors.map((c) => formatHex(c.hex)).join(", "),
                    "hex-list",
                    "all HEX values",
                  )
                }
              >
                Copy HEX
              </StudioButton>
              <StudioButton
                variant="secondary"
                onClick={() => void copy(studioPaletteToCss(palette), "css", "CSS variables")}
              >
                Copy CSS
              </StudioButton>
              <SavePaletteAction palette={palette} store={store} />
              <StudioButton
                onClick={() => opener.requestOpen(palette, "/colors/color-palette-generator")}
              >
                Open in generator
              </StudioButton>
            </div>
          </div>
        </div>

        <hr className="my-8 border-[var(--cs-border)]" />
        <h3 className="mb-4 text-lg leading-[26px] font-semibold">Preview the pairing</h3>
        <div className="max-w-[720px]">
          <PalettePreview palette={palette} />
        </div>
      </WorkspacePanel>

      <SavedPalettesStrip
        store={store}
        source="wheel"
        onOpen={(saved) => opener.requestOpen(saved, "/colors/color-palette-generator")}
      />
      {opener.dialog}
    </>
  );
}
