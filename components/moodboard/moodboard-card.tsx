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
      <div className="bg-gray-150" style={{ backgroundColor: "#ebebeb" }} />
      <div className="bg-gray-150" style={{ backgroundColor: "#e5e5e5" }} />
      <div className="bg-gray-200" />
    </div>
  );
}

export function MoodboardCard({ moodboard }: MoodboardCardProps) {
  const thumbnails = moodboard.thumbnails.slice(0, 4);
  const hasThumbnails = thumbnails.length > 0 && thumbnails.some((t) => typeof t?.url === "string");

  return (
    <Link
      href={`/customer/moodboards/${moodboard.id}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Thumbnail grid */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {hasThumbnails ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
            {thumbnails.map((thumb, i) => {
              const url = typeof thumb?.url === "string" ? thumb.url : null;
              return (
                <div key={i} className="overflow-hidden bg-gray-200">
                  {url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gray-200" />
                  )}
                </div>
              );
            })}
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
