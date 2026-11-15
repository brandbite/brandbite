// -----------------------------------------------------------------------------
// @file: components/brand/ticket-brand-guide.tsx
// @purpose: The customer's brand guide on a request, read-only: colors to
//           copy, fonts, how the brand talks, and the brand files to
//           download one by one or all at once. Shown to the assigned
//           creative and to admins.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

"use client";

import JSZip from "jszip";
import { useEffect, useState } from "react";

import { Button, Callout, Card, KeyValueList, Skeleton } from "@/components/admin/v2/ui";
import { BrandExportButtons } from "@/components/brand/brand-export-buttons";
import type { BrandColor, BrandFont } from "@/lib/brand/brand-data";
import {
  BRAND_ASSET_BACKGROUND_LABELS,
  BRAND_ASSET_KIND_LABELS,
  fileExtension,
  type BrandAssetBackgroundValue,
  type BrandAssetKindValue,
} from "@/lib/brand/brand-files";

type Brand = {
  name: string;
  tagline: string | null;
  description: string | null;
  audience: string | null;
  values: string[];
  references: string | null;
  toneWords: string[];
  voiceNotes: string | null;
  voiceDo: string[];
  voiceDont: string[];
  wordsToUse: string[];
  wordsToAvoid: string[];
  sampleCopy: string | null;
  colors: BrandColor[];
  fonts: BrandFont[];
  imageryNotes: string | null;
};

type BrandFile = {
  id: string;
  kind: BrandAssetKindValue;
  background: BrandAssetBackgroundValue;
  name: string;
  sizeBytes: number;
  previewUrl: string | null;
};

type Loaded = { brand: Brand; assets: BrandFile[]; logoLink: string | null };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** True when the guide has nothing a creative could use. */
function isEmpty({ brand, assets, logoLink }: Loaded): boolean {
  const texts = [
    brand.tagline,
    brand.description,
    brand.audience,
    brand.references,
    brand.voiceNotes,
    brand.sampleCopy,
    brand.imageryNotes,
  ];
  const lists = [
    brand.values,
    brand.toneWords,
    brand.voiceDo,
    brand.voiceDont,
    brand.wordsToUse,
    brand.wordsToAvoid,
    brand.colors,
    brand.fonts,
    assets,
  ];
  return !logoLink && texts.every((t) => !t) && lists.every((l) => l.length === 0);
}

const prose = (value: string) => <span className="font-normal whitespace-pre-wrap">{value}</span>;
const joined = (values: string[]) => <span className="font-normal">{values.join(", ")}</span>;
const bullets = (values: string[]) => (
  <ul className="list-disc space-y-0.5 pl-4 font-normal">
    {values.map((value) => (
      <li key={value}>{value}</li>
    ))}
  </ul>
);

/** The brand guide that applies to a request. */
export function TicketBrandGuide({ ticketId }: { ticketId: string }) {
  return <BrandGuidePanel apiBase={`/api/tickets/${ticketId}/brand`} />;
}

/**
 * Read-only brand guide loaded from `apiBase`, which answers GET with the
 * guide and `GET {apiBase}/assets/{id}/download` with a download link.
 */
