// -----------------------------------------------------------------------------
// @file: components/ui/cms-image-upload.tsx
// @purpose: Single image upload component for CMS admin pages (showcase, blog)
//           with drag-and-drop support, presigned R2 upload, and preview
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type CmsImageUploadProps = {
  type: "showcase" | "blog" | "page-block";
  value: { storageKey: string; url: string } | null;
  onChange: (value: { storageKey: string; url: string } | null) => void;
  label?: string;
  aspectRatio?: string; // CSS aspect-ratio value e.g. "16/9", "4/3"
};

/* -------------------------------------------------------------------------- */
/*  Upload icon (inline SVG)                                                   */
/* -------------------------------------------------------------------------- */

function UploadIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function CmsImageUpload({ type, value, onChange, label, aspectRatio }: CmsImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---- Upload logic ---- */

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);

      try {
        // 1. Get presigned URL
        const presignRes = await fetch("/api/admin/cms-upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
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

        // 3. Notify parent
        onChange({
          storageKey: data.storageKey,
          url: data.publicUrl || data.storageKey,
        });
      } catch (err: any) {
        console.error("[CmsImageUpload] upload error:", err);
        setError(err?.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [type, onChange],
  );

  /* ---- File selection handler ---- */

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      // Reset input so re-selecting same file works
      e.target.value = "";
    },
    [uploadFile],
  );

  /* ---- Drag-and-drop handlers ---- */

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        uploadFile(file);
      }
    },
    [uploadFile],
  );

  /* ---- Remove handler ---- */

  const handleRemove = useCallback(() => {
    onChange(null);
    setError(null);
  }, [onChange]);

  /* ---- Hidden file input ---- */

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleFileChange}
    />
  );

  /* ---- Preview state (value exists) ---- */

  if (value) {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-xs font-medium text-[var(--bb-text-secondary)]">
            {label}
          </label>
        )}

        <div
          className="relative overflow-hidden rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)]"
          style={aspectRatio ? { aspectRatio } : undefined}
        >
          <img
            src={value.url}
            alt={label || "Uploaded image"}
            className="h-full w-full object-cover"
          />

          {/* Remove button */}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/90 transition-colors hover:bg-black/70 hover:text-white"
            aria-label="Remove image"
            title="Remove image"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {fileInput}
      </div>
    );
  }

  /* ---- Drop zone state (no value) ---- */

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-medium text-[var(--bb-text-secondary)]">{label}</label>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!uploading) inputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
          dragOver
            ? "border-[var(--bb-primary)] bg-[var(--bb-primary)]/5"
            : "border-[var(--bb-border)] bg-[var(--bb-bg-warm)] hover:border-[var(--bb-primary)]"
        } ${uploading ? "pointer-events-none" : ""}`}
        style={aspectRatio ? { aspectRatio } : { minHeight: "160px" }}
      >
        {uploading ? (
          /* Uploading spinner overlay */
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--bb-border)] border-t-[var(--bb-primary)]" />
            <span className="text-xs text-[var(--bb-text-muted)]">Uploading...</span>
          </div>
        ) : (
          /* Idle drop zone content */
          <div className="flex flex-col items-center gap-2 px-4 py-6">
            <UploadIcon className="h-8 w-8 text-[var(--bb-text-muted)]" />
            {label && (
              <span className="text-sm font-medium text-[var(--bb-text-secondary)]">{label}</span>
            )}
            <span className="text-xs text-[var(--bb-text-muted)]">Click or drag to upload</span>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-[var(--bb-danger-text,#d94e24)]">{error}</p>}

      {fileInput}
    </div>
  );
}
