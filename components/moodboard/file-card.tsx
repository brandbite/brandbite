"use client";

import React from "react";
import type { FileCardData } from "@/lib/moodboard";
import { formatBytes } from "@/lib/upload-helpers";

type FileCardProps = {
  data: FileCardData;
};

function DocumentIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      className="flex-shrink-0 text-[var(--bb-text-secondary)]"
    >
      <path
        d="M10 4C10 2.89543 10.8954 2 12 2H24L32 10V36C32 37.1046 31.1046 38 30 38H12C10.8954 38 10 37.1046 10 36V4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path d="M24 2V10H32" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line
        x1="15"
        y1="18"
        x2="27"
        y2="18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="15"
        y1="23"
        x2="27"
        y2="23"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="15"
        y1="28"
        x2="22"
        y2="28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FileCard({ data }: FileCardProps) {
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-4 transition-colors hover:bg-gray-50"
    >
      <DocumentIcon />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--bb-secondary)]">
          {data.originalName}
        </p>
        <p className="mt-0.5 text-xs text-[var(--bb-text-secondary)]">{formatBytes(data.bytes)}</p>
      </div>
    </a>
  );
}
