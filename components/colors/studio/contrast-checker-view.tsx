// -----------------------------------------------------------------------------
// @file: components/colors/studio/contrast-checker-view.tsx
// @purpose: WCAG text contrast for one color pair: live preview, four independent
//           results, a lightness-only suggestion for failing pairs, and saving the
//           pair as a palette that keeps its text and background roles.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useState } from "react";

import { useToast } from "@/components/ui/toast-provider";
import {
  contrastRatio,
  createStudioPalette,
  evaluateContrast,
  formatContrastRatio,
  formatHex,
  isLargeText,
  setStudioRole,
  suggestAccessibleColor,
  type StudioPalette,
} from "@/lib/colors";

import { HexField } from "./hex-field";
import { CheckIcon, CloseIcon } from "./icons";
import { usePaletteOpener } from "./open-palette";
import { WorkspacePanel } from "./studio-shell";
import { StudioButton } from "./studio-button";
import { useSavedPalettes } from "./use-saved-palettes";
import { useStudioCopy } from "./use-studio-copy";
import { useWorkspace } from "./workspace-store";

const DEFAULT_PAIR = { foreground: "#173b59", background: "#ffffff" };
const SIZES = [14, 16, 18, 20, 24, 32];
const WEIGHTS = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
];
const FIELD =
  "h-12 w-full rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm leading-5";

type Pair = { foreground: string; background: string };

function rolePair(palette: StudioPalette | null): Pair | null {
  if (!palette) return null;
  const hexOf = (id?: string) => palette.colors.find((c) => c.id === id)?.hex;
  const foreground = hexOf(palette.roles.text);
  const background = hexOf(palette.roles.background);
  return foreground && background ? { foreground, background } : null;
}

