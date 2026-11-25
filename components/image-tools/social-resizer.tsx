// -----------------------------------------------------------------------------
// @file: components/image-tools/social-resizer.tsx
// @purpose: Social resizer: one image in, every chosen social size out, as
//           single files or one zip. Sizes come from the size guide. Runs in
//           the browser; the image is never uploaded.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { DownloadIcon, UploadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  ColorChoice,
  FilePicker,
  Segmented,
  ToggleGroup,
  TOOL_ERROR,
  TOOL_FOCUS,
  TOOL_HINT,
  TOOL_LABEL,
  TOOL_PANEL,
  useToolAccess,
} from "@/components/tools/tool-ui";
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

export function SocialResizer() {
  const access = useToolAccess();
  const bitmapRef = useRef<ImageBitmap | null>(null);

  const [source, setSource] = useState<{
    name: string;
    url: string;
    width: number;
    height: number;
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

  return (
    <section
      aria-label="Social resizer"
      className="grid grid-cols-[360px_minmax(0,1fr)] gap-6 max-[1023px]:grid-cols-1"
    >
      <div className={`flex flex-col gap-6 ${TOOL_PANEL}`}>
        <div>
          <p className={TOOL_LABEL}>Image</p>
          <div className="mt-2">
            <FilePicker
              label={source ? "Change image" : "Choose an image"}
              accept={INPUT_IMAGE_TYPES}
              onFiles={(files) => void onFiles(files)}
            >
              <UploadIcon />
            </FilePicker>
          </div>
          <p className={`mt-2 ${TOOL_HINT}`}>
            {source
              ? `${source.name} · ${source.width} × ${source.height}`
              : "PNG, JPG or WebP, up to 25 MB. It stays in your browser."}
          </p>
          {fileError ? (
            <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
              {fileError}
            </p>
          ) : null}
        </div>

        <ToggleGroup
          label="Platforms"
          options={PLATFORMS.map((platform) => ({ id: platform.slug, label: platform.name }))}
          values={platforms}
          onToggle={togglePlatform}
        />

        {shownPlatforms.map((platform) => (
          <fieldset key={platform.slug}>
            <legend className={TOOL_LABEL}>{platform.name} sizes</legend>
            <ul className="mt-1">
              {platform.targets.map((target) => (
                <li key={target.key}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-5">
                    <input
                      type="checkbox"
                      checked={selected.includes(target.key)}
                      onChange={() => toggleTarget(target.key)}
                      className="h-5 w-5 shrink-0 accent-[var(--cs-text)]"
                    />
                    <span className="min-w-0 flex-1">{target.name}</span>
                    <span className="shrink-0 text-[var(--cs-muted)] tabular-nums">
                      {target.width} × {target.height}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}

        <div>
          <Segmented<FitMode>
            label="When the shape doesn't match"
            options={[
              { id: "cover", label: "Crop to fill" },
              { id: "contain", label: "Fit inside" },
            ]}
            value={mode}
            onChange={setMode}
          />
          <p className={`mt-2 ${TOOL_HINT}`}>
            {mode === "cover"
              ? "Fills each size and cuts the edges evenly."
              : "Keeps the whole image and fills the rest with a color."}
          </p>
        </div>

        {mode === "contain" ? (
          <ColorChoice
            label="Fill color"
            value={backdrop}
            onChange={setBackdrop}
            brandColors={access.brandColors}
            presets={BACKDROPS}
          />
        ) : null}

        <Segmented<OutputFormat>
          label="File type"
          options={[
            { id: "jpeg", label: "JPG" },
            { id: "png", label: "PNG" },
          ]}
          value={format}
          onChange={setFormat}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className={TOOL_PANEL}>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!source || targets.length === 0 || busy}
              onClick={() => void download(targets)}
              className={studioButtonClasses("primary")}
            >
              <DownloadIcon />
              {busy
                ? "Preparing…"
                : targets.length > 1
                  ? `Download ${targets.length} sizes (.zip)`
                  : "Download"}
            </button>
            <p className={`min-w-[180px] flex-1 ${TOOL_HINT}`}>
              {!source
                ? "Choose an image to see it in every size."
                : targets.length === 0
                  ? "Tick at least one size."
                  : mode === "cover"
                    ? "Press Adjust on a size to choose what it keeps."
                    : "Or download one size from its card below."}
            </p>
          </div>
          {exportError ? (
            <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
              {exportError}
            </p>
          ) : null}
          <p role="status" className="sr-only">
            {status}
          </p>
          {mode === "cover" ? (
            <p className={`mt-3 border-t border-[var(--cs-border)] pt-3 ${TOOL_HINT}`}>
              {access.aiExtend ? (
                <>
                  <span className="font-semibold text-[var(--cs-text)]">Resize with AI</span> lays
                  your design out again for the shape of a size instead of cutting it. The AI
                  redraws the picture, so read the text and look at faces and logos before you post
                  it. {aiRemaining ?? access.aiExtendDailyLimit} of {access.aiExtendDailyLimit} left
                  in this 24 hours for your company.
                </>
              ) : (
                <>
                  <span className="font-semibold text-[var(--cs-text)]">Resize with AI</span>, which
                  lays your design out again for each shape instead of cutting it, is included with
                  every brandbite plan.
                  {access.signedIn ? null : (
                    <>
                      {" "}
                      <Link href="/login" className="font-semibold text-[var(--cs-text)] underline">
                        Sign in
                      </Link>{" "}
                      if you have one.
                    </>
                  )}
                </>
              )}
            </p>
          ) : null}
        </div>

        {targets.length > 0 ? (
          <ul className="grid grid-cols-3 gap-4 max-[1279px]:grid-cols-2 max-[639px]:grid-cols-1">
            {targets.map((target) => (
              <li key={target.key} className={`${TOOL_PANEL} flex flex-col gap-3 !p-4`}>
                <div className="flex h-44 items-center justify-center rounded-xl bg-[var(--cs-background)] p-2">
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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm leading-5 font-semibold">{target.name}</p>
                    <p className={`${TOOL_HINT} tabular-nums`}>
                      {target.platform} · {target.width} × {target.height}
                      {aiResults[target.key] ? " · AI resized" : ""}
                    </p>
                  </div>
                  {mode === "cover" ? (
                    <button
                      type="button"
                      disabled={!source}
                      aria-label={`Adjust the crop of ${target.platform} ${target.name}`}
                      onClick={() => setEditing(target.key)}
                      className={`flex h-11 shrink-0 items-center justify-center rounded-[10px] border border-[var(--cs-border)] px-3 text-sm font-semibold hover:border-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-50 ${TOOL_FOCUS}`}
                    >
                      Adjust
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={!source || busy}
                    aria-label={`Download ${target.platform} ${target.name}`}
                    onClick={() => void download([target])}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[var(--cs-border)] hover:border-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-50 ${TOOL_FOCUS}`}
                  >
                    <DownloadIcon />
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
          <p className={`${TOOL_PANEL} ${TOOL_HINT}`}>
            Switch on a platform and tick the sizes you need.
          </p>
        )}
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
