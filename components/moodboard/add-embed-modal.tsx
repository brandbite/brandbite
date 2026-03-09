"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { parseVideoUrl } from "@/lib/moodboard";
import type { EmbedCardData } from "@/lib/moodboard";

type AddEmbedModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: EmbedCardData) => void;
};

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const providerLabels: Record<string, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  loom: "Loom",
  generic: "Website",
};

export function AddEmbedModal({ open, onClose, onSave }: AddEmbedModalProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseVideoUrl>>(null);
  const [fetching, setFetching] = useState(false);
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedUrlRef = useRef("");

  // Parse URL as user types and auto-fetch title
  const handleUrlChange = useCallback(
    (value: string) => {
      setUrl(value);
      const trimmed = value.trim();
      if (isValidUrl(trimmed)) {
        const result = parseVideoUrl(trimmed);
        setParsed(result);

        // Auto-fetch title for YouTube/Vimeo
        if (
          result &&
          (result.provider === "youtube" || result.provider === "vimeo") &&
          fetchedUrlRef.current !== trimmed
        ) {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            fetchedUrlRef.current = trimmed;
            setFetching(true);
            fetch("/api/customer/moodboards/video-oembed", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: trimmed }),
            })
              .then((r) => r.json())
              .then((data) => {
                if (data.title && !userEditedTitle) {
                  setTitle(data.title);
                }
              })
              .catch(() => {})
              .finally(() => setFetching(false));
          }, 400);
        }
      } else {
        setParsed(null);
      }
    },
    [userEditedTitle],
  );

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  function handleClose() {
    setUrl("");
    setTitle("");
    setParsed(null);
    setFetching(false);
    setUserEditedTitle(false);
    fetchedUrlRef.current = "";
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onClose();
  }

  function handleSave() {
    if (!parsed) return;

    onSave({
      url: url.trim(),
      embedUrl: parsed.embedUrl,
      title: title.trim() || undefined,
      provider: parsed.provider,
      thumbnailUrl: parsed.thumbnailUrl,
    });

    handleClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && parsed) {
      e.preventDefault();
      handleSave();
    }
  }

  const valid = isValidUrl(url.trim());

  return (
    <Modal open={open} onClose={handleClose} size="md">
      <ModalHeader title="Add Video" onClose={handleClose} />

      <div className="space-y-3">
        <div>
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a YouTube, Vimeo, or Loom URL..."
            className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400 focus:border-[var(--bb-primary)] ${
              url.trim() && !valid ? "border-red-300" : "border-[var(--bb-border)]"
            }`}
          />
          {url.trim() && !valid && (
            <p className="mt-1 text-xs text-red-500">
              Please enter a valid URL (including https://)
            </p>
          )}
        </div>

        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setUserEditedTitle(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Title (auto-filled from video)"
            className="w-full rounded-lg border border-[var(--bb-border)] bg-white px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400 focus:border-[var(--bb-primary)]"
          />
          {fetching && (
            <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">Fetching video title...</p>
          )}
        </div>

        {/* Preview */}
        {parsed && (
          <div className="overflow-hidden rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-warm)]">
            {parsed.thumbnailUrl ? (
              <div className="relative aspect-video w-full bg-gray-900">
                <img
                  src={parsed.thumbnailUrl}
                  alt="Video preview"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M8 5.5V18.5L19 12L8 5.5Z" fill="white" />
                    </svg>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-gray-100">
                <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                  <rect x="6" y="10" width="36" height="28" rx="4" stroke="#999" strokeWidth="2" />
                  <path d="M20 18V30L30 24L20 18Z" fill="#999" />
                </svg>
              </div>
            )}
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-[var(--bb-secondary)]">
                {title ? title : `${providerLabels[parsed.provider]} video detected`}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={handleClose}
          className="rounded-lg border border-[var(--bb-border)] px-4 py-2 text-sm font-medium text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-bg-warm)]"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!parsed}
          className="rounded-lg bg-[var(--bb-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--bb-primary-hover)] disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
