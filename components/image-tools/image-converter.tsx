// -----------------------------------------------------------------------------
// @file: components/image-tools/image-converter.tsx
// @purpose: Image converter and compressor in three steps: add PNG, JPG or
//           WebP images, set the format, quality and an optional maximum
//           width, then convert and download them one by one or as a zip.
//           Files are converted in the browser and never uploaded.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CheckIcon, CloseIcon, DownloadIcon, UploadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { StepHeading } from "@/components/tools/tool-page";
import {
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
  /** A temporary address for the small picture of the file. */
  url: string;
  result: {
    blob: Blob;
    name: string;
    width: number;
    height: number;
    format: OutputFormat;
  } | null;
  error: string | null;
};

let nextId = 0;

const ICON_BUTTON = `flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)] ${TOOL_FOCUS}`;
const THUMB = "rounded-lg border border-[var(--cs-border)] bg-[var(--cs-background)] object-cover";
/** Thumbnail, file name, original size, converted size, state, format, buttons. */
const ROW =
  "grid grid-cols-[64px_minmax(0,1fr)_110px_130px_130px_72px_100px] items-center gap-4 px-5 max-[1023px]:grid-cols-[56px_minmax(0,1fr)_auto] max-[1023px]:gap-3 max-[767px]:px-4";
const WIDE_ONLY = "max-[1023px]:hidden";

