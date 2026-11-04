// -----------------------------------------------------------------------------
// @file: components/colors/studio/saved-palette-detail.tsx
// @purpose: One saved palette on /colors/saved: rename, export and share, its colors,
//           role assignment, and a preview using those roles.
// -----------------------------------------------------------------------------

"use client";

import { useId, useState } from "react";

import {
  COLOR_ROLES,
  contrastRatio,
  describeColor,
  formatContrastRatio,
  formatHex,
  resolvePaletteColors,
  setStudioRole,
  studioPaletteToCss,
  type StudioPalette,
  type StudioSource,
} from "@/lib/colors";
import { findNamedColor } from "@/lib/colors/named-colors";

import { ActionMenu } from "./action-menu";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ContrastIcon,
  CopyIcon,
  DesktopIcon,
  EditIcon,
  InfoIcon,
  LayersIcon,
  MobileIcon,
  WarningIcon,
} from "./icons";
import { downloadText, IconToggle, ROLE_LABELS, STUDIO_FIELD, StudioSelect } from "./palette-parts";
import { PalettePreview } from "./palette-preview";
import { SharePaletteButton } from "./share-palette";
import { StudioButton, studioButtonClasses } from "./studio-button";
import { useStudioCopy } from "./use-studio-copy";

export const SOURCE_LABELS: Record<StudioSource, string> = {
  generator: "Palette generator",
  wheel: "Color wheel",
  tailwind: "Tailwind shades",
  ideas: "Palette ideas",
  meanings: "Color meanings",
  contrast: "Contrast checker",
  image: "Image to palette",
  shared: "Shared palette",
};

const CARD =
  "min-w-0 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5";

const QUIET_ACTION =
  "inline-flex h-11 items-center gap-1.5 rounded-[10px] px-1.5 text-[13px] leading-5 font-medium hover:bg-[var(--cs-background)] [&_svg]:h-4 [&_svg]:w-4";

const COPY_ACTION = `${studioButtonClasses("secondary")} gap-1.5! px-2.5! text-[13px]! [&_svg]:h-4 [&_svg]:w-4`;

const OrangeArrow = () => (
  <span className="text-[var(--cs-brand)]">
    <ArrowRightIcon />
  </span>
);

function colorName(hex: string): string {
  return findNamedColor(hex)?.name ?? describeColor(hex).name;
}

