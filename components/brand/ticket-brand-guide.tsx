// -----------------------------------------------------------------------------
// @file: components/brand/ticket-brand-guide.tsx
// @purpose: The customer's brand guide, read-only, for the assigned creative
//           and for admins. Three shapes of the same guide:
//           - BrandGuideSummary: the short card in a request's board window
//             (colors, fonts, tone, all files in one download);
//           - BrandGuidePanel layout="card": the full guide in one card with
//             tabs, on a request's full page;
//           - BrandGuidePanel layout="page": the full guide as a page of
//             cards, for an admin looking at a company.
// @version: v1.1.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

"use client";

import JSZip from "jszip";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import {
  IconArrowUpRight,
  IconCheck,
  IconDocument,
  IconDownload,
  IconLayers,
  IconLock,
} from "@/components/admin/v2/icons";
import {
  Badge,
  Button,
  buttonClass,
  Callout,
  Card,
  IconTile,
  Skeleton,
  TabPanel,
  Tabs,
} from "@/components/admin/v2/ui";
import { BrandExportButtons } from "@/components/brand/brand-export-buttons";
import { IconX } from "@/components/navigation/nav-icons";
import type { BrandColor, BrandFont } from "@/lib/brand/brand-data";
import {
  BRAND_ASSET_BACKGROUND_LABELS,
  BRAND_ASSET_KIND_LABELS,
  fileExtension,
  type BrandAssetBackgroundValue,
  type BrandAssetKindValue,
} from "@/lib/brand/brand-files";

// ---------------------------------------------------------------------------
// Types and helpers
// ---------------------------------------------------------------------------

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
  label?: string | null;
  name: string;
  sizeBytes: number;
  previewUrl: string | null;
};

type Loaded = { brand: Brand; assets: BrandFile[]; logoLink: string | null };

type Layout = "card" | "page";
type GuideTab = "about" | "language" | "visual" | "files";

const TABS: { value: GuideTab; label: string }[] = [
  { value: "about", label: "About the brand" },
  { value: "language", label: "Brand language" },
  { value: "visual", label: "Visual identity" },
  { value: "files", label: "Brand files" },
];

const ROLE_LABELS: Record<string, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  text: "Text",
  heading: "Headings",
  body: "Body text",
};

const NOT_FILLED_IN = "The customer hasn't filled in their brand guide yet.";

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

/**
 * Loads a read-only brand guide from `apiBase`, which answers GET with the
 * guide and `GET {apiBase}/assets/{id}/download` with a download link.
 */
