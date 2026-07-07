// -----------------------------------------------------------------------------
// @file: components/colors/image-color-extractor.tsx
// @purpose: Drag/drop or pick an image, extract its dominant colors fully in the
//           browser (no upload), and hand the palette back to the parent tool.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useRef, useState } from "react";
import { extractPalette } from "@/lib/colors";
import type { Palette } from "@/lib/colors";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB guardrail; never uploaded

export function ImageColorExtractor({
  colorCount = 6,
  onExtracted,
}: {
  colorCount?: number;
  onExtracted: (palette: Palette) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("That image is too large (max 15MB).");
        return;
      }
      setBusy(true);
      try {
        const url = URL.createObjectURL(file);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        const palette = await extractPalette(file, { maxColors: colorCount });
        onExtracted(palette);
      } catch {
        setError("Couldn't read colors from that image.");
      } finally {
        setBusy(false);
      }
    },
    [colorCount, onExtracted],
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-6 py-10 text-center"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Uploaded preview"
            className="max-h-40 rounded-lg object-contain shadow-sm"
          />
        ) : (
          <p className="text-sm text-[var(--bb-text-tertiary)]">
            Drag &amp; drop an image here, or choose a file. Colors are read on your device —
            nothing is uploaded.
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          loadingText="Extracting…"
          onClick={() => inputRef.current?.click()}
        >
          {previewUrl ? "Choose another image" : "Upload image"}
        </Button>
      </div>
      {error ? <p className="text-sm text-[var(--bb-danger-text)]">{error}</p> : null}
    </div>
  );
}
