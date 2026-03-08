"use client";

import React from "react";
import Link from "next/link";

type MoodboardThumbnail = {
  data: {
    url?: string;
  };
};

type MoodboardCardProps = {
  moodboard: {
    id: string;
    title: string;
    description?: string | null;
    _count: { items: number };
    project?: { id: string; name: string } | null;
    thumbnails: MoodboardThumbnail[];
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
  const hasThumbnails = thumbnails.length > 0;

  return (
    <Link
      href={`/customer/moodboards/${moodboard.id}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Thumbnail grid */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {hasThumbnails ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
            {thumbnails.map((thumb, i) => (
              <div key={i} className="overflow-hidden bg-gray-200">
                {thumb.data.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={thumb.data.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gray-200" />
                )}
              </div>
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
          {moodboard.project && (
            <span className="inline-flex items-center rounded-full bg-[var(--bb-bg-warm)] px-2 py-0.5 text-[10px] font-medium text-[var(--bb-text-secondary)]">
              {moodboard.project.name}
            </span>
          )}
          <span className="text-xs text-[var(--bb-text-secondary)]">
            {moodboard._count.items} {moodboard._count.items === 1 ? "item" : "items"}
          </span>
        </div>

        <p className="mt-1.5 text-[11px] text-[var(--bb-text-secondary)]">
          {formatDate(moodboard.createdAt)}
        </p>
      </div>
    </Link>
  );
}