function useBrandGuide(apiBase: string) {
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
        const json = (await res.json()) as Partial<Loaded> | null;
        // Anything that isn't a guide counts as "couldn't load": the card stays away.
        if (!json?.brand) throw new Error();
        if (!cancelled) {
          setData({
            brand: json.brand,
            assets: json.assets ?? [],
            logoLink: json.logoLink ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const downloadUrl = async (file: BrandFile): Promise<string> => {
    const res = await fetch(`${apiBase}/assets/${file.id}/download`, { cache: "no-store" });
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

  return { data, failed, copied, busy, error, download, downloadAll, copy };
}

function ReadOnlyBadge() {
  return (
    <Badge tone="neutral" icon={<IconLock />}>
      Read only
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** A titled part of a tab: its own card on a page, a plain block inside a card. */
function Section({
  layout,
  title,
  description,
  children,
  className,
}: {
  layout: Layout;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <h3
        className={
          layout === "page"
            ? "text-2xl leading-8 font-bold tracking-tight"
            : "text-xl leading-7 font-semibold"
        }
      >
        {title}
      </h3>
      {description && <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">{description}</p>}
      <div className="mt-4">{children}</div>
    </>
  );
  return layout === "page" ? (
    <Card className={className}>{body}</Card>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      {children}
    </div>
  );
}

const Prose = ({ children }: { children: string }) => (
  <p className="rounded-lg border border-[var(--av2-border)] px-3 py-2 text-sm leading-6 break-words whitespace-pre-wrap">
    {children}
  </p>
);

const Chips = ({ items }: { items: string[] }) => (
  <ul className="flex flex-wrap gap-1.5">
    {items.map((item) => (
      <li
        key={item}
        className="rounded-full border border-[var(--av2-border)] px-2.5 py-0.5 text-sm break-words"
      >
        {item}
      </li>
    ))}
  </ul>
);

function Lines({ items, tone }: { items: string[]; tone: "do" | "dont" }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm leading-6">
          <span
            aria-hidden
            className={
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full " +
              (tone === "do"
                ? "bg-[var(--av2-success-bg)] text-[#2f7a45] dark:text-[#7fd396]"
                : "bg-[#fde3e1] text-[var(--av2-error)] dark:bg-[#3a1715]")
            }
          >
            {tone === "do" ? (
              <IconCheck width={12} height={12} />
            ) : (
              <IconX width={11} height={11} />
            )}
          </span>
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

const Nothing = ({ children }: { children: string }) => (
  <p className="text-sm text-[var(--av2-text-2)]">{children}</p>
);

function FontName({ font }: { font: BrandFont }) {
  return font.url ? (
    <a
      href={font.url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline underline-offset-4 hover:text-[var(--av2-link)]"
    >
      {font.name}
    </a>
  ) : (
    <span className="font-medium">{font.name}</span>
  );
}

// ---------------------------------------------------------------------------
// The full guide
// ---------------------------------------------------------------------------

/** The brand guide that applies to a request, in one card. */
export function TicketBrandGuide({
  ticketId,
  focus,
}: {
  ticketId: string;
  /** Change this number to scroll the guide into view (a "Brand guide" link was clicked). */
  focus?: number;
}) {
  return <BrandGuidePanel apiBase={`/api/tickets/${ticketId}/brand`} focus={focus} />;
}

export function BrandGuidePanel({
  apiBase,
  layout = "card",
  focus = 0,
}: {
  apiBase: string;
  layout?: Layout;
  focus?: number;
}) {
  const id = useId();
  const guide = useBrandGuide(apiBase);
  const { data, failed, copied, busy, error } = guide;
  const [tab, setTab] = useState<GuideTab>("about");
  const root = useRef<HTMLDivElement>(null);
  const loaded = data !== null;

  useEffect(() => {
    if (focus > 0 && loaded) root.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus, loaded]);

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
        <p className="text-sm text-[var(--av2-text-2)]">{NOT_FILLED_IN}</p>
      </Card>
    );
  }

  const { brand, assets, logoLink } = data;
  const page = layout === "page";

  const about = [
    brand.tagline,
    brand.description,
    brand.audience,
    brand.values.length,
    brand.references,
  ].some(Boolean);
  const language = [
    brand.toneWords.length,
    brand.voiceNotes,
    brand.voiceDo.length,
    brand.voiceDont.length,
    brand.wordsToUse.length,
    brand.wordsToAvoid.length,
    brand.sampleCopy,
  ].some(Boolean);

  const tabBody = (
    <>
      {tab === "about" && (
        <TabPanel idPrefix={id} value="about">
          <Section
            layout={layout}
            title="Brand foundations"
            description="The short version of who they are."
          >
            {about ? (
              <div className="grid gap-4 md:grid-cols-2">
                {brand.tagline && (
                  <Field label="Tagline">
                    <Prose>{brand.tagline}</Prose>
                  </Field>
                )}
                {brand.values.length > 0 && (
                  <Field label="Values">
                    <Chips items={brand.values} />
                  </Field>
                )}
                {brand.description && (
                  <div className="md:col-span-2">
                    <Field label="What they do">
                      <Prose>{brand.description}</Prose>
                    </Field>
                  </div>
                )}
                {brand.audience && (
                  <div className="md:col-span-2">
                    <Field label="Who it's for">
                      <Prose>{brand.audience}</Prose>
                    </Field>
                  </div>
                )}
                {brand.references && (
                  <div className="md:col-span-2">
                    <Field label="Competitors and brands they like">
                      <Prose>{brand.references}</Prose>
                    </Field>
                  </div>
                )}
              </div>
            ) : (
              <Nothing>The customer hasn&apos;t described the brand yet.</Nothing>
            )}
          </Section>
        </TabPanel>
      )}

      {tab === "language" && (
        <TabPanel idPrefix={id} value="language">
          <Section
            layout={layout}
            title="Brand language"
            description="How the brand sounds in writing."
          >
            {language ? (
              <div className="grid gap-4 md:grid-cols-2">
                {brand.toneWords.length > 0 && (
                  <Field label="Tone words">
                    <Chips items={brand.toneWords} />
                  </Field>
                )}
                {brand.voiceNotes && (
                  <Field label="Voice notes">
                    <Prose>{brand.voiceNotes}</Prose>
                  </Field>
                )}
                {brand.voiceDo.length > 0 && (
                  <Field label="Write like this">
                    <Lines items={brand.voiceDo} tone="do" />
                  </Field>
                )}
                {brand.voiceDont.length > 0 && (
                  <Field label="Never write like this">
                    <Lines items={brand.voiceDont} tone="dont" />
                  </Field>
                )}
                {brand.wordsToUse.length > 0 && (
                  <Field label="Words to use">
                    <Chips items={brand.wordsToUse} />
                  </Field>
                )}
                {brand.wordsToAvoid.length > 0 && (
                  <Field label="Words to avoid">
                    <Chips items={brand.wordsToAvoid} />
                  </Field>
                )}
                {brand.sampleCopy && (
                  <div className="md:col-span-2">
                    <Field label="Sample copy">
                      <Prose>{brand.sampleCopy}</Prose>
                    </Field>
                  </div>
                )}
              </div>
            ) : (
              <Nothing>The customer hasn&apos;t described how the brand writes yet.</Nothing>
            )}
          </Section>
        </TabPanel>
      )}

      {tab === "visual" && (
        <TabPanel idPrefix={id} value="visual">
          <div
            className={
              page
                ? "grid grid-cols-[minmax(0,1fr)] items-start gap-6 min-[1400px]:grid-cols-2"
                : "space-y-8"
            }
          >
            <Section
              layout={layout}
              title="Colors"
              description="Click a color to copy its hex code."
            >
              {brand.colors.length === 0 ? (
                <Nothing>No colors yet.</Nothing>
              ) : page ? (
                <ul className="space-y-1">
                  {brand.colors.map((color) => (
                    <li key={color.id}>
                      <button
                        type="button"
                        onClick={() => void guide.copy(color.hex)}
                        aria-label={`Copy ${color.name ?? "color"} ${color.hex}`}
                        className="grid w-full grid-cols-[3rem_minmax(0,1fr)_6rem_minmax(0,7rem)] items-center gap-4 rounded-lg px-1 py-1.5 text-left text-base hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
                      >
                        <span
                          aria-hidden
                          className="h-8 w-12 rounded-md border border-[var(--av2-border)]"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="truncate">{color.name ?? ""}</span>
                        <span className="uppercase tabular-nums">
                          {copied === color.hex ? "Copied" : color.hex}
                        </span>
                        <span className="truncate">
                          {color.role ? (ROLE_LABELS[color.role] ?? color.role) : "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
                  {brand.colors.map((color) => (
                    <li key={color.id}>
                      <button
                        type="button"
                        onClick={() => void guide.copy(color.hex)}
                        aria-label={`Copy ${color.name ?? "color"} ${color.hex}`}
                        title={color.role ? (ROLE_LABELS[color.role] ?? color.role) : undefined}
                        className="flex w-full items-center gap-3 rounded-xl border border-[var(--av2-border)] p-2 text-left hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
                      >
                        <span
                          aria-hidden
                          className="h-11 w-11 shrink-0 rounded-lg border border-[var(--av2-border)]"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="min-w-0">
                          {color.name && (
                            <span className="block truncate text-sm font-semibold">
                              {color.name}
                            </span>
                          )}
                          <span className="block text-sm uppercase tabular-nums">
                            {copied === color.hex ? "Copied" : color.hex}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section layout={layout} title="Fonts" description="Font names and where to get them.">
              {brand.fonts.length === 0 ? (
                <Nothing>No fonts yet.</Nothing>
              ) : (
                <ul className={page ? "space-y-4" : "space-y-3"}>
                  {brand.fonts.map((font) => (
                    <li
                      key={font.id}
                      className={
                        "flex min-w-0 items-center gap-4 text-base " +
                        (page ? "" : "rounded-xl border border-[var(--av2-border)] p-1.5 pr-4")
                      }
                    >
                      <span
                        aria-hidden
                        className={
                          "flex shrink-0 items-center justify-center rounded-lg bg-[var(--av2-success-bg)] font-serif font-semibold " +
                          (page ? "h-14 w-14 text-2xl" : "h-10 w-10 text-xl")
                        }
                      >
                        Aa
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        <FontName font={font} />
                      </span>
                      {font.role && (
                        <span className="shrink-0 text-[var(--av2-text-2)]">
                          {ROLE_LABELS[font.role] ?? font.role}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              layout={layout}
              title="Imagery"
              description="The kind of photos and illustrations that fit, and what to stay away from."
              className={page ? "min-[1400px]:col-span-2" : undefined}
            >
              {brand.imageryNotes ? (
                <Prose>{brand.imageryNotes}</Prose>
              ) : (
                <Nothing>No imagery notes yet.</Nothing>
              )}
            </Section>
          </div>
        </TabPanel>
      )}

      {tab === "files" && (
        <TabPanel idPrefix={id} value="files">
          <Section
            layout={layout}
            title="Brand files"
            description="Logo files and the guidelines document, as the customer uploaded them."
          >
            {error && (
              <div className="mb-3">
                <Callout tone="error" title="That didn't work">
                  {error}
                </Callout>
              </div>
            )}
            {assets.length === 0 && !logoLink && <Nothing>No brand files yet.</Nothing>}
            {assets.length > 1 && (
              <div className="mb-3">
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void guide.downloadAll(brand.name, assets)}
                >
                  <IconDownload />
                  {busy === "all" ? "Preparing…" : "Download all (.zip)"}
                </Button>
              </div>
            )}
            {assets.length > 0 && (
              <ul
                className={"grid gap-3 " + (page ? "min-[1400px]:grid-cols-3 sm:grid-cols-2" : "")}
              >
                {assets.map((file) => (
                  <li
                    key={file.id}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--av2-border)] p-3"
                  >
                    <div
                      className={
                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg p-1.5 " +
                        (file.background === "DARK" ? "bg-[#17171a]" : "bg-[#f4f3f0]")
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
                            "flex flex-col items-center " +
                            (file.background === "DARK" ? "text-white" : "text-[#3f3f46]")
                          }
                        >
                          <IconDocument width={22} height={22} />
                          <span className="font-mono text-[11px] font-semibold uppercase">
                            {fileExtension(file.name) || "file"}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" title={file.name}>
                        {file.label || file.name}
                      </p>
                      {file.label && (
                        <p className="truncate text-xs text-[var(--av2-text-2)]">{file.name}</p>
                      )}
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
                      onClick={() => void guide.download(file)}
                    >
                      Download
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {logoLink && (
              <p className="mt-4 text-sm">
                <span className="font-semibold">Logo link: </span>
                <a
                  href={logoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-[var(--av2-link)] hover:underline"
                >
                  {logoLink}
                </a>
              </p>
            )}
          </Section>
        </TabPanel>
      )}
    </>
  );

  const tabs = (
    <Tabs tabs={TABS} value={tab} onChange={setTab} label="Brand guide sections" idPrefix={id} />
  );

  if (page) {
    return (
      <div ref={root}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-3 text-xl">
              <span className="break-words">{brand.name}</span>
              <ReadOnlyBadge />
            </p>
            <p className="mt-1 text-base text-[var(--av2-text-2)]">
              Only the customer can edit this guide.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BrandExportButtons brand={brand} files={assets} />
          </div>
        </div>
        {tabs}
        <div className="pt-6">{tabBody}</div>
      </div>
    );
  }

  return (
    <div ref={root} className="scroll-mt-24">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl leading-7 font-semibold">Brand guide</h2>
            <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">{brand.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ReadOnlyBadge />
            <BrandExportButtons brand={brand} files={assets} size="sm" />
          </div>
        </div>
        {tabs}
        <div className="pt-5">{tabBody}</div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The short version, for a request's board window
// ---------------------------------------------------------------------------

const SUMMARY_COLORS = 6;

export function BrandGuideSummary({
  ticketId,
  fullHref,
}: {
  ticketId: string;
  /** The request's full page, where the whole guide is. */
  fullHref: string;
}) {
  const guide = useBrandGuide(`/api/tickets/${ticketId}/brand`);
  const { data, failed, copied, busy, error } = guide;

  if (failed) return null;

  const head = (extra?: ReactNode) => (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <IconTile tone="lavender">
          <IconLayers width={24} height={24} />
        </IconTile>
        <div className="min-w-0">
          <h3 className="text-xl leading-7 font-semibold">Brand guide</h3>
          {extra}
        </div>
      </div>
      {data && !isEmpty(data) && (
        <Link href={fullHref} className={buttonClass("secondary", "sm")}>
          Open full brand guide
          <IconArrowUpRight />
        </Link>
      )}
    </div>
  );

  if (!data) {
    return (
      <Card padding="sm" className="sm:p-5">
        {head()}
        <Skeleton className="mt-4 h-20" />
      </Card>
    );
  }
  if (isEmpty(data)) {
    return (
      <Card padding="sm" className="sm:p-5">
        {head(<p className="text-sm text-[var(--av2-text-2)]">{NOT_FILLED_IN}</p>)}
      </Card>
    );
  }

  const { brand, assets } = data;
  const colors = brand.colors.slice(0, SUMMARY_COLORS);
  const moreColors = brand.colors.length - colors.length;
  const rows: { label: string; items: string[] }[] = [
    { label: "Fonts", items: brand.fonts.map((font) => font.name) },
    { label: "Tone", items: brand.toneWords },
  ].filter((row) => row.items.length > 0);

  return (
    <Card padding="sm" className="border-[var(--av2-fill-lavender)]/60 sm:p-5">
      {head(
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="break-words">{brand.name}</span>
          <ReadOnlyBadge />
        </p>,
      )}

      {colors.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {colors.map((color) => (
            <li key={color.id} className="min-w-0">
              <button
                type="button"
                onClick={() => void guide.copy(color.hex)}
                aria-label={`Copy ${color.name ?? "color"} ${color.hex}`}
                title={`Copy ${color.hex}`}
                className="block w-full rounded-lg text-center focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="block h-11 rounded-lg border border-[var(--av2-border)]"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="mt-1.5 block truncate text-sm">
                  {copied === color.hex ? "Copied" : (color.name ?? color.hex)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {moreColors > 0 && (
        <p className="mt-2 text-xs text-[var(--av2-text-2)]">
          +{moreColors} more in the full brand guide
        </p>
      )}

      {rows.length > 0 && (
        <dl className="mt-4 divide-y divide-[var(--av2-border)] border-y border-[var(--av2-border)] text-sm">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 py-2">
              <dt className="font-semibold">{row.label}</dt>
              <dd className="min-w-0 break-words">{row.items.join(" · ")}</dd>
            </div>
          ))}
        </dl>
      )}

      {assets.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-[var(--av2-text-2)]">
            <IconLayers width={18} height={18} />
            {assets.length} brand {assets.length === 1 ? "file" : "files"}
          </p>
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={() =>
              void (assets.length === 1
                ? guide.download(assets[0]!)
                : guide.downloadAll(brand.name, assets))
            }
          >
            <IconDownload />
            {busy !== null
              ? "Preparing…"
              : assets.length === 1
                ? "Download file"
                : "Download all (.zip)"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--av2-error-text)]">
          {error}
        </p>
      )}
    </Card>
  );
}
