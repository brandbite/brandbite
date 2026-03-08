"use client";

import React from "react";
import type { LinkCardData } from "@/lib/moodboard";

type LinkCardProps = {
  data: LinkCardData;
};

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function LinkCard({ data }: LinkCardProps) {
  const domain = getDomain(data.url);
  const faviconUrl = data.favicon || `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 transition-colors hover:bg-gray-50"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={faviconUrl} alt="" className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--bb-secondary)]">{data.title || domain}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--bb-text-secondary)]">{data.url}</p>
          {data.description && (
            <p className="mt-1 line-clamp-2 text-xs text-[var(--bb-text-secondary)]">
              {data.description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}
