// -----------------------------------------------------------------------------
// @file: components/brand-kit/brand-kit-tool.tsx
// @purpose: Brand kit generator: name, base color and personality in; a
//           five-color palette, a font pairing and previews out. The kit lives
//           in the URL, so a copied link reopens the same kit.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";

import { HexField } from "@/components/colors/studio/hex-field";
import { CheckIcon, CopyIcon, DownloadIcon, ShareIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { useStudioCopy } from "@/components/colors/studio/use-studio-copy";
import {
  FONT_PAIRINGS,
  getFont,
  getPairing,
  googleFontsUrl,
  pairingsFor,
  PERSONALITIES,
  type Personality,
} from "@/lib/brand-kit/fonts";
import { brandKitCss, brandPalette, recipeCount } from "@/lib/brand-kit/palette";
import { formatHex } from "@/lib/colors";

import { DEFAULT_KIT, kitFromParams, kitToParams, type KitState } from "@/lib/brand-kit/kit-url";

import { fontStyle, KitPreviews } from "./kit-previews";

import "./brand-kit-print.css";

const INPUT =
  "w-full rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2.5 text-base leading-6 focus:border-[var(--cs-text)]";

export function BrandKitTool() {
  const id = useId();
  const [kit, setKit] = useState<KitState>(DEFAULT_KIT);
  const [ready, setReady] = useState(false);
  const { copy, isCopied } = useStudioCopy();

  // Read the URL after hydration, so the server HTML (default kit) matches.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKit(kitFromParams(new URLSearchParams(window.location.search)));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const url = `${window.location.pathname}?${kitToParams(kit).toString()}`;
    window.history.replaceState(null, "", url);
  }, [kit, ready]);

  const pairing = getPairing(kit.pairing) ?? FONT_PAIRINGS[0];
  const heading = getFont(pairing.heading);
  const body = getFont(pairing.body);
  const palette = useMemo(
    () => brandPalette(kit.color, kit.personality, kit.variant),
    [kit.color, kit.personality, kit.variant],
  );
  const options = pairingsFor(kit.personality);

  function update(patch: Partial<KitState>) {
    setKit((current) => ({ ...current, ...patch }));
  }

  function choosePersonality(personality: Personality) {
    update({ personality, pairing: pairingsFor(personality)[0].slug, variant: 0 });
  }

  function nextPairing() {
    const index = options.findIndex((option) => option.slug === kit.pairing);
    update({ pairing: options[(index + 1) % options.length].slug });
  }

  function shareUrl() {
    return `${window.location.origin}${window.location.pathname}?${kitToParams(kit).toString()}`;
  }

  return (
    <div className="brand-kit-print flex flex-col gap-6">
      <section className="brand-kit-controls grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:grid-cols-1 max-[767px]:p-5">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-name`} className="text-sm leading-5 font-semibold">
              Brand name
            </label>
            <input
              id={`${id}-name`}
              value={kit.name}
              onChange={(event) => update({ name: event.target.value.slice(0, 40) })}
              className={INPUT}
              placeholder="Your brand"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-tagline`} className="text-sm leading-5 font-semibold">
              Tagline (optional)
            </label>
            <input
              id={`${id}-tagline`}
              value={kit.tagline}
              onChange={(event) => update({ tagline: event.target.value.slice(0, 80) })}
              className={INPUT}
              placeholder="A short line about what you do."
            />
          </div>
          <HexField
            label="Main brand color"
            value={kit.color}
            onChange={(hex) => update({ color: hex })}
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm leading-5 font-semibold">Brand personality</legend>
          <div className="flex flex-wrap gap-2">
            {PERSONALITIES.map((personality) => {
              const pressed = kit.personality === personality;
              return (
                <button
                  key={personality}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => choosePersonality(personality)}
                  className={`flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
                    pressed
                      ? "border-[var(--cs-text)] bg-[var(--cs-text)] text-white"
                      : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]"
                  }`}
                >
                  {pressed ? <CheckIcon /> : null}
                  {personality}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">
            Personality sets how the other colors relate to yours and which fonts are suggested.
          </p>
        </fieldset>
      </section>

      <section
        aria-labelledby={`${id}-palette`}
        className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${id}-palette`} className="text-lg leading-7 font-semibold">
            Colors
          </h2>
          <button
            type="button"
            className={`brand-kit-controls ${studioButtonClasses("secondary")}`}
            onClick={() => update({ variant: (kit.variant + 1) % recipeCount(kit.personality) })}
          >
            Try other colors
          </button>
        </div>
        <ul className="mt-4 grid grid-cols-5 gap-3 max-[767px]:grid-cols-2">
          {palette.map((color) => (
            <li key={color.role}>
              <button
                type="button"
                onClick={() =>
                  copy(formatHex(color.hex), `color-${color.role}`, formatHex(color.hex))
                }
                className="flex w-full flex-col overflow-hidden rounded-xl border border-[var(--cs-border)] text-left"
                aria-label={`Copy ${color.label} ${formatHex(color.hex)}`}
              >
                <span
                  className="flex h-24 items-end p-3 text-xs font-semibold"
                  style={{ backgroundColor: color.hex, color: color.textOn }}
                >
                  {isCopied(`color-${color.role}`) ? "Copied" : null}
                </span>
                <span className="flex flex-col p-3">
                  <span className="text-sm font-semibold">{color.label}</span>
                  <span className="text-sm text-[var(--cs-muted)]">{formatHex(color.hex)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby={`${id}-fonts`}
        className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${id}-fonts`} className="text-lg leading-7 font-semibold">
            Fonts
          </h2>
          <div className="brand-kit-controls flex flex-wrap items-center gap-2">
            <label htmlFor={`${id}-pairing`} className="sr-only">
              Font pairing
            </label>
            <select
              id={`${id}-pairing`}
              value={kit.pairing}
              onChange={(event) => update({ pairing: event.target.value })}
              className="h-11 rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm"
            >
              {FONT_PAIRINGS.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {getFont(option.heading).name} + {getFont(option.body).name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={studioButtonClasses("secondary")}
              onClick={nextPairing}
            >
              Next pairing
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-6 max-[767px]:grid-cols-1">
          <div>
            <p className="text-sm text-[var(--cs-muted)]">Headings: {heading.name}</p>
            <p className="mt-1 text-4xl leading-tight" style={fontStyle(heading.id)}>
              {kit.name.trim() || "The quick brown fox"}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--cs-muted)]">Body: {body.name}</p>
            <p className="mt-1 text-base leading-7" style={fontStyle(body.id)}>
              {pairing.why}
            </p>
          </div>
        </div>
        <p className="brand-kit-controls mt-4 text-sm leading-5">
          <Link
            href={`/brand-kit/font-pairings/${pairing.slug}`}
            className="font-semibold text-[var(--cs-brand-strong)] hover:underline"
          >
            More about {heading.name} and {body.name}
          </Link>
        </p>
      </section>

      <section
        aria-labelledby={`${id}-preview`}
        className="brand-kit-sheet rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5"
      >
        <h2 id={`${id}-preview`} className="text-lg leading-7 font-semibold">
          {kit.name.trim() ? `${kit.name.trim()} brand kit` : "Preview"}
        </h2>
        <div className="mt-4">
          <KitPreviews
            kit={{
              palette,
              headingFontId: heading.id,
              bodyFontId: body.id,
              name: kit.name,
              tagline: kit.tagline,
            }}
          />
        </div>
      </section>

      <div className="brand-kit-controls flex flex-wrap gap-2">
        <button
          type="button"
          className={studioButtonClasses("primary")}
          onClick={() => copy(shareUrl(), "link", "link to this kit")}
        >
          {isCopied("link") ? <CheckIcon /> : <ShareIcon />}
          Copy link
        </button>
        <button
          type="button"
          className={studioButtonClasses("secondary")}
          onClick={() =>
            copy(brandKitCss(palette, heading.name, body.name), "css", "CSS variables")
          }
        >
          {isCopied("css") ? <CheckIcon /> : <CopyIcon />}
          Copy CSS
        </button>
        <button
          type="button"
          className={studioButtonClasses("secondary")}
          onClick={() => window.print()}
        >
          <DownloadIcon />
          Save as PDF
        </button>
        {[heading, body].map((font) => (
          <a
            key={font.id}
            className={studioButtonClasses("tertiary")}
            href={googleFontsUrl(font)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get {font.name}
          </a>
        ))}
      </div>
    </div>
  );
}
