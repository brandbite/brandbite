// -----------------------------------------------------------------------------
// @file: components/image-tools/social-resizer.tsx
// @purpose: Social resizer: one image in, every chosen social size out, as
//           single files or one zip. Sizes come from the size guide. Runs in
//           the browser; the image is never uploaded.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { CloseIcon, DownloadIcon, UploadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  ColorChoice,
  FilePicker,
  TOOL_ERROR,
  TOOL_FOCUS,
  TOOL_HINT,
  TOOL_LABEL,
  TOOL_PANEL,
  useToolAccess,
} from "@/components/tools/tool-ui";
import { StepHeading } from "@/components/tools/tool-page";
import {
  DEFAULT_CROP,
  hasQuality,
  INPUT_IMAGE_TYPES,
  inputImageProblem,
  outputFormat,
  type CropAdjust,
  type OutputFormat,
} from "@/lib/image-tools/fit";
import { renderImage, saveBlob, zipFiles, type FitMode } from "@/lib/image-tools/render";
import { CropEditor, cropPreviewStyle, SizePreview } from "@/components/image-tools/crop-editor";
import { worthResizing } from "@/lib/image-tools/ai-extend";
import {
  AiExtendError,
  extendWithAi,
  type AiExtendResult,
} from "@/lib/image-tools/ai-extend.client";
import {
  defaultTargetKeys,
  socialFileName,
  socialPlatforms,
  type SocialTarget,
} from "@/lib/image-tools/social-targets";

const PLATFORMS = socialPlatforms();
const ALL_KEYS = PLATFORMS.flatMap((platform) => platform.targets.map((target) => target.key));
const START_PLATFORMS = PLATFORMS.slice(0, 1).map((platform) => platform.slug);
const BACKDROPS = [
  { hex: "#ffffff", name: "White" },
  { hex: "#000000", name: "Black" },
  { hex: "#f3efe6", name: "Cream" },
];

/** JPG and WebP quality for exports: high enough that social platforms' own compression is what you see. */
const QUALITY = 0.92;

