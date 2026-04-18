"use client";

import React from "react";
import Link from "next/link";

type MoodboardCardProps = {
  moodboard: {
    id: string;
    title: string;
    description?: string | null;
    itemCount: number;
    projectName?: string | null;
    thumbnails: Record<string, unknown>[];
    createdAt: string;
  };
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PlaceholderGrid() {
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5 bg-gray-100">
      <div className="bg-gray-200" />
      <div style={{ backgroundColor: "#ebebeb" }} />
      <div style={{ backgroundColor: "#e5e5e5" }} />
      <div className="bg-gray-200" />
    </div>
  );
}

/** Render a single thumbnail cell based on item type. */
function ThumbnailCell({ item }: { item: Record<string, unknown> }) {
  const type = item.type as string | undefined;

  // IMAGE — show the image
  if (type === "IMAGE" && typeof item.url === "string") {
    return (
      <div className="h-full w-full overflow-hidden bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  // COLOR — show the color swatch
  if (type === "COLOR" && typeof item.hex === "string") {
    return <div className="h-full w-full" style={{ backgroundColor: item.hex }} />;
  }

  // EMBED (video) — show the thumbnail image
  if (type === "EMBED" && typeof item.thumbnailUrl === "string") {
    return (
      <div className="relative h-full w-full overflow-hidden bg-gray-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-90" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 1.5V10.5L10.5 6L3 1.5Z" fill="#333" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // LINK — show link preview image or favicon
  if (type === "LINK") {
    if (typeof item.image === "string") {
      return (
        <div className="h-full w-full overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt="" className="h-full w-full object-cover" />
        </div>
      );
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-gray-300">
          <path
            d="M8.5 11.5L11.5 8.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M11.5 13.5L14 11C15.1046 9.89543 15.1046 8.10457 14 7L13 6C11.8954 4.89543 10.1046 4.89543 9 6L6.5 8.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M8.5 6.5L6 9C4.89543 10.1046 4.89543 11.8954 6 13L7 14C8.10457 15.1046 9.89543 15.1046 11 14L13.5 11.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  // NOTE — show text preview
  if (type === "NOTE") {
    const title = typeof item.title === "string" ? item.title : "";
    const body = typeof item.body === "string" ? item.body : "";
    const text = title || body;
    return (
      <div className="flex h-full w-full items-start overflow-hidden bg-[#fffef5] p-2">
        <p className="line-clamp-4 text-[8px] leading-tight text-gray-500">
          {text || "Empty note"}
        </p>
      </div>
    );
  }

  // TODO — show mini checklist
  if (type === "TODO") {
    const items = Array.isArray(item.items) ? item.items.slice(0, 3) : [];
    return (
      <div className="flex h-full w-full flex-col gap-1 overflow-hidden bg-white p-2">
        {items.map((todo: any, i: number) => (
          <div key={i} className="flex items-center gap-1">
            <div
              className={`h-2 w-2 flex-shrink-0 rounded-sm border ${todo?.checked ? "border-green-400 bg-green-400" : "border-gray-300"}`}
            />
            <span className="truncate text-[7px] text-gray-400">{todo?.text || ""}</span>
          </div>
        ))}
        {items.length === 0 && <p className="text-[8px] text-gray-300">Empty list</p>}
      </div>
    );
  }

  // FILE — show file icon
  if (type === "FILE") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-gray-300">
          <path
            d="M5 3C5 2.44772 5.44772 2 6 2H12L16 6V17C16 17.5523 15.5523 18 15 18H6C5.44772 18 5 17.5523 5 17V3Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M12 2V6H16" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  // Fallback — gray block
  return <div className="h-full w-full bg-gray-200" />;
}

export function MoodboardCard({ moodboard }: MoodboardCardProps) {
  const thumbnails = moodboard.thumbnails.slice(0, 4);
  const hasContent = thumbnails.length > 0;

  return (
    <Link
      href={`/customer/moodboards/${moodboard.id}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Thumbnail grid */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {hasContent ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
            {thumbnails.map((thumb, i) => (
              <ThumbnailCell key={i} item={thumb} />
            ))}
            {/* Fill remaining slots */}
            {Array.from({ length: Math.max(0, 4 - thumbnails.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-gray-200" />
            ))}
          </div>
        ) : (
          <PlaceholderGrid />
        )}
      </div>

      {/* Info section */}
      <div className="p-4">
        <h3 className="truncate text-sm font-semibold text-[var(--bb-secondary)]">
          {moodboard.title}
        </h3>

        <div className="mt-2 flex items-center gap-2">
          {moodboard.projectName && (
            <span className="inline-flex items-center rounded-full bg-[var(--bb-bg-warm)] px-2 py-0.5 text-[10px] font-medium text-[var(--bb-text-secondary)]">
              {moodboard.projectName}
            </span>
          )}
          <span className="text-xs text-[var(--bb-text-secondary)]">
            {moodboard.itemCount} {moodboard.itemCount === 1 ? "item" : "items"}
          </span>
        </div>

        <p className="mt-1.5 text-[11px] text-[var(--bb-text-secondary)]">
          {formatDate(moodboard.createdAt)}
        </p>
      </div>
    </Link>
  );
}
