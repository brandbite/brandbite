// -----------------------------------------------------------------------------
// @file: components/sizes/format-card.tsx
// @purpose: One format in the size guide: a to-scale preview with covered
//           areas shaded, the numbers, and copy / download-template actions.
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import { CheckIcon, CopyIcon, DownloadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { useStudioCopy } from "@/components/colors/studio/use-studio-copy";
import { coveredAreas, renderTemplate, templateFileName } from "@/lib/sizes/template";
import type { SizeFormat } from "@/lib/sizes/types";

// The preview area is 4:3; a format wider than that fills the width, others the height.
const PREVIEW_RATIO = 4 / 3;

export function FormatPreview({ format }: { format: SizeFormat }) {
  const { width, height } = format;
  const wide = width / height >= PREVIEW_RATIO;
  const covered = coveredAreas(width, height, format.safeZone);
  return (
    <div
      className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-[var(--cs-background)] p-4"
      aria-hidden="true"
    >
      <div
        className="relative overflow-hidden rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)]"
        style={{
          aspectRatio: `${width} / ${height}`,
          width: wide ? "100%" : "auto",
          height: wide ? "auto" : "100%",
        }}
      >
        {covered.map((rect, index) => (
          <div
            key={index}
            className="absolute border border-dashed border-[var(--cs-brand-strong)] bg-[rgba(255,100,38,0.14)]"
            style={{
              left: `${(rect.x / width) * 100}%`,
              top: `${(rect.y / height) * 100}%`,
              width: `${(rect.width / width) * 100}%`,
              height: `${(rect.height / height) * 100}%`,
            }}
          />
        ))}
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-[var(--cs-muted)]">
          {format.ratio}
        </span>
      </div>
    </div>
  );
}

export function FormatCard({
  format,
  platformName,
  platformSlug,
}: {
  format: SizeFormat;
  platformName: string;
  platformSlug: string;
}) {
  const { copy, isCopied } = useStudioCopy();
  const [downloading, setDownloading] = useState(false);
  const size = `${format.width} × ${format.height}`;
  const copyKey = `${platformSlug}-${format.id}`;

  async function download() {
    setDownloading(true);
    try {
      const blob = await renderTemplate(platformName, format);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = templateFileName(platformSlug, format);
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <article
      id={format.id}
      className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5"
    >
      <FormatPreview format={format} />
      <div>
        <h3 className="text-lg leading-7 font-semibold">{format.name}</h3>
        <p className="text-sm leading-5 text-[var(--cs-muted)]">{format.use}</p>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl leading-8 font-bold">{size} px</span>
        <span className="rounded-full bg-[var(--cs-soft)] px-2.5 py-0.5 text-sm font-semibold text-[var(--cs-soft-text)]">
          {format.ratio}
        </span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm leading-5">
        {format.minimum ? (
          <>
            <dt className="text-[var(--cs-muted)]">Minimum</dt>
            <dd>{format.minimum}</dd>
          </>
        ) : null}
        {format.fileTypes ? (
          <>
            <dt className="text-[var(--cs-muted)]">File types</dt>
            <dd>{format.fileTypes}</dd>
          </>
        ) : null}
        {format.maxFileSize ? (
          <>
            <dt className="text-[var(--cs-muted)]">Max file size</dt>
            <dd>{format.maxFileSize}</dd>
          </>
        ) : null}
        {format.safeZone ? (
          <>
            <dt className="text-[var(--cs-muted)]">Safe zone</dt>
            <dd>{format.safeZone.note}</dd>
          </>
        ) : null}
      </dl>
      {format.notes ? <p className="text-sm leading-5">{format.notes}</p> : null}
      {!format.verified ? (
        <p className="text-sm leading-5 text-[var(--cs-muted)]">
          The platform doesn&apos;t publish an exact number for this one; this is the size most
          designers use.
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          className={studioButtonClasses("secondary")}
          onClick={() => copy(`${format.width}x${format.height}`, copyKey, size)}
        >
          {isCopied(copyKey) ? <CheckIcon /> : <CopyIcon />}
          Copy size
        </button>
        <button
          type="button"
          className={studioButtonClasses("tertiary")}
          onClick={download}
          disabled={downloading}
          aria-label={`Download a blank ${size} template for ${platformName} ${format.name}`}
        >
          <DownloadIcon />
          Template
        </button>
      </div>
    </article>
  );
}
