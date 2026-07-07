// -----------------------------------------------------------------------------
// @file: app/colors/color-meanings/[slug]/page.tsx
// @purpose: Encyclopedia detail — psychology/meaning, HEX/RGB/HSL, associations,
//           and sample palettes for one color. Client-side 404 like the other
//           CMS detail pages.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CMS_ALLOWED_ATTR, CMS_ALLOWED_TAGS, SafeHtml } from "@/components/ui/safe-html";
import { useClipboard } from "@/components/hooks/use-clipboard";
import { formatHex, formatHsl, formatRgb, hexToHsl, hexToRgb, readableTextOn } from "@/lib/colors";

type MeaningDetail = {
  id: string;
  name: string;
  slug: string;
  hex: string;
  summary: string | null;
  meaning: string | null;
  associations: string[];
  samplePalettes: string[][];
};

export default function ColorMeaningDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [meaning, setMeaning] = useState<MeaningDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { copy, isCopied } = useClipboard();

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/color-meanings/${slug}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.meaning) setMeaning(json.meaning);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const hex = meaning ? formatHex(meaning.hex) : "#000000";
  const rows = meaning
    ? [
        { label: "HEX", value: hex },
        { label: "RGB", value: formatRgb(hexToRgb(hex)) },
        { label: "HSL", value: formatHsl(hexToHsl(hex)) },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[var(--bb-bg-page)] text-[var(--bb-secondary)]">
      <SiteHeader activePage="Color Tools" />
      <main className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/colors/color-meanings"
            className="text-sm font-medium text-[var(--bb-text-secondary)] hover:text-[var(--bb-primary)]"
          >
            ← All colors
          </Link>
          <ThemeToggle />
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-[var(--bb-text-tertiary)]">Loading…</p>
        ) : notFound || !meaning ? (
          <div className="rounded-2xl border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-6 py-16 text-center">
            <p className="text-sm text-[var(--bb-text-tertiary)]">This color page wasn’t found.</p>
            <Link
              href="/colors/color-meanings"
              className="mt-3 inline-block text-sm font-medium text-[var(--bb-primary)]"
            >
              Back to Color Meanings
            </Link>
          </div>
        ) : (
          <article className="space-y-8">
            {/* Hero swatch + values */}
            <div
              className="flex flex-col justify-end rounded-3xl p-6 shadow-sm md:h-56"
              style={{ backgroundColor: hex, color: readableTextOn(hex) }}
            >
              <h1 className="font-brand text-4xl font-bold">{meaning.name}</h1>
              {meaning.summary ? (
                <p className="mt-1 max-w-xl opacity-90">{meaning.summary}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {rows.map((row) => (
                <button
                  key={row.label}
                  type="button"
                  onClick={() => void copy(row.value, row.label)}
                  className="rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-3 py-1.5 font-mono text-xs text-[var(--bb-secondary)] transition-colors hover:border-[var(--bb-primary)]"
                >
                  <span className="mr-1.5 font-sans font-semibold text-[var(--bb-text-tertiary)]">
                    {row.label}
                  </span>
                  {isCopied(row.label) ? "Copied!" : row.value}
                </button>
              ))}
            </div>

            {meaning.associations.length > 0 ? (
              <section>
                <h2 className="mb-2 text-lg font-semibold">Associations</h2>
                <div className="flex flex-wrap gap-2">
                  {meaning.associations.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-[var(--bb-bg-warm)] px-3 py-1 text-sm text-[var(--bb-text-secondary)]"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {meaning.meaning ? (
              <section>
                <h2 className="mb-2 text-lg font-semibold">Meaning &amp; psychology</h2>
                <SafeHtml
                  html={meaning.meaning}
                  allowedTags={CMS_ALLOWED_TAGS}
                  allowedAttrs={CMS_ALLOWED_ATTR}
                  className="prose max-w-none text-[var(--bb-text-secondary)]"
                />
              </section>
            ) : null}

            {meaning.samplePalettes.length > 0 ? (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Sample palettes</h2>
                <div className="space-y-3">
                  {meaning.samplePalettes.map((palette, pi) => (
                    <div
                      key={pi}
                      className="flex h-14 overflow-hidden rounded-xl border border-[var(--bb-border)]"
                    >
                      {palette.map((c, ci) => (
                        <button
                          key={`${pi}-${ci}`}
                          type="button"
                          title={`Copy ${formatHex(c)}`}
                          onClick={() => void copy(formatHex(c), `sp-${pi}-${ci}`)}
                          className="flex flex-1 items-center justify-center text-xs font-semibold"
                          style={{ backgroundColor: c, color: readableTextOn(c) }}
                        >
                          {isCopied(`sp-${pi}-${ci}`) ? "✓" : ""}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </article>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
