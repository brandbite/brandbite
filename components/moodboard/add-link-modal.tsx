"use client";

import React, { useState } from "react";
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

  function handleClose() {
    setUrl("");
    setTitle("");
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
      favicon,
    });

    setUrl("");
    setTitle("");
    onClose();
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
              url.trim() && !valid
                ? "border-red-300"
                : "border-[var(--bb-border)]"
            }`}
          />
          {url.trim() && !valid && (
            <p className="mt-1 text-xs text-red-500">
              Please enter a valid URL (including http:// or https://)
            </p>
          )}
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
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
          disabled={!valid}
          className="rounded-lg bg-[var(--bb-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--bb-primary-hover)] disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
