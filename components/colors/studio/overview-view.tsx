// -----------------------------------------------------------------------------
// @file: components/colors/studio/overview-view.tsx
// @purpose: Color Studio home. The color entered here carries into every tool.
//           Recently explored colors and saved palettes are labelled separately:
//           browsing history is never presented as something the user saved.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState, useSyncExternalStore } from "react";

import {
  createStudioPalette,
  formatHex,
  normalizeHex,
  tailwindScale,
  type StudioPalette,
} from "@/lib/colors";

import { HexField } from "./hex-field";
import { ArrowRightIcon } from "./icons";
import { usePaletteOpener } from "./open-palette";
import { StudioButton } from "./studio-button";
import { useSavedPalettes } from "./use-saved-palettes";

const RECENT_KEY = "brandbite.colorStudio.recent.v1";
const MAX_RECENT = 3;
const noSubscribe = () => () => {};

function readRecentRaw(): string {
  try {
    return window.localStorage.getItem(RECENT_KEY) ?? "";
  } catch {
    return "";
  }
}

function parseRecent(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.flatMap((hex) => normalizeHex(hex) ?? []).slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

function rememberRecent(hex: string): void {
  try {
    const next = [hex, ...parseRecent(readRecentRaw()).filter((h) => h !== hex)].slice(
      0,
      MAX_RECENT,
    );
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Recents are a convenience. Exploring still works without them.
  }
}

function Strip({ hexes }: { hexes: string[] }) {
  return (
    <span className="flex h-10 overflow-hidden rounded-[10px] border border-[var(--cs-border)]">
      {hexes.map((hex, index) => (
        <span key={`${hex}-${index}`} className="flex-1" style={{ backgroundColor: hex }} />
      ))}
    </span>
  );
}

const SAMPLE_SCALE = tailwindScale("#ff6426").map((shade) => shade.hex);

const TOOLS: { href: string; title: string; description: string; preview: ReactNode }[] = [
  {
    href: "/colors/tailwind-color-generator",
    title: "Tailwind shades",
    description: "Turn any color into a full Tailwind shade scale, from 50 to 950.",
    preview: <Strip hexes={SAMPLE_SCALE} />,
  },
  {
    href: "/colors/color-palette-generator",
    title: "Palette generator",
    description: "Create balanced palettes that feel just right, every time.",
    preview: <Strip hexes={["#ff8a3d", "#ffcfa8", "#fff0d9", "#b794f6", "#5e2d91"]} />,
  },
  {
    href: "/colors/color-wheel",
    title: "Color wheel",
    description: "Find the perfect hue, match harmonies, and nail the vibe.",
    preview: (
      <span
        className="mx-auto block h-20 w-20 rounded-full"
        style={{
          background:
            "radial-gradient(circle, #fff 0 38%, transparent 39%), conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
        }}
      />
    ),
  },
  {
    href: "/colors/color-palette-ideas",
    title: "Palette ideas",
    description: "Curated combos for every mood, market, and moment.",
    preview: <Strip hexes={["#ff5a1f", "#ffc299", "#7a3fd1", "#c7a6f2", "#14304f", "#7ab8e6"]} />,
  },
  {
    href: "/colors/color-meanings",
    title: "Color meanings",
    description: "The associations and personality behind every shade.",
    preview: <Strip hexes={["#e63946", "#f4801f", "#ffd60a", "#2a9d8f", "#0077b6", "#7b2cbf"]} />,
  },
  {
    href: "/colors/contrast-checker",
    title: "Contrast checker",
    description: "Check that a text and background pairing is readable.",
    preview: (
      <span className="flex h-10 items-center justify-center rounded-[10px] bg-[#173B59] text-sm leading-5 font-semibold text-white">
        Aa 11.62:1
      </span>
    ),
  },
];

const CARD =
  "flex min-w-0 flex-col gap-4 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6";

export function OverviewView() {
  const store = useSavedPalettes();
  const [hex, setHex] = useState("#ff6426");
  const recentRaw = useSyncExternalStore(noSubscribe, readRecentRaw, () => "");
  const recent = useMemo(() => parseRecent(recentRaw), [recentRaw]);

  const opener = usePaletteOpener(async (active) => (await store.save(active)).ok);
  const shades = useMemo(() => tailwindScale(hex).map((shade) => shade.hex), [hex]);

  const explore = (color: string) => {
    rememberRecent(color);
    const palette: StudioPalette = createStudioPalette({
      name: `${formatHex(color)} palette`,
      hexes: [color],
      sourceTool: "tailwind",
    });
    opener.requestOpen(palette, "/colors/tailwind-color-generator");
  };

  const saved = store.status === "ready" ? store.palettes.slice(0, 3) : [];

  return (
    <>
      <section className="grid grid-cols-2 items-center gap-8 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[1023px]:grid-cols-1 max-[767px]:p-5">
        <div>
          <h2 className="text-2xl leading-8 font-semibold">Start with your brand color</h2>
          <p className="mt-1 text-base leading-6 text-[var(--cs-muted)]">
            Enter a HEX color to explore shades, build palettes, and see what works for your brand.
            It carries into every tool.
          </p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <HexField label="Brand color" value={hex} onChange={setHex} />
            </div>
            <StudioButton onClick={() => explore(hex)}>
              Explore this color
              <ArrowRightIcon />
            </StudioButton>
          </div>
          <p className="mt-4 mb-2 text-sm leading-5 text-[var(--cs-muted)]">Shade preview</p>
          <Strip hexes={shades} />
        </div>
      </section>

      <section aria-labelledby="studio-tools">
        <h2 id="studio-tools" className="mt-2 mb-4 text-2xl leading-8 font-semibold">
          Your next great palette starts here.
        </h2>
        <ul className="grid grid-cols-3 gap-6 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
          {TOOLS.map((tool) => (
            <li key={tool.href} className="min-w-0">
              <Link
                href={tool.href}
                className={`${CARD} h-full transition-colors hover:border-[var(--cs-text)]`}
              >
                <span>
                  <span className="block text-lg leading-[26px] font-semibold">{tool.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-[var(--cs-muted)]">
                    {tool.description}
                  </span>
                </span>
                <span className="mt-auto block">{tool.preview}</span>
                <span className="flex items-center gap-1 text-sm leading-5 font-semibold text-[var(--cs-brand-strong)]">
                  Open tool
                  <ArrowRightIcon />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {recent.length > 0 ? (
        <section aria-labelledby="studio-recent">
          <h2 id="studio-recent" className="mt-2 mb-4 text-2xl leading-8 font-semibold">
            Recently explored
          </h2>
          <ul className="grid grid-cols-3 gap-4 max-[767px]:grid-cols-1">
            {recent.map((color) => (
              <li key={color}>
                <button
                  type="button"
                  onClick={() => explore(color)}
                  className={`${CARD} w-full text-left transition-colors hover:border-[var(--cs-text)]`}
                >
                  <Strip hexes={tailwindScale(color).map((shade) => shade.hex)} />
                  <span className="font-mono text-sm leading-5">{formatHex(color)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {saved.length > 0 ? (
        <section aria-labelledby="studio-saved">
          <div className="mt-2 mb-4 flex items-center justify-between gap-3">
            <h2 id="studio-saved" className="text-2xl leading-8 font-semibold">
              Your saved palettes
            </h2>
            <Link
              href="/colors/saved"
              className="text-sm leading-5 font-medium text-[var(--cs-brand-strong)] underline"
            >
              View all
            </Link>
          </div>
          <ul className="grid grid-cols-3 gap-4 max-[767px]:grid-cols-1">
            {saved.map((palette) => (
              <li key={palette.id} className={CARD}>
                <Strip hexes={palette.colors.map((c) => c.hex)} />
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm leading-5 font-semibold">
                    {palette.name}
                  </span>
                  <StudioButton
                    variant="secondary"
                    onClick={() => opener.requestOpen(palette, "/colors/color-palette-generator")}
                  >
                    Open
                  </StudioButton>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {opener.dialog}
    </>
  );
}
