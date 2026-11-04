// -----------------------------------------------------------------------------
// @file: components/colors/studio/shared-palette-view.tsx
// @purpose: Read-only view of a shared palette. "Make a copy" creates a separate
//           record with new ids, so the snapshot itself can never change.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useState } from "react";

import { useToast } from "@/components/ui/toast-provider";
import {
  clonePaletteWithNewIds,
  COLOR_ROLES,
  formatHex,
  resolvePaletteColors,
  studioPaletteToCss,
  type ColorRole,
  type StudioPalette,
} from "@/lib/colors";

import { usePaletteOpener } from "./open-palette";
import { PalettePreview } from "./palette-preview";
import { StudioButton } from "./studio-button";
import { WorkspacePanel } from "./studio-shell";
import { StudioSwatch } from "./studio-swatch";
import { useSavedPalettes } from "./use-saved-palettes";
import { useStudioCopy } from "./use-studio-copy";

const ROLE_LABELS: Record<ColorRole, string> = {
  background: "Background",
  text: "Text",
  primary: "Primary color",
  accent: "Accent",
  surface: "Surface",
};

export function SharedPaletteView({ palette }: { palette: StudioPalette }) {
  const store = useSavedPalettes();
  const { copy } = useStudioCopy();
  const { showToast } = useToast();
  const [copyError, setCopyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const opener = usePaletteOpener(async (active) => (await store.save(active)).ok);
  const resolved = resolvePaletteColors(palette);

  const rolesOf = (colorId: string) =>
    COLOR_ROLES.filter((role) => palette.roles[role] === colorId).map((role) => ROLE_LABELS[role]);

  const makeCopy = async () => {
    setSaving(true);
    setCopyError(null);
    const result = await store.createMany([clonePaletteWithNewIds(palette)]);
    setSaving(false);
    if (result.ok) {
      showToast({
        type: "success",
        title: "Copied to your saved palettes",
        durationMs: 3000,
      });
    } else {
      setCopyError(result.message);
    }
  };

  return (
    <>
      <WorkspacePanel>
        <span className="mb-4 inline-block rounded-full bg-[var(--cs-soft)] px-3 py-1 text-sm leading-5 font-medium text-[var(--cs-soft-text)]">
          View only
        </span>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {palette.colors.map((color) => (
            <li key={color.id} className="min-w-0">
              <StudioSwatch hex={color.hex} />
              <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">
                {rolesOf(color.id).join(", ") || " "}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-2">
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
            Copy all HEX
          </StudioButton>
          <StudioButton
            variant="secondary"
            onClick={() => void copy(studioPaletteToCss(palette), "css", "CSS variables")}
          >
            Copy CSS
          </StudioButton>
          <StudioButton
            loading={saving}
            disabled={store.status !== "ready"}
            onClick={() => void makeCopy()}
          >
            Make a copy
          </StudioButton>
          <p className="text-sm leading-5 text-[var(--cs-muted)]">
            Make a copy to edit this palette in your own workspace.
          </p>
        </div>
        {copyError ? (
          <p role="alert" className="mt-3 text-sm leading-5 text-[var(--cs-danger)]">
            {copyError}
          </p>
        ) : null}
      </WorkspacePanel>

      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 max-[1023px]:grid-cols-1">
        <WorkspacePanel>
          <h2 className="text-2xl leading-8 font-semibold">Preview this palette</h2>
          <p className="mt-1 mb-4 text-sm leading-5 text-[var(--cs-muted)]">
            See how these colors can work together in a real design.
          </p>
          <PalettePreview palette={palette} />
        </WorkspacePanel>
        <WorkspacePanel>
          <h2 className="text-2xl leading-8 font-semibold">Selected pairing</h2>
          <p className="mt-1 mb-4 text-sm leading-5 text-[var(--cs-muted)]">
            A text and background combination from this palette.
          </p>
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[var(--cs-border)]">
            <span
              className="flex h-28 items-center justify-center text-[32px] leading-10 font-bold"
              style={{ backgroundColor: resolved.text, color: resolved.background }}
            >
              Aa
            </span>
            <span
              className="flex h-28 items-center justify-center text-[32px] leading-10 font-bold"
              style={{ backgroundColor: resolved.background, color: resolved.text }}
            >
              Aa
            </span>
          </div>
          <dl className="mt-4 text-sm leading-5">
            <div className="flex justify-between gap-3 py-1">
              <dt className="font-medium">Text</dt>
              <dd className="font-mono">{formatHex(resolved.text)}</dd>
            </div>
            <div className="flex justify-between gap-3 py-1">
              <dt className="font-medium">Background</dt>
              <dd className="font-mono">{formatHex(resolved.background)}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <StudioButton
              variant="tertiary"
              onClick={() =>
                opener.requestOpen(clonePaletteWithNewIds(palette), "/colors/contrast-checker")
              }
            >
              Check contrast
            </StudioButton>
          </div>
        </WorkspacePanel>
      </div>
      {opener.dialog}
    </>
  );
}

export function PaletteUnavailable() {
  return (
    <WorkspacePanel>
      <div className="py-12 text-center">
        <h2 className="text-2xl leading-8 font-semibold">Palette unavailable</h2>
        <p className="mt-2 text-base leading-6 text-[var(--cs-muted)]">
          This link is invalid, or the palette is no longer shared.
        </p>
        <Link
          href="/colors"
          className="mt-4 inline-block text-sm leading-5 font-medium text-[var(--cs-brand-strong)] underline"
        >
          Explore Color Studio
        </Link>
      </div>
    </WorkspacePanel>
  );
}