function Verdict({ pass }: { pass: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm leading-5 font-medium ${
        pass ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE4E2] text-[#B42318]"
      }`}
    >
      {pass ? <CheckIcon /> : <CloseIcon />}
      {pass ? "Pass" : "Fail"}
    </span>
  );
}

function Swatch({ hex }: { hex: string }) {
  return (
    <span
      className="block h-10 w-10 shrink-0 rounded-[10px] border border-[var(--cs-border)]"
      style={{ backgroundColor: hex }}
    />
  );
}

export function ContrastCheckerView() {
  const workspace = useWorkspace();
  const store = useSavedPalettes();
  const { copy } = useStudioCopy();
  const { showToast } = useToast();

  const [pair, setPair] = useState<Pair | null>(null);
  const [undoForeground, setUndoForeground] = useState<string | null>(null);
  const [sampleText, setSampleText] = useState("Good design starts with clarity.");
  const [size, setSize] = useState(16);
  const [weight, setWeight] = useState(400);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const palette = workspace.activePalette;
  const fromRoles = rolePair(palette);
  const { foreground, background } = pair ?? fromRoles ?? DEFAULT_PAIR;
  const needsRoles = pair === null && palette !== null && fromRoles === null;

  const result = evaluateContrast(foreground, background);
  const large = isLargeText(size, weight);
  const suggestion = result.aaNormal ? null : suggestAccessibleColor(foreground, background, 4.5);

  const update = (next: Partial<Pair>) => {
    setPair({ foreground, background, ...next });
    setUndoForeground(null);
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    setPair({ foreground: suggestion, background });
    setUndoForeground(foreground);
  };

  const undoSuggestion = () => {
    if (!undoForeground) return;
    setPair({ foreground: undoForeground, background });
    setUndoForeground(null);
  };

  const buildPalette = (): StudioPalette => {
    const created = createStudioPalette({
      name: `${formatHex(foreground)} on ${formatHex(background)}`,
      hexes: [foreground, background],
      sourceTool: "contrast",
    });
    const withText = setStudioRole(created, "text", created.colors[0].id);
    return setStudioRole(withText, "background", created.colors[1].id);
  };

  const savePairing = async () => {
    setSaving(true);
    setSaveError(null);
    const saved = await store.createMany([buildPalette()]);
    setSaving(false);
    if (saved.ok) showToast({ type: "success", title: "Pairing saved", durationMs: 3000 });
    else setSaveError(saved.message);
  };

  const opener = usePaletteOpener(async (active) => {
    const saved = await store.save(active);
    if (!saved.ok) setSaveError(saved.message);
    return saved.ok;
  });

  const savedPairings = store.palettes
    .map((p) => ({ palette: p, pair: rolePair(p) }))
    .filter((entry): entry is { palette: StudioPalette; pair: Pair } => {
      return entry.palette.sourceTool === "contrast" && entry.pair !== null;
    })
    .slice(0, 5);

  const rows = [
    { label: "AA normal text", pass: result.aaNormal, needed: "4.5:1" },
    { label: "AAA normal text", pass: result.aaaNormal, needed: "7:1" },
    { label: "AA large text", pass: result.aaLarge, needed: "3:1" },
    { label: "AAA large text", pass: result.aaaLarge, needed: "4.5:1" },
  ];

  return (
    <>
      <WorkspacePanel>
        <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-8 max-[1199px]:grid-cols-1">
          <div>
            <h2 className="text-2xl leading-8 font-semibold">Choose your colors</h2>
            <p className="mt-1 mb-6 text-sm leading-5 text-[var(--cs-muted)]">
              Set the text and background colors to check their contrast.
            </p>

            {needsRoles && palette ? (
              <div className="mb-6 rounded-[10px] bg-[var(--cs-soft)] p-4">
                <p className="text-sm leading-5">
                  {palette.name} has no text and background roles yet. Choose two of its colors.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {(["foreground", "background"] as const).map((target) => (
                    <label key={target} className="text-sm leading-5 font-medium">
                      {target === "foreground" ? "Text color" : "Background color"}
                      <select
                        defaultValue=""
                        onChange={(event) => {
                          if (event.target.value) update({ [target]: event.target.value });
                        }}
                        className={`${FIELD} mt-1 font-mono`}
                      >
                        <option value="">Choose</option>
                        {palette.colors.map((color) => (
                          <option key={color.id} value={color.hex}>
                            {formatHex(color.hex)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-4">
              <HexField
                label="Foreground (text)"
                value={foreground}
                onChange={(hex) => update({ foreground: hex })}
              />
              <HexField
                label="Background"
                value={background}
                onChange={(hex) => update({ background: hex })}
              />
              <StudioButton
                variant="secondary"
                onClick={() => update({ foreground: background, background: foreground })}
              >
                Swap colors
              </StudioButton>
            </div>

            <hr className="my-6 border-[var(--cs-border)]" />

            <label className="block text-sm leading-5 font-medium">
              Sample text
              <input
                value={sampleText}
                onChange={(event) => setSampleText(event.target.value)}
                className={`${FIELD} mt-2`}
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm leading-5 font-medium">
                Text size
                <select
                  value={size}
                  onChange={(event) => setSize(Number(event.target.value))}
                  className={`${FIELD} mt-2`}
                >
                  {SIZES.map((value) => (
                    <option key={value} value={value}>
                      {value}px
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm leading-5 font-medium">
                Weight
                <select
                  value={weight}
                  onChange={(event) => setWeight(Number(event.target.value))}
                  className={`${FIELD} mt-2`}
                >
                  {WEIGHTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="min-w-0">
            <h2 className="text-2xl leading-8 font-semibold">WCAG 2.2 text contrast</h2>
            <p className="mt-1 mb-6 text-sm leading-5 text-[var(--cs-muted)]">
              Live preview and results for this color pair.
            </p>

            <div
              className="rounded-2xl border border-[var(--cs-border)] p-6"
              style={{ backgroundColor: background, color: foreground }}
            >
              <p
                data-testid="contrast-sample"
                className="break-words"
                style={{ fontSize: size, fontWeight: weight, lineHeight: 1.3 }}
              >
                {sampleText}
              </p>
              <span
                className="mt-4 inline-block rounded-[10px] px-4 py-2.5 text-sm leading-5 font-semibold"
                style={{ backgroundColor: foreground, color: background }}
              >
                Get started
              </span>
            </div>

            <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-6 rounded-2xl bg-[var(--cs-soft)] p-6 max-[639px]:grid-cols-1">
              <div>
                <p className="text-sm leading-5">Contrast ratio</p>
                <p data-testid="contrast-ratio" className="text-[40px] leading-[48px] font-bold">
                  {formatContrastRatio(result.ratio)}
                </p>
              </div>
              <ul className="flex flex-col gap-2">
                {rows.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-3">
                    <span className="text-sm leading-5">
                      {row.label} <span className="text-[var(--cs-muted)]">({row.needed})</span>
                    </span>
                    <Verdict pass={row.pass} />
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">
              At {size}px {WEIGHTS.find((w) => w.value === weight)?.label.toLowerCase()}, this
              sample counts as {large ? "large" : "normal"} text.
            </p>
            {undoForeground ? (
              <div className="mt-3">
                <StudioButton variant="secondary" onClick={undoSuggestion}>
                  Undo suggestion
                </StudioButton>
              </div>
            ) : null}
          </div>
        </div>
      </WorkspacePanel>

      {suggestion ? (
        <WorkspacePanel>
          <h2 className="text-2xl leading-8 font-semibold">Try another pairing</h2>
          <p className="mt-1 mb-4 text-sm leading-5 text-[var(--cs-muted)]">
            The same hue at a lightness that reaches AA for normal text on this background.
          </p>
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--cs-border)] p-4">
            <Swatch hex={suggestion} />
            <span className="font-mono text-sm leading-5">{formatHex(suggestion)}</span>
            <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-sm leading-5 font-medium text-[#166534]">
              {formatContrastRatio(contrastRatio(suggestion, background))} passes AA normal text
            </span>
            <div className="ml-auto">
              <StudioButton onClick={applySuggestion}>Apply</StudioButton>
            </div>
          </div>
        </WorkspacePanel>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <StudioButton
          variant="secondary"
          onClick={() =>
            void copy(
              `${formatHex(foreground)} on ${formatHex(background)} (${formatContrastRatio(result.ratio)})`,
              "pairing",
              "pairing",
            )
          }
        >
          Copy pairing
        </StudioButton>
        <StudioButton
          variant="secondary"
          loading={saving}
          disabled={store.status !== "ready"}
          onClick={() => void savePairing()}
        >
          Save pairing
        </StudioButton>
        <div className="ml-auto max-[479px]:ml-0">
          <StudioButton
            onClick={() => opener.requestOpen(buildPalette(), "/colors/color-palette-generator")}
          >
            Use in palette
          </StudioButton>
        </div>
      </div>
      {saveError ? (
        <p role="alert" className="text-sm leading-5 text-[var(--cs-danger)]">
          {saveError}
        </p>
      ) : null}

      {savedPairings.length > 0 ? (
        <WorkspacePanel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl leading-8 font-semibold">Saved pairings</h2>
            <Link
              href="/colors/saved"
              className="text-sm leading-5 font-medium text-[var(--cs-brand-strong)] underline"
            >
              Manage in Saved
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {savedPairings.map((entry) => (
              <li
                key={entry.palette.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--cs-border)] p-3"
              >
                <Swatch hex={entry.pair.foreground} />
                <Swatch hex={entry.pair.background} />
                <span className="min-w-0 flex-1 truncate text-sm leading-5 font-medium">
                  {entry.palette.name}
                </span>
                <span className="text-sm leading-5 font-semibold">
                  {formatContrastRatio(contrastRatio(entry.pair.foreground, entry.pair.background))}
                </span>
                <StudioButton
                  variant="secondary"
                  onClick={() => {
                    setPair(entry.pair);
                    setUndoForeground(null);
                  }}
                >
                  Use
                </StudioButton>
              </li>
            ))}
          </ul>
        </WorkspacePanel>
      ) : null}

      <p className="rounded-[10px] bg-[var(--cs-soft)] p-4 text-sm leading-5">
        Results cover WCAG 2.2 text contrast for this color pair only. They don&apos;t measure
        overall accessibility.
      </p>
      {opener.dialog}
    </>
  );
}