export function ImageConverter() {
  const inputId = useId();
  const qualityId = useId();
  const widthId = useId();
  const itemsRef = useRef<Item[]>([]);

  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<OutputFormat>("webp");
  const [quality, setQuality] = useState(80);
  const [maxWidth, setMaxWidth] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Let go of the small pictures when the page is left.
  useEffect(
    () => () => {
      for (const item of itemsRef.current) URL.revokeObjectURL(item.url);
    },
    [],
  );

  const widthLimit = (() => {
    const parsed = Number.parseInt(maxWidth, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  })();

  const addFiles = (files: File[]) => {
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      const problem = inputImageProblem(file);
      if (problem) problems.push(`${file.name}: ${problem}`);
      else accepted.push(file);
    }
    const room = Math.max(MAX_FILES - items.length, 0);
    if (accepted.length > room) problems.push(`Only ${MAX_FILES} files at a time.`);
    setItems([
      ...items,
      ...accepted.slice(0, room).map((file) => ({
        id: `file-${nextId++}`,
        file,
        url: URL.createObjectURL(file),
        result: null,
        error: null,
      })),
    ]);
    setNotice(problems.length > 0 ? problems.join(" ") : null);
  };

  const removeItem = (id: string) => {
    const gone = items.find((item) => item.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    setItems(items.filter((item) => item.id !== id));
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
          result: { blob, name: renameWithExtension(item.file.name, extension), format, ...size },
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
  const shown = items.filter((item) => item.result || item.error);
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
    <section aria-label="Image converter" className="flex flex-col gap-8">
      <div>
        <StepHeading
          number={1}
          title="Add your images"
          hint={`Choose up to ${MAX_FILES} JPG, PNG or WebP files, 25 MB each.`}
        />
        <div className={`mt-4 ${TOOL_PANEL} !p-3`}>
          <label
            htmlFor={inputId}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(Array.from(event.dataTransfer.files));
            }}
            className={`flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-4 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-[var(--cs-text)] focus-within:ring-offset-2 ${
              dragging
                ? "border-[var(--cs-selected)] bg-[var(--cs-soft)]"
                : "border-[#B9B5AE] hover:border-[var(--cs-text)]"
            }`}
          >
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
            >
              <UploadIcon />
            </span>
            <span className="mt-3 text-base leading-6 font-semibold">
              Drag and drop images here
            </span>
            <span className={TOOL_HINT}>or click to choose files</span>
            <span className={`mt-3 ${studioButtonClasses("secondary")}`}>
              {items.length > 0 ? "Add more files" : "Choose files"}
            </span>
            <input
              id={inputId}
              type="file"
              accept={INPUT_IMAGE_TYPES.join(",")}
              multiple
              className="sr-only"
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </label>

          {items.length > 0 ? (
            <ul
              aria-label="Images added"
              className="mt-3 grid max-h-[244px] grid-cols-3 gap-3 overflow-y-auto max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1"
            >
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--cs-border)] py-2 pr-1 pl-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a file on the visitor's device */}
                  <img
                    src={item.url}
                    alt=""
                    width={64}
                    height={48}
                    className={`h-12 w-16 ${THUMB}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm leading-5 font-semibold">
                      {item.file.name}
                    </span>
                    <span className={`block ${TOOL_HINT} tabular-nums`}>
                      {formatBytes(item.file.size)}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={() => removeItem(item.id)}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] hover:bg-[var(--cs-background)] ${TOOL_FOCUS}`}
                  >
                    <CloseIcon />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {notice ? (
          <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
            {notice}
          </p>
        ) : null}
      </div>

      <div>
        <StepHeading
          number={2}
          title="Set your options"
          hint="Choose format, quality and maximum width."
        />
        <div className={`mt-4 ${TOOL_PANEL}`}>
          <div className="grid grid-cols-3 max-[899px]:grid-cols-1 max-[899px]:gap-6">
            <fieldset className="min-[900px]:pr-8">
              <legend className={TOOL_LABEL}>Format</legend>
              <div className="mt-2 flex flex-col gap-1">
                {OUTPUT_FORMATS.map((option) => (
                  <label
                    key={option.id}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-base leading-6 focus-within:ring-2 focus-within:ring-[var(--cs-text)] ${
                      option.id === format
                        ? "bg-[var(--cs-soft)] font-semibold"
                        : "hover:bg-[var(--cs-background)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${inputId}-format`}
                      checked={option.id === format}
                      onChange={() => changeSettings(() => setFormat(option.id))}
                      className="h-5 w-5 accent-[var(--cs-selected)] outline-none"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="min-[900px]:border-l min-[900px]:border-[var(--cs-border)] min-[900px]:px-8">
              {hasQuality(format) ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={qualityId} className={TOOL_LABEL}>
                      Quality
                    </label>
                    <span className={`${TOOL_LABEL} tabular-nums`}>{quality}%</span>
                  </div>
                  <input
                    id={qualityId}
                    type="range"
                    min={30}
                    max={100}
                    step={1}
                    value={quality}
                    onChange={(event) =>
                      changeSettings(() => setQuality(Number(event.target.value)))
                    }
                    className="mt-3 h-6 w-full accent-[var(--cs-selected)]"
                  />
                  <p className={`mt-2 ${TOOL_HINT}`}>
                    Higher keeps more detail and makes a larger file. 75 to 85 suits most photos.
                  </p>
                </>
              ) : (
                <>
                  <p className={TOOL_LABEL}>Quality</p>
                  <p className={`mt-2 ${TOOL_HINT}`}>
                    PNG keeps every pixel exactly, so there is no quality setting. For a smaller
                    file, choose WebP or JPG.
                  </p>
                </>
              )}
            </div>

            <div className="min-[900px]:border-l min-[900px]:border-[var(--cs-border)] min-[900px]:pl-8">
              <label htmlFor={widthId} className={`block ${TOOL_LABEL}`}>
                Maximum width (optional)
              </label>
              <div className="relative mt-2">
                <input
                  id={widthId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="e.g. 1600"
                  value={maxWidth}
                  onChange={(event) => changeSettings(() => setMaxWidth(event.target.value))}
                  className={`${TOOL_INPUT} !pr-10 !text-base`}
                />
                <span
                  aria-hidden
                  className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 ${TOOL_HINT}`}
                >
                  px
                </span>
              </div>
              <p className={`mt-2 ${TOOL_HINT}`}>
                Wider images are scaled down to this width. Smaller ones are left as they are.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              disabled={items.length === 0 || busy}
              onClick={() => void convertAll()}
              className={`${studioButtonClasses("primary")} !h-12 min-w-[220px] !px-8 !text-base max-[639px]:w-full`}
            >
              {busy
                ? "Converting…"
                : items.length === 0
                  ? "Convert images"
                  : `Convert ${items.length} ${items.length === 1 ? "image" : "images"}`}
            </button>
          </div>
        </div>
      </div>

      <div>
        <StepHeading
          number={3}
          title="Convert and download"
          hint="Get individual files or one ZIP."
        />
        {shown.length === 0 ? (
          <p className={`mt-4 ${TOOL_PANEL} ${TOOL_HINT}`}>
            {items.length === 0
              ? "Add images above, then press Convert. The converted files show up here."
              : "Press Convert and the converted files show up here."}
          </p>
        ) : (
          <div className={`mt-4 ${TOOL_PANEL} overflow-hidden !p-0`}>
            <div
              aria-hidden
              className={`${ROW} ${WIDE_ONLY} border-b border-[var(--cs-border)] py-3 text-sm leading-5 font-semibold`}
            >
              <span>Image</span>
              <span>File name</span>
              <span>Original size</span>
              <span>Converted size</span>
              <span />
              <span>Format</span>
              <span />
            </div>
            <ul>
              {shown.map((item) => {
                const result = item.result;
                const change = result ? sizeChange(item.file.size, result.blob.size) : "";
                return (
                  <li
                    key={item.id}
                    className={`${ROW} border-b border-[var(--cs-border)] py-3 last:border-b-0`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- a file on the visitor's device */}
                    <img
                      src={item.url}
                      alt=""
                      width={64}
                      height={48}
                      className={`h-12 w-16 max-[1023px]:h-11 max-[1023px]:w-14 ${THUMB}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm leading-5 font-semibold">
                        {result?.name ?? item.file.name}
                      </p>
                      {result ? (
                        <p className={`${TOOL_HINT} tabular-nums`}>
                          <span className="min-[1024px]:hidden">
                            {formatBytes(item.file.size)} → {formatBytes(result.blob.size)} ·{" "}
                          </span>
                          {change} · {result.width} × {result.height}
                          <span className="min-[1024px]:hidden">
                            {" "}
                            · {outputFormat(result.format).label}
                          </span>
                        </p>
                      ) : (
                        <p className={TOOL_ERROR}>{item.error}</p>
                      )}
                    </div>
                    <span className={`${WIDE_ONLY} text-sm leading-5 tabular-nums`}>
                      <span className="sr-only">Original size: </span>
                      {formatBytes(item.file.size)}
                    </span>
                    <span className={`${WIDE_ONLY} text-sm leading-5 tabular-nums`}>
                      <span className="sr-only">Converted size: </span>
                      {result ? formatBytes(result.blob.size) : "–"}
                    </span>
                    <span className={WIDE_ONLY}>
                      {result ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E3F1E4] px-3 py-1 text-sm leading-5 font-semibold text-[#14532D]">
                          <CheckIcon />
                          Converted
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-[#FEF3F2] px-3 py-1 text-sm leading-5 font-semibold text-[#b42318]">
                          Not converted
                        </span>
                      )}
                    </span>
                    <span className={WIDE_ONLY}>
                      {result ? (
                        <span className="inline-flex rounded-full bg-[var(--cs-soft)] px-3 py-1 text-sm leading-5 font-semibold text-[var(--cs-soft-text)]">
                          {outputFormat(result.format).label}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex justify-end gap-2">
                      {result ? (
                        <button
                          type="button"
                          aria-label={`Download ${result.name}`}
                          onClick={() => saveBlob(result.blob, result.name)}
                          className={ICON_BUTTON}
                        >
                          <DownloadIcon />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Remove ${item.file.name}`}
                        onClick={() => removeItem(item.id)}
                        className={ICON_BUTTON}
                      >
                        <CloseIcon />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {converted.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void downloadAll()}
              className={studioButtonClasses("primary")}
            >
              <DownloadIcon />
              {converted.length > 1 ? "Download all (.zip)" : "Download"}
            </button>
            <p className={`${TOOL_HINT} tabular-nums`}>
              {formatBytes(after)} total · {sizeChange(before, after)}
            </p>
          </div>
        ) : null}
        <p role="status" className="sr-only">
          {status}
        </p>
      </div>
    </section>
  );
}
