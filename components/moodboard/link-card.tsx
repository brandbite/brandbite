"use client";

import React, { useState } from "react";
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

function DomainIcon({ domain }: { domain: string }) {
  // First letter of domain as fallback icon
  const letter = domain
    .replace(/^www\./, "")
    .charAt(0)
    .toUpperCase();
  return (
    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-sm bg-gray-200 text-[10px] font-bold text-gray-500">
      {letter}
    </div>
  );
}

export function LinkCard({ data }: LinkCardProps) {
  const domain = getDomain(data.url);
  const [ogImageFailed, setOgImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  const faviconUrl = data.favicon || `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-colors hover:bg-gray-50"
    >
      {/* OG Image preview — hide entire container on error */}
      {data.image && !ogImageFailed && (
        <div className="aspect-[2/1] overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.image}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setOgImageFailed(true)}
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {faviconFailed ? (
            <DomainIcon domain={domain} />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={faviconUrl}
              alt=""
              className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-sm"
              onError={() => setFaviconFailed(true)}
            />
          )}
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
      </div>
    </a>
  );
}
