"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal, ModalHeader } from "@/components/ui/modal";
import type { LinkCardData } from "@/lib/moodboard";

type AddLinkModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: LinkCardData) => void;
};

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function AddLinkModal({ open, onClose, onSave }: AddLinkModalProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchedUrl, setFetchedUrl] = useState("");
  const [ogImage, setOgImage] = useState<string | undefined>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-fetch metadata when a valid URL is entered
  const fetchMetadata = useCallback(
    async (targetUrl: string) => {
      if (!isValidUrl(targetUrl) || targetUrl === fetchedUrl) return;

      setFetching(true);
      try {
        const res = await fetch("/api/customer/moodboards/link-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl }),
        });
        if (!res.ok) return;

        const data = await res.json();
        // Only auto-fill if user hasn't manually typed something
        if (data.title && !title) setTitle(data.title);
        if (data.description && !description) setDescription(data.description);
        if (data.image) setOgImage(data.image);
        setFetchedUrl(targetUrl);
      } catch {
        // Silently ignore fetch errors
      } finally {
        setFetching(false);
      }
    },
    [fetchedUrl, title, description],
  );

  useEffect(() => {
    const trimmed = url.trim();
    if (!isValidUrl(trimmed)) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchMetadata(trimmed), 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [url, fetchMetadata]);

  function handleClose() {
    setUrl("");
    setTitle("");
    setDescription("");
    setFetching(false);
    setFetchedUrl("");
    setOgImage(undefined);
    onClose();
  }

  function handleSave() {
    const trimmedUrl = url.trim();
    if (!isValidUrl(trimmedUrl)) return;

    const domain = getDomain(trimmedUrl);
    const favicon = domain
      ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      : undefined;

    onSave({
      url: trimmedUrl,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      favicon,
      image: ogImage,
    });

    handleClose();
  }

  const valid = isValidUrl(url.trim());

  return (
    <Modal open={open} onClose={handleClose} size="md">
      <ModalHeader title="Add Link" onClose={handleClose} />

      <div className="space-y-3">
        <div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400 focus:border-[var(--bb-primary)] ${
              url.trim() && !valid ? "border-red-300" : "border-[var(--bb-border)]"
            }`}
          />
          {url.trim() && !valid && (
            <p className="mt-1 text-xs text-red-500">
              Please enter a valid URL (including http:// or https://)
            </p>
          )}
          {fetching && (
            <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">Fetching link preview...</p>
          )}
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (auto-filled from URL)"
          className="w-full rounded-lg border border-[var(--bb-border)] bg-white px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400 focus:border-[var(--bb-primary)]"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (auto-filled from URL)"
          rows={2}
          className="w-full rounded-lg border border-[var(--bb-border)] bg-white px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400 focus:border-[var(--bb-primary)]"
        />
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
          disabled={!valid || fetching}
          className="rounded-lg bg-[var(--bb-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--bb-primary-hover)] disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
