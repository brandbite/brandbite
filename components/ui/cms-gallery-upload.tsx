// -----------------------------------------------------------------------------
// @file: components/ui/cms-gallery-upload.tsx
// @purpose: Multi-image gallery upload for CMS admin pages (showcase works).
//           Grid of thumbnails with individual removal and batch-add via file picker.
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type GalleryImage = { storageKey: string; url: string; alt?: string };

type CmsGalleryUploadProps = {
  value: GalleryImage[];
  onChange: (value: GalleryImage[]) => void;
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function CmsGalleryUpload({ value, onChange }: CmsGalleryUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  /* ---- Upload a single file and return the resulting GalleryImage ---- */

  const uploadSingleFile = useCallback(async (file: File): Promise<GalleryImage | null> => {
    try {
      // 1. Get presigned URL
      const presignRes = await fetch("/api/admin/cms-upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "showcase",
          contentType: file.type,
          bytes: file.size,
          originalName: file.name,
        }),
      });

      if (!presignRes.ok) {
        const json = await presignRes.json().catch(() => null);
        throw new Error(json?.error || "Failed to get upload URL");
      }

      const data = await presignRes.json();

      // 2. PUT file to R2
      const putRes = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error("Failed to upload file");
      }

      return {
        storageKey: data.storageKey,
        url: data.publicUrl || data.storageKey,
      };
    } catch (err) {
      console.error("[CmsGalleryUpload] upload error:", err);
      return null;
    }
  }, []);

  /* ---- Handle file selection (multiple files) ---- */

  const handleFilesSelected = useCallback(
    async (files: FileList) => {
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));

      if (imageFiles.length === 0) return;

      setUploadingCount(imageFiles.length);

      // Upload files individually and append results as they complete
      const results: GalleryImage[] = [];

      for (const file of imageFiles) {
        const result = await uploadSingleFile(file);
        if (result) {
          results.push(result);
        }
        setUploadingCount((prev) => Math.max(0, prev - 1));
      }

      if (results.length > 0) {
        onChange([...value, ...results]);
      }
    },
    [value, onChange, uploadSingleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) handleFilesSelected(files);
      // Reset input so re-selecting same files works
      e.target.value = "";
    },
    [handleFilesSelected],
  );

  /* ---- Remove a single image ---- */

  const handleRemove = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  /* ---- Render ---- */

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {/* Existing thumbnails */}
        {value.map((img, i) => (
          <div
            key={img.storageKey}
            className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-card)]"
          >
            <img
              src={img.url}
              alt={img.alt || `Gallery image ${i + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />

            {/* Remove button */}
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white/90 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
              aria-label={`Remove image ${i + 1}`}
              title="Remove"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3 w-3"
              >
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        ))}

        {/* Uploading placeholders */}
        {Array.from({ length: uploadingCount }).map((_, i) => (
          <div
            key={`uploading-${i}`}
            className="flex aspect-square items-center justify-center rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-warm)]"
          >
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--bb-border)] border-t-[var(--bb-primary)]" />
          </div>
        ))}

        {/* Add image button */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploadingCount > 0}
          className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-warm)] transition-colors hover:border-[var(--bb-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Add image"
        >
          {/* Plus icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-[var(--bb-text-muted)]"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="text-[10px] font-medium text-[var(--bb-text-muted)]">Add image</span>
        </button>
      </div>

      {/* Hidden file input (multiple) */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