const CARD_BUTTON = `flex h-11 shrink-0 items-center justify-center rounded-[10px] border border-[var(--cs-border)] text-sm font-semibold hover:border-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-50 ${TOOL_FOCUS}`;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** One choice out of a few, as rows; the chosen row is lavender. */
function RadioGroup<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  name: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className={TOOL_LABEL}>{label}</legend>
      <div className="mt-2 flex flex-col gap-1">
        {options.map((option) => (
          <label
            key={option.id}
            className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-sm leading-5 font-medium ${
              option.id === value ? "bg-[var(--cs-soft)]" : "hover:bg-[var(--cs-background)]"
            }`}
          >
            <input
              type="radio"
              name={name}
              checked={option.id === value}
              onChange={() => onChange(option.id)}
              className="h-5 w-5 shrink-0 accent-[var(--cs-selected)]"
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint ? <p className={`mt-2 ${TOOL_HINT}`}>{hint}</p> : null}
    </fieldset>
  );
}

export function SocialResizer() {
  const access = useToolAccess();
  const fileInputId = useId();
  const [dragging, setDragging] = useState(false);
  const bitmapRef = useRef<ImageBitmap | null>(null);

  const [source, setSource] = useState<{
    name: string;
    url: string;
    width: number;
    height: number;
    size: number;
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<string[]>(START_PLATFORMS);
  const [selected, setSelected] = useState<string[]>(() =>
    PLATFORMS.filter((p) => START_PLATFORMS.includes(p.slug)).flatMap(defaultTargetKeys),
  );
  const [mode, setMode] = useState<FitMode>("cover");
  const [backdrop, setBackdrop] = useState("#ffffff");
  const [format, setFormat] = useState<OutputFormat>("jpeg");
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  /** The part of the image each size keeps, by size key; the middle when a size has none. */
  const [crops, setCrops] = useState<Record<string, CropAdjust>>({});
  const [editing, setEditing] = useState<string | null>(null);
  /** Sizes the AI laid out again: that picture is used for the size instead of the original. */
  const [aiResults, setAiResults] = useState<Record<string, AiExtendResult>>({});
  const aiResultsRef = useRef(aiResults);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  /** The size whose card is showing the original for comparison, if any. */
  const [showingOriginal, setShowingOriginal] = useState<string | null>(null);
  /** The size being looked at large, if any. */
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    aiResultsRef.current = aiResults;
  }, [aiResults]);

  const dropAiResults = (keys?: string[]) => {
    setAiResults((all) => {
      const next = { ...all };
      for (const key of keys ?? Object.keys(all)) {
        const result = next[key];
        if (!result) continue;
        result.bitmap.close();
        URL.revokeObjectURL(result.url);
        delete next[key];
      }
      return next;
    });
  };
  // Let go of AI pictures when the page is left.
  useEffect(
    () => () => {
      for (const result of Object.values(aiResultsRef.current)) {
        result.bitmap.close();
        URL.revokeObjectURL(result.url);
      }
    },
    [],
  );

  useEffect(
    () => () => {
      bitmapRef.current?.close();
    },
    [],
  );
  // Let go of the preview address when the image is replaced or the page is left.
  useEffect(() => {
    const url = source?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [source?.url]);

  const shownPlatforms = PLATFORMS.filter((platform) => platforms.includes(platform.slug));
  const targets = useMemo<SocialTarget[]>(
    () =>
      PLATFORMS.filter((platform) => platforms.includes(platform.slug))
        .flatMap((platform) => platform.targets)
        .filter((target) => selected.includes(target.key)),
    [platforms, selected],
  );

  const editingTarget = targets.find((target) => target.key === editing) ?? null;
  const viewingTarget = targets.find((target) => target.key === viewing) ?? null;

  const onFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const problem = inputImageProblem(file);
    if (problem) {
      setFileError(problem);
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      bitmapRef.current?.close();
      bitmapRef.current = bitmap;
      setSource({
        name: file.name,
        url: URL.createObjectURL(file),
        width: bitmap.width,
        height: bitmap.height,
        size: file.size,
      });
      setCrops({});
      dropAiResults();
      setAiErrors({});
      setFileError(null);
      setStatus(`${file.name} is ready.`);
    } catch {
      setFileError("We couldn't read that image. Try another file.");
    }
  };

  const removeSource = () => {
    bitmapRef.current?.close();
    bitmapRef.current = null;
    setSource(null);
    setCrops({});
    dropAiResults();
    setAiErrors({});
    setEditing(null);
    setViewing(null);
    setStatus("Image removed.");
  };

  const togglePlatform = (slug: string) => {
    const platform = PLATFORMS.find((p) => p.slug === slug);
    if (!platform) return;
    if (platforms.includes(slug)) {
      setPlatforms(platforms.filter((s) => s !== slug));
      const keys = platform.targets.map((target) => target.key);
      setSelected(selected.filter((key) => !keys.includes(key)));
    } else {
      setPlatforms([...platforms, slug]);
      setSelected([...selected, ...defaultTargetKeys(platform)]);
    }
  };

  const toggleTarget = (key: string) =>
    setSelected(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  /** The picture a size is cut from: its AI-extended one when it has one, else the original. */
  const imageFor = (target: SocialTarget) => {
    const extended = aiResults[target.key];
    if (extended) return extended;
    return source && bitmapRef.current ? { ...source, bitmap: bitmapRef.current } : null;
  };

  const extend = async (target: SocialTarget) => {
    if (!bitmapRef.current || aiBusy) return;
    setAiBusy(target.key);
    setAiErrors((all) => ({ ...all, [target.key]: "" }));
    setStatus(`Resizing ${target.platform} ${target.name} with AI. This can take a minute.`);
    try {
      const result = await extendWithAi(bitmapRef.current, target);
      dropAiResults([target.key]);
      setAiResults((all) => ({ ...all, [target.key]: result }));
      // The extended picture has a new shape, so the old position no longer means the same.
      setCrops((all) => {
        const next = { ...all };
        delete next[target.key];
        return next;
      });
      if (result.remaining !== null) setAiRemaining(result.remaining);
      setStatus(`${target.platform} ${target.name} was resized with AI.`);
    } catch (error) {
      const message =
        error instanceof AiExtendError ? error.message : "AI resize didn't work. Try again.";
      if (error instanceof AiExtendError && error.remaining !== null) {
        setAiRemaining(error.remaining);
      }
      setAiErrors((all) => ({ ...all, [target.key]: message }));
      setStatus(message);
    } finally {
      setAiBusy(null);
    }
  };

  const render = (target: SocialTarget) =>
    renderImage(imageFor(target)!.bitmap, {
      width: target.width,
      height: target.height,
      mode,
      format,
      quality: hasQuality(format) ? QUALITY : 1,
      backdrop: mode === "contain" ? backdrop : null,
      crop: crops[target.key],
    });

  const download = async (list: SocialTarget[]) => {
    if (!bitmapRef.current || list.length === 0) return;
    setBusy(true);
    setExportError(null);
    const { extension } = outputFormat(format);
    try {
      if (list.length === 1) {
        saveBlob(await render(list[0]), socialFileName(list[0], extension));
      } else {
        const files = [];
        for (const target of list) {
          files.push({ name: socialFileName(target, extension), blob: await render(target) });
        }
        saveBlob(await zipFiles(files), "brandbite-social-sizes.zip");
      }
      setStatus(`Downloaded ${list.length} ${list.length === 1 ? "size" : "sizes"}.`);
    } catch (error) {
      console.error("[SocialResizer] export failed", error);
      setExportError(
        error instanceof Error && error.message.includes("format")
          ? "This browser can't save that format. Choose JPG or PNG."
          : "The download didn't work. Try again, or pick fewer sizes.",
      );
    } finally {
      setBusy(false);
    }
  };

  const formatName = format === "png" ? "PNG" : "JPG";

  return (
    <section aria-label="Social resizer" className="flex flex-col gap-8">
      <div>
        <StepHeading
          number={1}
          title="Source"
          hint="Add the image you want to resize for social media."
        />
        <div className={`mt-4 ${TOOL_PANEL} ${source ? "" : "!p-3"}`}>
          {source ? (
            <div className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- a file on the visitor's device */}
              <img
                src={source.url}
                alt=""
                width={72}
                height={72}
                className="h-[72px] w-[72px] shrink-0 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-background)] object-cover"
              />
              <div className="min-w-[160px] flex-1">
                <p className="truncate text-base leading-6 font-semibold">{source.name}</p>
                <p className={`${TOOL_HINT} tabular-nums`}>
                  {source.width} × {source.height} · {formatSize(source.size)}
                </p>
              </div>
              <FilePicker
                label="Replace"
                accept={INPUT_IMAGE_TYPES}
                onFiles={(files) => void onFiles(files)}
              />
              <button
                type="button"
                aria-label={`Remove ${source.name}`}
                onClick={removeSource}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] hover:bg-[var(--cs-background)] ${TOOL_FOCUS}`}
              >
                <CloseIcon />
              </button>
            </div>
          ) : (
            <label
              htmlFor={fileInputId}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void onFiles(Array.from(event.dataTransfer.files));
              }}
              className={`flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-4 py-7 text-center transition-colors focus-within:border-[var(--cs-text)] ${
                dragging
                  ? "border-[var(--cs-selected)] bg-[var(--cs-soft)]"
                  : "border-[#B9B5AE] hover:border-[var(--cs-text)]"
              }`}
            >
              <input
                id={fileInputId}
                type="file"
                accept={INPUT_IMAGE_TYPES.join(",")}
                className="sr-only"
                onChange={(event) => {
                  void onFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
              <span
                aria-hidden
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
              >
                <UploadIcon />
              </span>
              <span className="mt-3 text-base leading-6 font-semibold">
                Drag and drop an image here
              </span>
              <span className={TOOL_HINT}>or click to choose a file</span>
              <span className={`mt-3 ${studioButtonClasses("secondary")}`}>Choose file</span>
              <span className={`mt-3 ${TOOL_HINT}`}>PNG, JPG or WebP, up to 25 MB.</span>
            </label>
          )}
          {fileError ? (
            <p role="alert" className={`mt-3 ${TOOL_ERROR}`}>
              {fileError}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <StepHeading
          number={2}
          title="Choose formats"
          hint="Select the platforms and the sizes you need."
        />
        <div className={`mt-4 ${TOOL_PANEL}`}>
          <fieldset>
            <legend className="sr-only">Platforms</legend>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => {
                const on = platforms.includes(platform.slug);
                return (
                  <button
                    key={platform.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePlatform(platform.slug)}
                    className={`flex h-11 min-w-[120px] flex-1 items-center justify-center rounded-[10px] border px-4 text-sm font-semibold whitespace-nowrap transition-colors ${TOOL_FOCUS} ${
                      on
                        ? "border-[var(--cs-selected)] bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
                        : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]"
                    }`}
                  >
                    {platform.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_300px] gap-8 max-[1023px]:grid-cols-1">
            <div className="flex flex-col gap-4">
              {shownPlatforms.length === 0 ? (
                <p className={TOOL_HINT}>Switch on a platform to see its sizes.</p>
              ) : null}
              {shownPlatforms.map((platform) => (
                <fieldset key={platform.slug}>
                  <legend className={TOOL_LABEL}>{platform.name}</legend>
                  <ul className="mt-1 grid grid-cols-2 gap-x-6 max-[767px]:grid-cols-1">
                    {platform.targets.map((target) => (
                      <li key={target.key}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-5">
                          <input
                            type="checkbox"
                            checked={selected.includes(target.key)}
                            onChange={() => toggleTarget(target.key)}
                            className="h-5 w-5 shrink-0 accent-[var(--cs-selected)]"
                          />
                          <span className="min-w-0">
                            <span className="font-semibold">{target.name}</span>{" "}
                            <span className="text-[var(--cs-muted)] tabular-nums">
                              {target.width} × {target.height}
                              {target.name.includes("(") ? "" : ` (${target.ratio})`}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ))}
            </div>

            <div className="flex flex-col gap-5 min-[1024px]:border-l min-[1024px]:border-[var(--cs-border)] min-[1024px]:pl-8">
              <RadioGroup<FitMode>
                label="Resize method"
                name={`${fileInputId}-mode`}
                options={[
                  { id: "cover", label: "Crop to fill" },
                  { id: "contain", label: "Fit inside" },
                ]}
                value={mode}
                onChange={setMode}
                hint={
                  mode === "cover"
                    ? "Fills each size and cuts the edges evenly."
                    : "Keeps the whole image and fills the rest with a color."
                }
              />
              {mode === "contain" ? (
                <ColorChoice
                  label="Fill color"
                  value={backdrop}
                  onChange={setBackdrop}
                  brandColors={access.brandColors}
                  presets={BACKDROPS}
                />
              ) : null}
              <RadioGroup<OutputFormat>
                label="Output format"
                name={`${fileInputId}-format`}
                options={[
                  { id: "jpeg", label: "JPG" },
                  { id: "png", label: "PNG" },
                ]}
                value={format}
                onChange={setFormat}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <StepHeading
          number={3}
          title="Preview & download"
          hint="Review your resized images, adjust the crop, and download them one by one or all at once."
        />
        <div className="mt-4 flex flex-wrap items-stretch gap-3">
          {mode === "cover" ? (
            <p className="flex min-w-[280px] flex-1 flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-[var(--cs-soft)] px-4 py-2.5 text-sm leading-5 text-[var(--cs-soft-text)]">
              <span className="flex items-center gap-2 font-semibold">
                <svg
                  aria-hidden
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <path d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" />
                </svg>
                Resize with AI
                {access.aiExtend ? null : (
                  <span className="rounded-full bg-[var(--cs-surface)] px-2.5 py-0.5 text-xs leading-5 font-semibold">
                    Plan
                  </span>
                )}
              </span>
              <span className="min-w-[200px] flex-1">
                {access.aiExtend ? (
                  <>
                    Lays your design out again for a size instead of cutting it. The AI redraws the
                    picture, so check text, faces and logos.{" "}
                    <span className="font-semibold tabular-nums">
                      {aiRemaining ?? access.aiExtendDailyLimit} of {access.aiExtendDailyLimit} left
                    </span>{" "}
                    in this 24 hours for your company.
                  </>
                ) : (
                  <>
                    Lays your design out again for each shape instead of cutting it. Included with
                    every brandbite plan.
                    {access.signedIn ? null : (
                      <>
                        {" "}
                        <Link href="/login" className="font-semibold underline">
                          Sign in
                        </Link>{" "}
                        if you have one.
                      </>
                    )}
                  </>
                )}
              </span>
            </p>
          ) : (
            <span className="flex-1" />
          )}
          <button
            type="button"
            disabled={!source || targets.length === 0 || busy}
            onClick={() => void download(targets)}
            className={`${studioButtonClasses("primary")} !h-auto !min-h-12 !px-6`}
          >
            <DownloadIcon />
            {busy
              ? "Preparing…"
              : targets.length > 1
                ? `Download ${targets.length} sizes (ZIP)`
                : `Download ${formatName}`}
          </button>
        </div>
        {exportError ? (
          <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
            {exportError}
          </p>
        ) : null}
        <p role="status" className="sr-only">
          {status}
        </p>

        {targets.length > 0 ? (
          <ul className="mt-4 grid grid-cols-3 gap-4 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
            {targets.map((target) => (
              <li key={target.key} className={`${TOOL_PANEL} flex flex-col gap-3 !p-4`}>
                <div>
                  <p className="truncate text-base leading-6 font-semibold">
                    {target.name}
                    {target.name.includes("(") ? "" : ` (${target.ratio})`}
                  </p>
                  <p className={`${TOOL_HINT} tabular-nums`}>
                    {target.platform} · {target.width} × {target.height}
                    {aiResults[target.key] ? " · AI resized" : ""}
                  </p>
                </div>
                <div className="flex h-56 items-center justify-center rounded-xl bg-[var(--cs-background)] p-2">
                  <button
                    type="button"
                    disabled={!source}
                    aria-label={`View ${target.platform} ${target.name} larger`}
                    onClick={() => setViewing(target.key)}
                    className={`relative block max-h-full max-w-full overflow-hidden rounded-md border border-[var(--cs-border)] p-0 enabled:cursor-zoom-in ${TOOL_FOCUS}`}
                    style={{
                      aspectRatio: `${target.width} / ${target.height}`,
                      height: target.height >= target.width ? "100%" : undefined,
                      width: target.width > target.height ? "100%" : undefined,
                      background: mode === "contain" ? backdrop : undefined,
                    }}
                  >
                    {source && mode === "cover" ? (
                      <div
                        aria-hidden
                        className="h-full w-full"
                        style={cropPreviewStyle(
                          (showingOriginal === target.key
                            ? source
                            : (aiResults[target.key] ?? source)
                          ).url,
                          showingOriginal === target.key
                            ? source
                            : (aiResults[target.key] ?? source),
                          target,
                          // The original is shown as it would be cut without AI: from the middle.
                          showingOriginal === target.key
                            ? DEFAULT_CROP
                            : (crops[target.key] ?? DEFAULT_CROP),
                        )}
                      />
                    ) : source ? (
                      // A local preview of the visitor's own file.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={source.url} alt="" className="h-full w-full object-contain" />
                    ) : null}
                    {mode === "cover" && aiResults[target.key] ? (
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-[var(--cs-text)] px-2 py-0.5 text-[11px] leading-4 font-semibold text-[var(--cs-surface)]">
                        {showingOriginal === target.key ? "Without AI" : "AI resized"}
                      </span>
                    ) : null}
                  </button>
                </div>
                <div className="flex gap-2">
                  {mode === "cover" ? (
                    <button
                      type="button"
                      disabled={!source}
                      aria-label={`Adjust the crop of ${target.platform} ${target.name}`}
                      onClick={() => setEditing(target.key)}
                      className={`${CARD_BUTTON} flex-1 gap-2 px-3`}
                    >
                      <svg
                        aria-hidden
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 3v14h14M3 7h14v14" />
                      </svg>
                      Adjust crop
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={!source || busy}
                    aria-label={`Download ${target.platform} ${target.name}`}
                    onClick={() => void download([target])}
                    className={`${CARD_BUTTON} ${mode === "cover" ? "w-11" : "flex-1 gap-2 px-3"}`}
                  >
                    <DownloadIcon />
                    {mode === "cover" ? null : "Download"}
                  </button>
                </div>
                {mode === "cover" && access.aiExtend && source ? (
                  aiResults[target.key] ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm leading-5 text-[#256b3a]">
                        Resized with AI. Click the picture to see it large, and check the text and
                        faces.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          aria-pressed={showingOriginal === target.key}
                          onClick={() =>
                            setShowingOriginal(showingOriginal === target.key ? null : target.key)
                          }
                          className={`${studioButtonClasses("secondary")} flex-1`}
                        >
                          {showingOriginal === target.key ? "Show AI version" : "Compare"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            dropAiResults([target.key]);
                            setShowingOriginal(null);
                            setStatus(`AI version removed from ${target.platform} ${target.name}.`);
                          }}
                          className={`${studioButtonClasses("secondary")} flex-1`}
                        >
                          Undo
                        </button>
                      </div>
                    </div>
                  ) : worthResizing(source.width, source.height, target.width, target.height) ? (
                    <button
                      type="button"
                      disabled={aiBusy !== null || aiRemaining === 0}
                      onClick={() => void extend(target)}
                      className={`${studioButtonClasses("secondary")} w-full`}
                    >
                      {aiBusy === target.key ? "Resizing… up to a minute" : "Resize with AI"}
                    </button>
                  ) : null
                ) : null}
                {aiErrors[target.key] ? (
                  <p role="alert" className={TOOL_ERROR}>
                    {aiErrors[target.key]}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className={`mt-4 ${TOOL_PANEL} ${TOOL_HINT}`}>
            Switch on a platform and tick the sizes you need.
          </p>
        )}
        {source ? null : targets.length > 0 ? (
          <p className={`mt-3 ${TOOL_HINT}`}>Add an image to see it in every size.</p>
        ) : null}
      </div>

      {source && viewingTarget ? (
        <SizePreview
          key={`view-${viewingTarget.key}`}
          title={`${viewingTarget.platform} · ${viewingTarget.name}`}
          note={`${viewingTarget.width} × ${viewingTarget.height}${
            aiResults[viewingTarget.key] ? " · resized with AI" : ""
          }`}
          target={viewingTarget}
          frameStyle={
            mode === "cover"
              ? cropPreviewStyle(
                  (aiResults[viewingTarget.key] ?? source).url,
                  aiResults[viewingTarget.key] ?? source,
                  viewingTarget,
                  crops[viewingTarget.key] ?? DEFAULT_CROP,
                )
              : { background: backdrop }
          }
          actions={
            <>
              {mode === "cover" ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(viewingTarget.key);
                    setViewing(null);
                  }}
                  className={studioButtonClasses("secondary")}
                >
                  Adjust the crop
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void download([viewingTarget])}
                className={studioButtonClasses("secondary")}
              >
                <DownloadIcon />
                Download
              </button>
            </>
          }
          onClose={() => setViewing(null)}
        >
          {mode === "contain" ? (
            // A local preview of the visitor's own file.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={source.url} alt="" className="h-full w-full object-contain" />
          ) : null}
        </SizePreview>
      ) : null}

      {source && editingTarget ? (
        <CropEditor
          key={editingTarget.key}
          title={`${editingTarget.platform} · ${editingTarget.name}`}
          url={(aiResults[editingTarget.key] ?? source).url}
          source={aiResults[editingTarget.key] ?? source}
          target={editingTarget}
          value={crops[editingTarget.key] ?? DEFAULT_CROP}
          onChange={(crop) => setCrops((all) => ({ ...all, [editingTarget.key]: crop }))}
          onApplyToAll={() => {
            const crop = crops[editingTarget.key] ?? DEFAULT_CROP;
            setCrops(Object.fromEntries(ALL_KEYS.map((key) => [key, crop])));
            setStatus("This position is now used for every size.");
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}
