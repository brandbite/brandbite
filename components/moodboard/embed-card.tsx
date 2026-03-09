"use client";

import React, { useState } from "react";
import type { EmbedCardData } from "@/lib/moodboard";

type EmbedCardProps = {
  data: EmbedCardData;
};

function ProviderBadge({ provider }: { provider: EmbedCardData["provider"] }) {
  const labels: Record<string, string> = {
    youtube: "YouTube",
    vimeo: "Vimeo",
    loom: "Loom",
    generic: "Embed",
  };

  return (
    <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
      {labels[provider] ?? "Embed"}
    </span>
  );
}

function PlayButton() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 transition-transform group-hover:scale-110">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M8 5.5V18.5L19 12L8 5.5Z" fill="white" />
      </svg>
    </div>
  );
}

export function EmbedCard({ data }: EmbedCardProps) {
  const [playing, setPlaying] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  if (playing) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-t-xl bg-black">
        <iframe
          src={data.embedUrl + (data.embedUrl.includes("?") ? "&" : "?") + "autoplay=1"}
          title={data.title ?? "Embedded video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Thumbnail / play area */}
      <div
        className="group relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-t-xl bg-gray-900"
        onClick={() => setPlaying(true)}
      >
        {data.thumbnailUrl && !thumbError ? (
          <img
            src={data.thumbnailUrl}
            alt={data.title ?? "Video thumbnail"}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={() => setThumbError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="6" y="10" width="36" height="28" rx="4" stroke="#666" strokeWidth="2" />
              <path d="M20 18V30L30 24L20 18Z" fill="#666" />
            </svg>
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
          <PlayButton />
        </div>

        {/* Provider badge */}
        <div className="absolute top-2 left-2">
          <ProviderBadge provider={data.provider} />
        </div>
      </div>

      {/* Title bar */}
      {data.title && (
        <div className="border-t border-[var(--bb-border)] px-3 py-2">
          <p className="truncate text-xs font-medium text-[var(--bb-secondary)]">{data.title}</p>
          <p className="truncate text-[10px] text-[var(--bb-text-secondary)]">{data.url}</p>
        </div>
      )}
    </div>
  );
}
