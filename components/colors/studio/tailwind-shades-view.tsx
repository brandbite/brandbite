// -----------------------------------------------------------------------------
// @file: components/colors/studio/tailwind-shades-view.tsx
// @purpose: Tailwind shade scale for the workspace's selected color. Copying a
//           shade, selecting it and making it the base are separate actions.
//           Exports Tailwind v4 @theme, v3 config and plain CSS variables.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  createStudioPalette,
  formatHex,
  formatHsl,
  formatRgb,
  getSelectedColor,
  hexToRgb,
  readableTextOn,
  setStudioColorHex,
  tailwindScale,
  tailwindScaleToConfig,
  tailwindScaleToCssVars,
  tailwindScaleToThemeV4,
  toColorKey,
  type StudioPalette,
} from "@/lib/colors";

import { HexField } from "./hex-field";
import { CheckIcon } from "./icons";
import { usePaletteOpener } from "./open-palette";
import { CopyRow, downloadText, SavePaletteAction, Segmented, STUDIO_FIELD } from "./palette-parts";
import { StudioButton, studioButtonClasses } from "./studio-button";
import { WorkspacePanel } from "./studio-shell";
import { useSavedPalettes } from "./use-saved-palettes";
import { useStudioCopy } from "./use-studio-copy";
import { useWorkspace, workspaceActions } from "./workspace-store";

const DEFAULT_HEX = "#ff6426";

type OutputFormat = "v4" | "v3" | "css";

const OUTPUT_HINTS: Record<OutputFormat, string> = {
  v4: "Add this to your main CSS file. For Tailwind CSS v4 and later.",
  v3: "Add this under theme.extend in tailwind.config.js. For Tailwind CSS v3.",
  css: "Plain CSS variables for any project.",
};

const OUTPUT_FILES: Record<OutputFormat, string> = {
  v4: "theme.css",
  v3: "tailwind-colors.js",
  css: "colors.css",
};