function fileNameFor(palette: StudioPalette, extension: string): string {
  const slug = palette.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "palette"}.${extension}`;
}

function RoleSelects({
  palette,
  onChange,
}: {
  palette: StudioPalette;
  onChange: (palette: StudioPalette) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 max-[639px]:grid-cols-1">
      {COLOR_ROLES.map((role) => {
        const assigned = palette.colors.find((c) => c.id === palette.roles[role]);
        return (
          <label key={role} className="min-w-0 text-sm leading-5 font-medium">
            {ROLE_LABELS[role]}
            <StudioSelect
              value={palette.roles[role] ?? ""}
              onChange={(event) =>
                onChange(setStudioRole(palette, role, event.target.value || null))
              }
              leading={
                <span
                  className="block h-6 w-6 rounded-md border border-[var(--cs-border)]"
                  style={{ backgroundColor: assigned?.hex ?? "transparent" }}
                />
              }
            >
              <option value="">Not set</option>
              {palette.colors.map((color) => (
                <option key={color.id} value={color.id}>
                  {colorName(color.hex)} {formatHex(color.hex)}
                </option>
              ))}
            </StudioSelect>
          </label>
        );
      })}
    </div>
  );
}

export function SavedPaletteDetail({
  palette,
  renaming,
  onRenamingChange,
  onSave,
  onOpen,
}: {
  palette: StudioPalette;
  renaming: boolean;
  onRenamingChange: (renaming: boolean) => void;
  onSave: (palette: StudioPalette) => Promise<boolean>;
  onOpen: (href: string, selectedColorId?: string) => void;
}) {
  const { copy, isCopied } = useStudioCopy();
  const nameId = useId();
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(palette.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [lastPaletteId, setLastPaletteId] = useState(palette.id);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  if (palette.id !== lastPaletteId) {
    setLastPaletteId(palette.id);
    setSelectedColorId(null);
    setDraftName(palette.name);
    setNameError(null);
  }

  const selected = palette.colors.find((c) => c.id === selectedColorId) ?? palette.colors[0];
  const colors = resolvePaletteColors(palette);
  const textRatio = contrastRatio(colors.text, colors.background);
  const textPasses = textRatio >= 4.5;

  const submitName = async () => {
    const name = draftName.trim();
    if (!name || name.length > 80) {
      setNameError("Enter a name of 1 to 80 characters.");
      return;
    }
    setNameError(null);
    if (name === palette.name || (await onSave({ ...palette, name }))) onRenamingChange(false);
  };

  const downloadJson = async () => {
    const { serializeBackup } = await import("@/lib/colors/backup");
    downloadText(fileNameFor(palette, "json"), serializeBackup([palette]), "application/json");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-[280px]">
          {renaming ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitName();
              }}
            >
              <label htmlFor={nameId} className="mb-2 block text-sm leading-5 font-medium">
                Palette name
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id={nameId}
                  value={draftName}
                  maxLength={80}
                  autoFocus
                  aria-invalid={nameError ? true : undefined}
                  onChange={(event) => setDraftName(event.target.value)}
                  className={`${STUDIO_FIELD} min-w-0 flex-1`}
                />
                <StudioButton type="submit">Save name</StudioButton>
                <StudioButton
                  variant="secondary"
                  onClick={() => {
                    setDraftName(palette.name);
                    setNameError(null);
                    onRenamingChange(false);
                  }}
                >
                  Cancel
                </StudioButton>
              </div>
              {nameError ? (
                <p className="mt-2 text-sm leading-5 text-[var(--cs-danger)]">{nameError}</p>
              ) : null}
            </form>
          ) : (
            <div className="flex items-center gap-1">
              <h2 className="min-w-0 text-[32px] leading-10 font-bold break-words max-[767px]:text-2xl max-[767px]:leading-8">
                {palette.name}
              </h2>
              <button
                type="button"
                aria-label={`Rename ${palette.name}`}
                onClick={() => {
                  setDraftName(palette.name);
                  onRenamingChange(true);
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
              >
                <EditIcon />
              </button>
            </div>
          )}
          <p className="text-sm leading-5 text-[var(--cs-muted)]">
            From {SOURCE_LABELS[palette.sourceTool]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionMenu
            buttonClassName={studioButtonClasses("secondary")}
            items={[
              {
                label: "Download CSS",
                onSelect: () =>
                  downloadText(
                    fileNameFor(palette, "css"),
                    studioPaletteToCss(palette),
                    "text/css",
                  ),
              },
              { label: "Download JSON", onSelect: () => void downloadJson() },
            ]}
          >
            Export
            <ChevronDownIcon />
          </ActionMenu>
          <SharePaletteButton palette={palette} />
        </div>
      </div>

      <section aria-label={`${palette.name} colors`} className={CARD}>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4">
          {palette.colors.map((color) => {
            const label = formatHex(color.hex);
            const isSelected = color.id === selected.id;
            return (
              <li key={color.id} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Select and copy ${label}`}
                  onClick={() => {
                    setSelectedColorId(color.id);
                    void copy(label, color.id);
                  }}
                  className={`block h-[88px] w-full cursor-copy rounded-xl border ${
                    isSelected
                      ? "border-[var(--cs-border)] outline-2 outline-offset-2 outline-[var(--cs-selected)]"
                      : "border-[var(--cs-border)]"
                  }`}
                  style={{ backgroundColor: color.hex }}
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="min-w-0 text-base leading-6 font-semibold select-text">
                    {label}
                  </span>
                  <button
                    type="button"
                    aria-label={`Copy ${label}`}
                    onClick={() => void copy(label, color.id)}
                    className="flex h-11 w-11 shrink-0 items-center justify-end rounded-[10px] text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
                  >
                    {isCopied(color.id) ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>
                <p className="truncate text-sm leading-5 text-[var(--cs-muted)]">
                  {colorName(color.hex)}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cs-border)] pt-4">
          <p className="flex items-center gap-2 text-sm leading-5 text-[var(--cs-muted)]">
            <InfoIcon />
            Click a color to copy its HEX.
          </p>
          <StudioButton
            variant="secondary"
            onClick={() => onOpen("/colors/color-palette-generator", selected.id)}
          >
            Open in generator
            <OrangeArrow />
          </StudioButton>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-6 max-[1023px]:grid-cols-1">
        <section className={`${CARD} flex flex-col`}>
          <h3 className="text-xl leading-7 font-semibold">Color roles</h3>
          <p className="mt-1 mb-4 text-sm leading-5 text-[var(--cs-muted)]">
            Choose how each color works in your design.
          </p>
          <RoleSelects palette={palette} onChange={(next) => void onSave(next)} />
          <div className="mt-auto flex flex-wrap items-center gap-1 pt-5">
            <button
              type="button"
              onClick={() => onOpen("/colors/contrast-checker")}
              className={QUIET_ACTION}
            >
              <ContrastIcon />
              Check contrast
            </button>
            <button
              type="button"
              onClick={() => onOpen("/colors/tailwind-color-generator", selected.id)}
              className={QUIET_ACTION}
            >
              <LayersIcon />
              Create shades
            </button>
            <span aria-hidden="true" className="mx-1 h-6 w-px bg-[var(--cs-border)]" />
            <button
              type="button"
              className={COPY_ACTION}
              onClick={() =>
                void copy(
                  palette.colors.map((c) => formatHex(c.hex)).join(", "),
                  "hex-list",
                  "all HEX values",
                )
              }
            >
              <CopyIcon />
              Copy HEX
            </button>
            <button
              type="button"
              className={COPY_ACTION}
              onClick={() => void copy(studioPaletteToCss(palette), "css", "CSS variables")}
            >
              <CopyIcon />
              Copy CSS
            </button>
          </div>
        </section>

        <section aria-label="Preview with assigned roles" className={`${CARD} flex flex-col`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl leading-7 font-semibold">Preview with assigned roles</h3>
            <IconToggle
              label="Preview size"
              value={device}
              onChange={setDevice}
              activeClassName="border-transparent bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
              options={[
                { value: "desktop", label: "Desktop", icon: <DesktopIcon /> },
                { value: "mobile", label: "Mobile", icon: <MobileIcon /> },
              ]}
            />
          </div>
          <PalettePreview palette={palette} device={device} bare />
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
            <p className="flex min-w-0 items-center gap-2 text-sm leading-5">
              <span className={textPasses ? "text-[var(--cs-success)]" : "text-[var(--cs-danger)]"}>
                {textPasses ? <CheckCircleIcon /> : <WarningIcon />}
              </span>
              <span>
                Text on background: {formatContrastRatio(textRatio)}
                {textPasses ? "" : " (below AA for normal text)"}
              </span>
            </p>
            <StudioButton variant="secondary" onClick={() => onOpen("/colors/contrast-checker")}>
              Check this pairing
              <OrangeArrow />
            </StudioButton>
          </div>
        </section>
      </div>
    </div>
  );
}
