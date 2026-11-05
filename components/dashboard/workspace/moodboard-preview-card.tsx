// -----------------------------------------------------------------------------
// @file: components/dashboard/workspace/moodboard-preview-card.tsx
// @purpose: Moodboard card for the customer list: always a 2x2 preview of the
//           board's first items, so cards line up whatever a board contains.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { IconDocument } from "@/components/admin/v2/icons";
import { Badge, buttonClass, plural } from "@/components/admin/v2/ui";

export type MoodboardPreview = {
  id: string;
  title: string;
  projectName: string | null;
  itemCount: number;
  thumbnails: Record<string, unknown>[];
};

const CELLS = 4;

function CentredIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--av2-bg)] text-[var(--av2-text-2)]">
      {children}
    </div>
  );
}

function LinkGlyph() {
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}

function PreviewImage({ src, video = false }: { src: string; video?: boolean }) {
  // Stored links can expire; show a plain tile rather than a broken-image icon.
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="h-full w-full bg-[var(--av2-track)]" />;
  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--av2-track)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
      {video && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-black">
            <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 1.5V10.5L10.5 6L3 1.5Z" />
            </svg>
          </span>
        </div>
      )}
    </div>
  );
}

function PreviewCell({ item }: { item: Record<string, unknown> }) {
  const type = item.type as string | undefined;

  if (type === "IMAGE" && typeof item.url === "string") return <PreviewImage src={item.url} />;

  // User-picked colour: data, not theme, so it stays an inline value.
  if (type === "COLOR" && typeof item.hex === "string") {
    return <div className="h-full w-full" style={{ backgroundColor: item.hex }} />;
  }

  if (type === "EMBED" && typeof item.thumbnailUrl === "string") {
    return <PreviewImage src={item.thumbnailUrl} video />;
  }

  if (type === "LINK") {
    if (typeof item.image === "string") return <PreviewImage src={item.image} />;
    return (
      <CentredIcon>
        <LinkGlyph />
      </CentredIcon>
    );
  }

  if (type === "SHAPE" || type === "TEXT") {
    const text = typeof item.text === "string" ? item.text : "";
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden bg-[var(--av2-surface)] p-2.5">
        <p className="line-clamp-3 text-center text-xs leading-4 break-words text-[var(--av2-text-2)]">
          {text}
        </p>
      </div>
    );
  }

  if (type === "NOTE") {
    const title = typeof item.title === "string" ? item.title : "";
    const body = typeof item.body === "string" ? item.body : "";
    const color = typeof item.color === "string" ? item.color : undefined;
    return (
      <div
        className={`h-full w-full overflow-hidden p-2.5 ${color ? "text-[#292827]" : "bg-[var(--av2-attention-from)]"}`}
        style={color ? { backgroundColor: color } : undefined}
      >
        <p
          className={`line-clamp-3 text-xs leading-4 break-words ${color ? "" : "text-[var(--av2-text-2)]"}`}
        >
          {title || body || "Empty note"}
        </p>
      </div>
    );
  }

  if (type === "TODO") {
    const items = Array.isArray(item.items)
      ? (item.items.slice(0, 3) as { checked?: boolean; text?: string }[])
      : [];
    return (
      <div className="flex h-full w-full flex-col gap-1 overflow-hidden bg-[var(--av2-bg)] p-2.5">
        {items.length === 0 && <p className="text-xs text-[var(--av2-text-2)]">Empty list</p>}
        {items.map((todo, i) => (
          <div key={i} className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-[var(--av2-fill-neutral)]"
              style={todo?.checked ? { background: "var(--av2-fill-green)" } : undefined}
            />
            <span className="truncate text-xs leading-4 text-[var(--av2-text-2)]">
              {todo?.text || ""}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "FILE") {
    return (
      <CentredIcon>
        <IconDocument width={20} height={20} />
      </CentredIcon>
    );
  }

  return <div className="h-full w-full bg-[var(--av2-track)]" />;
}

export function MoodboardPreviewCard({
  moodboard,
  dateLabel,
}: {
  moodboard: MoodboardPreview;
  /** Already-formatted line, e.g. "Updated Mar 9, 2026". */
  dateLabel: string;
}) {
  const thumbnails = moodboard.thumbnails.slice(0, CELLS);

  return (
    <Link
      href={`/customer/moodboards/${moodboard.id}`}
      className="group flex h-full flex-col rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-3 transition-colors hover:border-[var(--av2-accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none"
    >
      <div
        aria-hidden
        className="grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl"
      >
        {thumbnails.map((thumb, i) => (
          <PreviewCell key={i} item={thumb} />
        ))}
        {Array.from({ length: CELLS - thumbnails.length }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-[var(--av2-track)]" />
        ))}
      </div>

      <div className="mt-3 flex flex-1 items-end gap-3 px-1 pb-1">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{moodboard.title}</h2>
          {moodboard.projectName && (
            <Badge className="mt-1.5 max-w-full">
              <span className="truncate">{moodboard.projectName}</span>
            </Badge>
          )}
          <p className="mt-1.5 text-sm text-[var(--av2-text-2)]">
            {moodboard.itemCount} {plural(moodboard.itemCount, "item", "items")}
          </p>
          <p className="text-sm text-[var(--av2-text-2)]">{dateLabel}</p>
        </div>
        <span className={buttonClass("secondary")}>Open</span>
      </div>
    </Link>
  );
}
