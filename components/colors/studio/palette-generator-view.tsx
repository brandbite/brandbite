// -----------------------------------------------------------------------------
// @file: components/colors/studio/palette-generator-view.tsx
// @purpose: Generate palettes under a harmony rule, with locks, reordering, undo
//           and redo, a color inspector, roles and a role-based preview. Works on
//           the shared workspace palette, so other tools see the same colors.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useRef, useState } from "react";

import {
  addStudioColor,
  clonePaletteWithNewIds,
  formatHex,
  formatHsl,
  formatRgb,
  HARMONY_LABELS,
  harmonyOfSize,
  hexToHsl,
  hexToRgb,
  hslToHex,
  moveStudioColor,
  randomHarmony,
  regenerateWithHarmony,
  removeStudioColor,
  setStudioColorHex,
  studioPaletteToCss,
  toggleStudioLock,
  toPaletteColor,
  type ColorRole,
  type HarmonyKind,
  type StudioPalette,
} from "@/lib/colors";

import { HexField } from "./hex-field";
import { usePaletteOpener } from "./open-palette";
import { PalettePreview } from "./palette-preview";
import {
  CopyRow,
  downloadText,
  RoleFields,
  SavedPalettesStrip,
  SavePaletteAction,
  STUDIO_FIELD,
} from "./palette-parts";
import { StudioButton } from "./studio-button";
import { WorkspacePanel } from "./studio-shell";
import { StudioSwatch } from "./studio-swatch";
import { useSavedPalettes } from "./use-saved-palettes";
import { useStudioCopy } from "./use-studio-copy";
import { useWorkspace, workspaceActions } from "./workspace-store";

const MIN_COLORS = 2;
const MAX_COLORS = 12;

// Fixed values so the first server render matches the client.
const STARTER: StudioPalette = {
  id: "starter-palette",
  name: "Untitled palette",
  colors: ["#173b59", "#41c2d0", "#c9f1ed", "#ff6426", "#f6e5d5"].map((hex, index) => ({
    id: `starter-${index}`,
    hex,
    locked: false,
  })),
  roles: {},
  sourceTool: "generator",
  tags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const HARMONY_KINDS = Object.keys(HARMONY_LABELS) as HarmonyKind[];
type HarmonyChoice = HarmonyKind | "custom";

function isTypingOrControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("input, select, textarea, button, a, [role=dialog]") !== null
  );
}