export function TailwindShadesView() {
  const workspace = useWorkspace();
  const store = useSavedPalettes();
  const { copy, isCopied } = useStudioCopy();

  const base = getSelectedColor(workspace)?.hex ?? DEFAULT_HEX;
  const [name, setName] = useState("brand");
  const [baseStop, setBaseStop] = useState<number | null>(null);
  const [selectedStop, setSelectedStop] = useState<number | null>(null);
  const [format, setFormat] = useState<OutputFormat>("v4");

  const shades = useMemo(() => tailwindScale(base, baseStop ?? undefined), [base, baseStop]);
  const baseShade = shades.find((s) => s.isBase) ?? shades[5];
  const selected = shades.find((s) => s.stop === selectedStop) ?? baseShade;

  const output = useMemo(() => {
    if (format === "v4") return tailwindScaleToThemeV4(name, shades);
    if (format === "v3") return tailwindScaleToConfig(name, shades);
    return tailwindScaleToCssVars(name, shades);
  }, [format, name, shades]);

  const setBaseColor = (hex: string) => {
    const color = getSelectedColor(workspace);
    if (workspace.activePalette && color) {
      workspaceActions.commit(setStudioColorHex(workspace.activePalette, color.id, hex));
    } else {
      workspaceActions.load(
        createStudioPalette({ name: "Untitled palette", hexes: [hex], sourceTool: "tailwind" }),
      );
    }
    setSelectedStop(null);
  };

  const setSelectedAsBase = () => {
    setBaseStop(selected.stop);
    setBaseColor(selected.hex);
    setSelectedStop(selected.stop);
  };

  const reset = () => {
    setBaseColor(DEFAULT_HEX);
    setName("brand");
    setBaseStop(null);
  };

  const scalePalette: StudioPalette = useMemo(
    () =>
      createStudioPalette({
        name: `${toColorKey(name)} shades`,
        hexes: shades.map((s) => s.hex),
        sourceTool: "tailwind",
      }),
    [name, shades],
  );

  const opener = usePaletteOpener(async (active) => (await store.save(active)).ok);

  return (
    <>
      <WorkspacePanel>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-[280px] max-w-full">
            <HexField label="Base color" value={base} onChange={setBaseColor} />
          </div>
          <label className="text-sm leading-5 font-medium">
            Color name
            <input
              value={name}
              spellCheck={false}
              onChange={(event) => setName(event.target.value)}
              className={`${STUDIO_FIELD} mt-2 block w-[220px] max-w-full`}
            />
          </label>
          <div className="ml-auto max-[767px]:ml-0">
            <StudioButton variant="secondary" onClick={reset}>
              Reset
            </StudioButton>
          </div>
        </div>

        <p className="mt-6 rounded-[10px] bg-[var(--cs-soft)] px-4 py-2 text-sm leading-5">
          Click a color to copy its HEX. Use the circle below a shade to inspect it, then set it as
          your base if you like.
        </p>

        <ul className="mt-4 grid grid-cols-11 gap-2 max-[1199px]:grid-cols-6 max-[639px]:grid-cols-3">
          {shades.map((shade) => {
            const label = formatHex(shade.hex);
            const isSelected = shade.stop === selected.stop;
            return (
              <li
                key={shade.stop}
                className={`min-w-0 overflow-hidden rounded-[10px] border ${
                  isSelected ? "border-[var(--cs-text)]" : "border-[var(--cs-border)]"
                }`}
              >
                <button
                  type="button"
                  aria-label={`Copy shade ${shade.stop}, ${label}`}
                  onClick={() => void copy(label, `shade-${shade.stop}`, label)}
                  className="flex h-20 w-full cursor-copy items-start justify-between gap-1 p-2 text-sm leading-5 font-semibold"
                  style={{ backgroundColor: shade.hex, color: readableTextOn(shade.hex) }}
                >
                  <span>{shade.stop}</span>
                  {isCopied(`shade-${shade.stop}`) ? <CheckIcon /> : null}
                </button>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Inspect shade ${shade.stop}`}
                  onClick={() => setSelectedStop(shade.stop)}
                  className="flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-1 py-1 text-center"
                >
                  <span className="font-mono text-xs leading-4 break-all select-text">{label}</span>
                  {shade.isBase ? (
                    <span className="text-xs leading-4 font-semibold text-[var(--cs-soft-text)]">
                      Base
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6 rounded-2xl bg-[var(--cs-soft)] p-6 max-[1199px]:grid-cols-1">
          <div className="flex items-center gap-4">
            <span
              className="h-14 w-14 shrink-0 rounded-[10px] border border-[var(--cs-border)]"
              style={{ backgroundColor: selected.hex }}
            />
            <div>
              <p className="text-sm leading-5">Selected shade</p>
              <p className="text-lg leading-[26px] font-semibold">
                {selected.stop}
                {selected.isBase ? " (base)" : ""}
              </p>
            </div>
          </div>
          <div className="min-w-0 rounded-[10px] bg-[var(--cs-surface)] px-3">
            <CopyRow label="HEX" value={formatHex(selected.hex)} />
            <CopyRow label="RGB" value={formatRgb(hexToRgb(selected.hex))} />
            <CopyRow label="HSL" value={formatHsl(selected.hsl)} />
          </div>
          <StudioButton variant="secondary" disabled={selected.isBase} onClick={setSelectedAsBase}>
            Set as base
          </StudioButton>
        </div>
      </WorkspacePanel>

      <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 max-[1199px]:grid-cols-1">
        <WorkspacePanel>
          <Segmented
            label="Output format"
            value={format}
            onChange={setFormat}
            options={[
              { value: "v4", label: "Tailwind v4" },
              { value: "v3", label: "Tailwind v3" },
              { value: "css", label: "CSS variables" },
            ]}
          />
          <p className="mt-3 text-sm leading-5 text-[var(--cs-muted)]">{OUTPUT_HINTS[format]}</p>
          <pre className="mt-3 overflow-x-auto rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-background)] p-4 font-mono text-sm leading-5 select-text">
            {output}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <StudioButton onClick={() => void copy(output, "output", "code")}>
              Copy code
            </StudioButton>
            <StudioButton
              variant="secondary"
              onClick={() => downloadText(OUTPUT_FILES[format], output)}
            >
              Download
            </StudioButton>
            <SavePaletteAction palette={scalePalette} store={store} />
          </div>
        </WorkspacePanel>

        <WorkspacePanel>
          <h2 className="text-2xl leading-8 font-semibold">Try it in context</h2>
          <p className="mt-1 mb-6 text-sm leading-5 text-[var(--cs-muted)]">
            How your color works in a real UI. Text color is chosen for contrast.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="rounded-[10px] px-5 py-2.5 text-sm leading-5 font-semibold"
              style={{ backgroundColor: selected.hex, color: readableTextOn(selected.hex) }}
            >
              Primary button
            </span>
            <span
              className="rounded-full px-3 py-1 text-sm leading-5 font-semibold"
              style={{ backgroundColor: shades[1].hex, color: shades[8].hex }}
            >
              Brand badge
            </span>
          </div>
          <p className="mt-6 text-lg leading-[26px] font-semibold" style={{ color: shades[7].hex }}>
            A heading with your brand color
          </p>
          <p className="mt-1 text-sm leading-5 text-[var(--cs-muted)]">
            This is how your brand color can look in text, buttons, badges and UI components.
          </p>
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-[var(--cs-border)] p-4">
            <span
              className="h-12 w-12 shrink-0 rounded-[10px]"
              style={{ backgroundColor: shades[1].hex }}
            />
            <span>
              <span className="block text-sm leading-5 font-semibold">Sample card</span>
              <span className="block text-sm leading-5 text-[var(--cs-muted)]">
                A simple card using your brand color for key elements.
              </span>
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/colors/contrast-checker" className={studioButtonClasses("secondary")}>
              Check contrast
            </Link>
            <StudioButton
              variant="secondary"
              onClick={() => opener.requestOpen(scalePalette, "/colors/color-palette-generator")}
            >
              Open in generator
            </StudioButton>
          </div>
        </WorkspacePanel>
      </div>
      {opener.dialog}
    </>
  );
}
