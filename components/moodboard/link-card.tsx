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
    <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[var(--av2-border)] text-[10px] font-bold text-[var(--av2-text-2)]">
      {letter}
    </div>
  );
}

export function LinkCard({ data }: LinkCardProps) {
  const domain = getDomain(data.url);
  const [ogImageFailed, setOgImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  const faviconUrl = data.favicon;

  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer" className="block">
      {/* OG Image preview — hide entire container on error */}
      {data.image && !ogImageFailed && (
        <div className="aspect-[2/1] overflow-hidden bg-[var(--av2-bg)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.image}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setOgImageFailed(true)}
            onLoad={(e) => {
              // Images blocked by CORS/CSP load with naturalWidth 0 without firing onerror
              if ((e.target as HTMLImageElement).naturalWidth === 0) setOgImageFailed(true);
            }}
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {!faviconUrl || faviconFailed ? (
            <DomainIcon domain={domain} />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={faviconUrl}
              alt=""
              className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-md"
              onError={() => setFaviconFailed(true)}
              onLoad={(e) => {
                if ((e.target as HTMLImageElement).naturalWidth === 0) setFaviconFailed(true);
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--av2-text)]">{data.title || domain}</p>
            <p className="mt-0.5 truncate text-xs text-[var(--av2-text-2)]">{data.url}</p>
            {data.description && (
              <p className="mt-1 line-clamp-2 text-xs text-[var(--av2-text-2)]">
                {data.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
