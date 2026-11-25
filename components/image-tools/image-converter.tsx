// -----------------------------------------------------------------------------
// @file: components/image-tools/image-converter.tsx
// @purpose: Image converter and compressor: PNG, JPG and WebP in, any of the
//           three out, at a chosen quality and an optional maximum width.
//           Files are converted in the browser and never uploaded.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CloseIcon, DownloadIcon, UploadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  FilePicker,
  Segmented,
  TOOL_ERROR,
  TOOL_FOCUS,
  TOOL_HINT,
  TOOL_INPUT,
  TOOL_LABEL,
  TOOL_PANEL,
} from "@/components/tools/tool-ui";
import {
  formatBytes,
  hasQuality,
  INPUT_IMAGE_TYPES,
  inputImageProblem,
  limitWidth,
  OUTPUT_FORMATS,
  outputFormat,
  renameWithExtension,
  sizeChange,
  type OutputFormat,
} from "@/lib/image-tools/fit";
import { renderImage, saveBlob, zipFiles } from "@/lib/image-tools/render";

const MAX_FILES = 30;

type Item = {
  id: string;
  file: File;
  result: { blob: Blob; name: string; width: number; height: number } | null;
  error: string | null;
};

let nextId = 0;

export function ImageConverter() {
  const qualityId = useId();
  const widthId = useId();
  const itemsRef = useRef<Item[]>([]);

  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<OutputFormat>("webp");
  const [quality, setQuality] = useState(80);
  const [maxWidth, setMaxWidth] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const widthLimit = (() => {
    const parsed = Number.parseInt(maxWidth, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  })();

  const addFiles = (files: File[]) => {
    const problems: string[] = [];
    const accepted: Item[] = [];
    for (const file of files) {
      const problem = inputImageProblem(file);
      if (problem) problems.push(`${file.name}: ${problem}`);
      else accepted.push({ id: `file-${nextId++}`, file, result: null, error: null });
    }
    const room = MAX_FILES - items.length;
    if (accepted.length > room) problems.push(`Only ${MAX_FILES} files at a time.`);
    setItems([...items, ...accepted.slice(0, Math.max(room, 0))]);
    setNotice(problems.length > 0 ? problems.join(" ") : null);
  };

  // Results belong to the settings they were made with.
  const changeSettings = (apply: () => void) => {
    apply();
    setItems((current) => current.map((item) => ({ ...item, result: null, error: null })));
  };

  const convertAll = async () => {
    setBusy(true);
    setNotice(null);
    const { extension } = outputFormat(format);
    const next: Item[] = [];
    for (const item of itemsRef.current) {
      try {
        const bitmap = await createImageBitmap(item.file);
        const size = limitWidth(bitmap.width, bitmap.height, widthLimit);
        const blob = await renderImage(bitmap, {
          ...size,
          mode: "cover",
          format,
          quality: hasQuality(format) ? quality / 100 : 1,
          backdrop: null,
        });
        bitmap.close();
        next.push({
          ...item,
          error: null,
          result: { blob, name: renameWithExtension(item.file.name, extension), ...size },
        });
      } catch (error) {
        next.push({
          ...item,
          result: null,
          error:
            error instanceof Error && error.message.includes("format")
              ? "This browser can't save that format."
              : "Couldn't convert this file.",
        });
      }
    }
    // Keep files that were added or removed while this ran.
    const current = itemsRef.current;
    setItems(current.map((item) => next.find((done) => done.id === item.id) ?? item));
    setBusy(false);
    const done = next.filter((item) => item.result).length;
    setStatus(`Converted ${done} of ${next.length} ${next.length === 1 ? "file" : "files"}.`);
  };

  const converted = items.filter((item) => item.result);
  const downloadAll = async () => {
    if (converted.length === 1) {
      saveBlob(converted[0].result!.blob, converted[0].result!.name);
      return;
    }
    setBusy(true);
    try {
      const zip = await zipFiles(
        converted.map((item) => ({ name: item.result!.name, blob: item.result!.blob })),
      );
      saveBlob(zip, "brandbite-converted-images.zip");
    } catch {
      setNotice("The zip didn't work. Download the files one by one.");
    } finally {
      setBusy(false);
    }
  };

  const before = converted.reduce((sum, item) => sum + item.file.size, 0);
  const after = converted.reduce((sum, item) => sum + item.result!.blob.size, 0);

  return (
    <section
      aria-label="Image converter"
      className="grid grid-cols-[340px_minmax(0,1fr)] gap-6 max-[1023px]:grid-cols-1"
    >
      <div className={`flex flex-col gap-6 ${TOOL_PANEL}`}>
        <div>
          <p className={TOOL_LABEL}>Images</p>
          <div className="mt-2">
            <FilePicker
              label={items.length > 0 ? "Add more" : "Choose images"}
              accept={INPUT_IMAGE_TYPES}
              multiple
              onFiles={addFiles}
            >
              <UploadIcon />
            </FilePicker>
          </div>
          <p className={`mt-2 ${TOOL_HINT}`}>
            PNG, JPG or WebP, up to 25 MB each and {MAX_FILES} at a time. They stay in your browser.
          </p>
        </div>

        <Segmented<OutputFormat>
          label="Convert to"
          options={OUTPUT_FORMATS.map((option) => ({ id: option.id, label: option.label }))}
          value={format}
          onChange={(next) => changeSettings(() => setFormat(next))}
        />

        {hasQuality(format) ? (
          <div>
            <label htmlFor={qualityId} className={TOOL_LABEL}>
              Quality: {quality}
            </label>
            <input
              id={qualityId}
              type="range"
              min={30}
              max={100}
              step={1}
              value={quality}
              onChange={(event) => changeSettings(() => setQuality(Number(event.target.value)))}
              className="mt-3 h-6 w-full accent-[var(--cs-text)]"
            />
            <p className={`mt-1 ${TOOL_HINT}`}>Lower is smaller. 75 to 85 suits most photos.</p>
          </div>
        ) : (
          <p className={TOOL_HINT}>
            PNG keeps every pixel exactly, so there is no quality setting. For a smaller file,
            choose WebP or JPG.
          </p>
        )}

        <div>
          <label htmlFor={widthId} className={TOOL_LABEL}>
            Maximum width (optional)
          </label>
          <input
            id={widthId}
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="e.g. 1600"
            value={maxWidth}
            onChange={(event) => changeSettings(() => setMaxWidth(event.target.value))}
            className={`mt-2 ${TOOL_INPUT}`}
          />
          <p className={`mt-2 ${TOOL_HINT}`}>
            Wider images are scaled down to this many pixels. Smaller ones are left alone.
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className={TOOL_PANEL}>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={items.length === 0 || busy}
              onClick={() => void convertAll()}
              className={studioButtonClasses("primary")}
            >
              {busy ? "Working…" : `Convert ${items.length > 1 ? "all" : ""}`.trim()}
            </button>
            <button
              type="button"
              disabled={converted.length === 0 || busy}
              onClick={() => void downloadAll()}
              className={studioButtonClasses("secondary")}
            >
              <DownloadIcon />
              {converted.length > 1 ? "Download all (.zip)" : "Download"}
            </button>
            {converted.length > 0 ? (
              <p className={`${TOOL_HINT} tabular-nums`}>
                {formatBytes(before)} → {formatBytes(after)} · {sizeChange(before, after)}
              </p>
            ) : null}
          </div>
          {notice ? (
            <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
              {notice}
            </p>
          ) : null}
          <p role="status" className="sr-only">
            {status}
          </p>
        </div>

        {items.length === 0 ? (
          <p className={`${TOOL_PANEL} ${TOOL_HINT}`}>
            Choose one or more images, pick what to convert them to, then press Convert.
          </p>
        ) : (
          <ul className={`${TOOL_PANEL} !py-2`}>
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--cs-border)] py-3 last:border-b-0"
              >
                <div className="min-w-[180px] flex-1">
                  <p className="truncate text-sm leading-5 font-semibold">
                    {item.result?.name ?? item.file.name}
                  </p>
                  <p className={`${TOOL_HINT} tabular-nums`}>
                    {item.result ? (
                      <>
                        {formatBytes(item.file.size)} → {formatBytes(item.result.blob.size)} ·{" "}
                        {sizeChange(item.file.size, item.result.blob.size)} · {item.result.width} ×{" "}
                        {item.result.height}
                      </>
                    ) : (
                      formatBytes(item.file.size)
                    )}
                  </p>
                  {item.error ? <p className={TOOL_ERROR}>{item.error}</p> : null}
                </div>
                {item.result ? (
                  <button
                    type="button"
                    onClick={() => saveBlob(item.result!.blob, item.result!.name)}
                    className={studioButtonClasses("secondary")}
                  >
                    <DownloadIcon />
                    Download
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => setItems(items.filter((other) => other.id !== item.id))}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] hover:bg-[var(--cs-background)] ${TOOL_FOCUS}`}
                >
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