export function PaletteGeneratorView() {
  const workspace = useWorkspace();
  const store = useSavedPalettes();
  const { copy } = useStudioCopy();

  const [harmony, setHarmony] = useState<HarmonyChoice>("analogous");
  const [clearedRoles, setClearedRoles] = useState<ColorRole[]>([]);
  const sliderDragging = useRef(false);

  const palette = workspace.activePalette ?? STARTER;
  const selected =
    palette.colors.find((c) => c.id === workspace.selectedColorId) ?? palette.colors[0];

  /** The first edit moves the starter into the workspace, so it can be undone. */
  const apply = (next: StudioPalette, selectedColorId?: string) => {
    if (!workspace.activePalette) workspaceActions.load(palette);
    workspaceActions.commit(next, selectedColorId);
    setClearedRoles([]);
  };

  const generate = () => {
    const kind = harmony === "custom" ? randomHarmony() : harmony;
    const fresh = regenerateWithHarmony(
      palette.colors.map((c) => toPaletteColor(c.hex, c.locked)),
      kind,
    );
    apply({
      ...palette,
      colors: palette.colors.map((c, index) => ({ ...c, hex: fresh[index].hex })),
      updatedAt: new Date().toISOString(),
    });
  };

  const generateRef = useRef(generate);
  useEffect(() => {
    generateRef.current = generate;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isTypingOrControl(event.target)) return;
      event.preventDefault();
      generateRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const changeColor = (hex: string) => {
    apply(setStudioColorHex(palette, selected.id, hex));
    setHarmony("custom");
  };

  /** A slider drag is one undo step: commit on the first change, then refine it. */
  const changeFromSlider = (hex: string) => {
    if (sliderDragging.current) {
      workspaceActions.replace(setStudioColorHex(palette, selected.id, hex));
    } else {
      sliderDragging.current = true;
      changeColor(hex);
    }
  };
  const endSliderDrag = () => {
    sliderDragging.current = false;
  };

  const addColor = () => {
    const kind = harmony === "custom" ? "analogous" : harmony;
    const generated = harmonyOfSize(
      kind,
      hexToHsl(palette.colors[0].hex),
      palette.colors.length + 1,
    );
    apply(addStudioColor(palette, generated[generated.length - 1].hex));
  };

  const removeColor = () => {
    const removable = [...palette.colors].reverse().find((c) => !c.locked);
    if (!removable) return;
    const result = removeStudioColor(palette, removable.id);
    apply(result.palette);
    setClearedRoles(result.clearedRoles);
  };

  const canRemove = palette.colors.length > MIN_COLORS && palette.colors.some((c) => !c.locked);

  const opener = usePaletteOpener(async (active) => (await store.save(active)).ok);

  const hsl = hexToHsl(selected.hex);
  const paletteToSave = palette.id === STARTER.id ? clonePaletteWithNewIds(palette) : palette;

  return (
    <>
      <WorkspacePanel>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm leading-5 font-medium">
            Harmony
            <select
              value={harmony}
              onChange={(event) => setHarmony(event.target.value as HarmonyChoice)}
              className={`${STUDIO_FIELD} mt-2 block min-w-[180px]`}
            >
              {HARMONY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {HARMONY_LABELS[kind]}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>

          <div>
            <p id="color-count" className="text-sm leading-5 font-medium">
              Colors
            </p>
            <div
              role="group"
              aria-labelledby="color-count"
              className="mt-2 flex items-center gap-1"
            >
              <StudioButton
                variant="secondary"
                aria-label="Remove a color"
                disabled={!canRemove}
                onClick={removeColor}
              >
                −
              </StudioButton>
              <span aria-live="polite" className="w-8 text-center text-sm leading-5 font-semibold">
                {palette.colors.length}
              </span>
              <StudioButton
                variant="secondary"
                aria-label="Add a color"
                disabled={palette.colors.length >= MAX_COLORS}
                onClick={addColor}
              >
                +
              </StudioButton>
            </div>
          </div>

          <div className="flex gap-1">
            <StudioButton
              variant="tertiary"
              disabled={workspace.undoStack.length === 0}
              onClick={workspaceActions.undo}
            >
              Undo
            </StudioButton>
            <StudioButton
              variant="tertiary"
              disabled={workspace.redoStack.length === 0}
              onClick={workspaceActions.redo}
            >
              Redo
            </StudioButton>
          </div>

          <div className="ml-auto flex flex-wrap gap-2 max-[767px]:ml-0">
            <SavePaletteAction
              palette={paletteToSave}
              store={store}
              onSaved={(saved) => {
                const index = palette.colors.findIndex((c) => c.id === selected.id);
                workspaceActions.load(saved, saved.colors[index]?.id);
              }}
            />
            <StudioButton onClick={generate}>Generate palette</StudioButton>
          </div>
        </div>

        <p className="mt-3 text-sm leading-5 text-[var(--cs-muted)]">
          Press Space to generate. Lock a color to keep it; the first locked color anchors the
          harmony.
        </p>

        {clearedRoles.length > 0 ? (
          <p
            role="status"
            className="mt-3 rounded-[10px] bg-[var(--cs-soft)] px-4 py-2 text-sm leading-5"
          >
            Removing that color cleared the {clearedRoles.join(" and ")} role. Choose a new color
            below.
          </p>
        ) : null}

        <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          {palette.colors.map((color, index) => (
            <li key={color.id} className="min-w-0">
              <StudioSwatch
                hex={color.hex}
                selected={color.id === selected.id}
                locked={color.locked}
                onToggleLock={() => apply(toggleStudioLock(palette, color.id))}
                onEdit={() => {
                  if (!workspace.activePalette) workspaceActions.load(palette);
                  workspaceActions.select(color.id);
                }}
                onMoveLeft={index > 0 ? () => apply(moveStudioColor(palette, color.id, -1)) : null}
                onMoveRight={
                  index < palette.colors.length - 1
                    ? () => apply(moveStudioColor(palette, color.id, 1))
                    : null
                }
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--cs-border)] pt-4">
          <StudioButton
            variant="secondary"
            onClick={() =>
              void copy(
                palette.colors.map((c) => formatHex(c.hex)).join(", "),
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
          <StudioButton
            variant="secondary"
            onClick={() =>
              downloadText(
                "palette.json",
                JSON.stringify(
                  { name: palette.name, colors: palette.colors.map((c) => formatHex(c.hex)) },
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            Export JSON
          </StudioButton>
          <StudioButton
            variant="secondary"
            onClick={() => opener.requestOpen(palette, "/colors/contrast-checker")}
          >
            Check contrast
          </StudioButton>
          <StudioButton
            variant="secondary"
            onClick={() =>
              opener.requestOpen(palette, "/colors/tailwind-color-generator", selected.id)
            }
          >
            Create shades
          </StudioButton>
        </div>
      </WorkspacePanel>

      <div className="grid grid-cols-2 gap-6 max-[1199px]:grid-cols-1">
        <section
          aria-label="Preview your palette"
          className="min-w-0 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
        >
          <h2 className="text-2xl leading-8 font-semibold">Preview your palette</h2>
          <p className="mt-1 mb-4 text-sm leading-5 text-[var(--cs-muted)]">
            See how your colors work together in a real design.
          </p>
          <PalettePreview palette={palette} />
          <h3 className="mt-6 mb-3 text-lg leading-[26px] font-semibold">Color roles</h3>
          <RoleFields palette={palette} onChange={(next) => apply(next)} />
        </section>

        <section
          aria-label="Fine-tune selected color"
          className="min-w-0 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
        >
          <h2 className="text-2xl leading-8 font-semibold">Fine-tune selected color</h2>
          <p className="mt-1 mb-4 text-sm leading-5 text-[var(--cs-muted)]">
            Changing a color by hand switches the harmony to Custom.
          </p>
          <HexField label="Selected color" value={selected.hex} onChange={changeColor} />
          <div className="mt-4 rounded-[10px] border border-[var(--cs-border)] px-3">
            <CopyRow label="RGB" value={formatRgb(hexToRgb(selected.hex))} />
            <CopyRow label="HSL" value={formatHsl(hsl)} />
          </div>
          {(
            [
              ["Saturation", "s"],
              ["Lightness", "l"],
            ] as const
          ).map(([label, channel]) => (
            <label key={channel} className="mt-4 block text-sm leading-5 font-medium">
              <span className="flex justify-between">
                {label}
                <span className="font-mono">{Math.round(hsl[channel])}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(hsl[channel])}
                onChange={(event) =>
                  changeFromSlider(hslToHex({ ...hsl, [channel]: Number(event.target.value) }))
                }
                onPointerUp={endSliderDrag}
                onKeyUp={endSliderDrag}
                onBlur={endSliderDrag}
                className="mt-2 h-11 w-full cursor-pointer accent-[var(--cs-soft-text)]"
              />
            </label>
          ))}
        </section>
      </div>

      <SavedPalettesStrip
        store={store}
        onOpen={(saved) => opener.requestOpen(saved, "/colors/color-palette-generator")}
      />
      {opener.dialog}
    </>
  );
}