export function BrandGuidePanel({ apiBase }: { apiBase: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    fetch(apiBase, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const json = (await res.json()) as Loaded;
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const downloadUrl = async (file: BrandFile): Promise<string> => {
    const res = await fetch(`${apiBase}/assets/${file.id}/download`, {
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { url?: string } | null;
    if (!res.ok || !json?.url) throw new Error(`Could not download ${file.name}.`);
    return json.url;
  };

  const download = async (file: BrandFile) => {
    setError(null);
    setBusy(file.id);
    try {
      window.location.assign(await downloadUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The download failed.");
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async (brandName: string, files: BrandFile[]) => {
    setError(null);
    setBusy("all");
    try {
      const zip = new JSZip();
      const used = new Set<string>();
      for (const file of files) {
        const res = await fetch(await downloadUrl(file));
        if (!res.ok) throw new Error(`Could not download ${file.name}.`);
        // Two files can share a name; keep both.
        let name = file.name;
        for (let n = 2; used.has(name.toLowerCase()); n += 1) {
          const dot = file.name.lastIndexOf(".");
          name =
            dot === -1
              ? `${file.name} (${n})`
              : `${file.name.slice(0, dot)} (${n})${file.name.slice(dot)}`;
        }
        used.add(name.toLowerCase());
        zip.file(name, await res.blob());
      }
      const blobUrl = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${brandName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand"}-brand-files.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The download failed.");
    } finally {
      setBusy(null);
    }
  };

  const copy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(hex);
      window.setTimeout(() => setCopied((current) => (current === hex ? null : current)), 1500);
    } catch {
      // Clipboard blocked: the hex is on screen to copy by hand.
    }
  };

  if (failed) return null;
  if (!data) {
    return (
      <Card>
        <h2 className="mb-4 text-xl leading-7 font-semibold">Brand guide</h2>
        <Skeleton className="h-24" />
      </Card>
    );
  }
  if (isEmpty(data)) {
    return (
      <Card>
        <h2 className="mb-2 text-xl leading-7 font-semibold">Brand guide</h2>
        <p className="text-sm text-[var(--av2-text-2)]">
          The customer hasn&apos;t filled in their brand guide yet.
        </p>
      </Card>
    );
  }

  const { brand, assets, logoLink } = data;
  const rows: { label: string; value: React.ReactNode }[] = [];
  const add = (label: string, value: React.ReactNode, show: unknown) => {
    if (show) rows.push({ label, value });
  };

  add("Tagline", prose(brand.tagline ?? ""), brand.tagline);
  add("What they do", prose(brand.description ?? ""), brand.description);
  add("Audience", prose(brand.audience ?? ""), brand.audience);
  add("Values", joined(brand.values), brand.values.length);
  add(
    "Colors",
    <span className="flex flex-wrap gap-1.5">
      {brand.colors.map((color) => (
        <button
          key={color.id}
          type="button"
          onClick={() => void copy(color.hex)}
          aria-label={`Copy ${color.name ?? "color"} ${color.hex}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--av2-border)] px-2 py-0.5 text-xs font-normal hover:bg-[var(--av2-bg)]"
        >
          <span
            aria-hidden
            className="h-3 w-3 rounded-full border border-[var(--av2-border)]"
            style={{ backgroundColor: color.hex }}
          />
          {color.name ? <span>{color.name}</span> : null}
          <span className="font-mono">{copied === color.hex ? "Copied" : color.hex}</span>
          {color.role ? <span className="text-[var(--av2-text-2)]">· {color.role}</span> : null}
        </button>
      ))}
    </span>,
    brand.colors.length,
  );
  add(
    "Fonts",
    <ul className="space-y-0.5 font-normal">
      {brand.fonts.map((font) => (
        <li key={font.id}>
          {font.url ? (
            <a
              href={font.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--av2-link)] hover:underline"
            >
              {font.name}
            </a>
          ) : (
            font.name
          )}
          {font.role ? <span className="text-[var(--av2-text-2)]"> · {font.role}</span> : null}
        </li>
      ))}
    </ul>,
    brand.fonts.length,
  );
  add("Imagery", prose(brand.imageryNotes ?? ""), brand.imageryNotes);
  add("Tone", joined(brand.toneWords), brand.toneWords.length);
  add("Voice", prose(brand.voiceNotes ?? ""), brand.voiceNotes);
  add("Write like this", bullets(brand.voiceDo), brand.voiceDo.length);
  add("Never write like this", bullets(brand.voiceDont), brand.voiceDont.length);
  add("Words to use", joined(brand.wordsToUse), brand.wordsToUse.length);
  add("Words to avoid", joined(brand.wordsToAvoid), brand.wordsToAvoid.length);
  add("Sample copy", prose(brand.sampleCopy ?? ""), brand.sampleCopy);
  add("References", prose(brand.references ?? ""), brand.references);
  add(
    "Logo link",
    <a
      href={logoLink ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-[var(--av2-link)] hover:underline"
    >
      {logoLink}
    </a>,
    logoLink,
  );

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="mb-1 text-xl leading-7 font-semibold">Brand guide</h2>
          <p className="text-sm text-[var(--av2-text-2)]">{brand.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BrandExportButtons brand={brand} files={assets} size="sm" />
        </div>
      </div>

      {rows.length > 0 && <KeyValueList rows={rows} />}

      {assets.length > 0 && (
        <div className={rows.length > 0 ? "mt-6" : undefined}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Brand files</h3>
            {assets.length > 1 && (
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() => void downloadAll(brand.name, assets)}
              >
                {busy === "all" ? "Preparing…" : "Download all (.zip)"}
              </Button>
            )}
          </div>
          {error && (
            <div className="mb-3">
              <Callout tone="error" title="That didn't work">
                {error}
              </Callout>
            </div>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {assets.map((file) => (
              <li
                key={file.id}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--av2-border)] p-3"
              >
                <div
                  className={
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg p-1.5 " +
                    (file.background === "DARK" ? "bg-[#17171a]" : "bg-[#f4f4f5]")
                  }
                >
                  {file.previewUrl ? (
                    // Uploaded files are only ever shown through <img>, which never runs scripts.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.previewUrl}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span
                      className={
                        "font-mono text-xs font-semibold uppercase " +
                        (file.background === "DARK" ? "text-white" : "text-[#3f3f46]")
                      }
                    >
                      {fileExtension(file.name) || "file"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-[var(--av2-text-2)]">
                    {BRAND_ASSET_KIND_LABELS[file.kind]}
                    {file.background !== "ANY"
                      ? ` · ${BRAND_ASSET_BACKGROUND_LABELS[file.background]}`
                      : ""}
                    {` · ${formatBytes(file.sizeBytes)}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={busy !== null}
                  aria-label={`Download ${file.name}`}
                  onClick={() => void download(file)}
                >
                  Download
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
