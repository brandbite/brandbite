// -----------------------------------------------------------------------------
// @file: components/colors/studio/image-palette-view.tsx
// @purpose: Pull a starting palette from an image, entirely in the browser: the
//           image is never uploaded or stored. Colors can then be assigned to
//           roles, previewed, saved or moved into the generator.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useRef, useState } from "react";

import {
  analyzeImage,
  checkImageFile,
  createStudioPalette,
  formatHex,
  IMAGE_ACCEPT,
  MAX_IMAGE_COLORS,
  MIN_IMAGE_COLORS,
  studioPaletteToCss,
  type ColorLocation,
  type StudioPalette,
} from "@/lib/colors";

import { usePaletteOpener } from "./open-palette";
import { PalettePreview } from "./palette-preview";
import { RoleFields, SavePaletteAction } from "./palette-parts";
import { StudioButton } from "./studio-button";
import { WorkspacePanel } from "./studio-shell";
import { StudioSwatch } from "./studio-swatch";
import { useSavedPalettes } from "./use-saved-palettes";
import { useStudioCopy } from "./use-studio-copy";

const FILE_ERRORS = {
  type: "That file type isn't supported. Use a JPG, PNG or WEBP image.",
  size: "That image is over 10 MB. Choose a smaller file.",
  decode: "That file couldn't be read as an image. It may be damaged.",
  empty: "No visible colors were found in that image.",
};

type LoadedImage = { file: File; url: string };

export function ImagePaletteView() {
  const store = useSavedPalettes();
  const { copy } = useStudioCopy();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  const [image, setImage] = useState<LoadedImage | null>(null);
  const [colorCount, setColorCount] = useState(5);
  const [palette, setPalette] = useState<StudioPalette | null>(null);
  const [locations, setLocations] = useState<ColorLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const imageUrl = image?.url;
  useEffect(() => {
    if (!imageUrl) return;
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const analyze = async (file: File, count: number) => {
    const request = ++requestRef.current;
    setBusy(true);
    setError(null);
    try {
      const result = await analyzeImage(file, count);
      if (request !== requestRef.current) return false;
      if (result.palette.length === 0) {
        setError(FILE_ERRORS.empty);
        return false;
      }
      setPalette(
        createStudioPalette({
          name: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Image palette",
          hexes: result.palette.map((c) => c.hex),
          sourceTool: "image",
        }),
      );
      setLocations(result.locations);
      return true;
    } catch {
      if (request === requestRef.current) setError(FILE_ERRORS.decode);
      return false;
    } finally {
      if (request === requestRef.current) setBusy(false);
    }
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkImageFile(file);
    if (problem) {
      setError(FILE_ERRORS[problem]);
      return;
    }
    if (await analyze(file, colorCount)) {
      setImage({ file, url: URL.createObjectURL(file) });
    }
  };

  const changeCount = (next: number) => {
    setColorCount(next);
    if (image) void analyze(image.file, next);
  };

  const remove = () => {
    requestRef.current++;
    setImage(null);
    setPalette(null);
    setLocations([]);
    setError(null);
    setBusy(false);
  };

  const opener = usePaletteOpener(async (active) => (await store.save(active)).ok);

  return (
    <>
      <WorkspacePanel>
        {image ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm leading-5 font-semibold">
              {image.file.name}
            </span>
            <StudioButton variant="secondary" onClick={() => inputRef.current?.click()}>
              Replace image
            </StudioButton>
            <StudioButton variant="secondary" onClick={remove}>
              Remove
            </StudioButton>
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT.join(",")}
          aria-label="Image file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            void chooseFile(file);
          }}
        />

        <div
          className={`grid gap-6 ${image ? "grid-cols-[minmax(0,3fr)_minmax(0,2fr)] max-[1023px]:grid-cols-1" : "grid-cols-1"}`}
        >
          {image ? (
            <div className="relative self-start overflow-hidden rounded-2xl">
              {/* A local object URL, which next/image can't optimize. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={`Preview of ${image.file.name}`} className="block w-full" />
              {locations.map((location, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[var(--cs-text)] text-sm leading-5 font-semibold text-white"
                  style={{ left: `${location.x * 100}%`, top: `${location.y * 100}%` }}
                >
                  {index + 1}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex min-w-0 flex-col gap-4">
            {!image ? (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void chooseFile(event.dataTransfer.files?.[0]);
                }}
                className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center ${
                  dragging
                    ? "border-[var(--cs-text)] bg-[var(--cs-soft)]"
                    : "border-[var(--cs-border)]"
                }`}
              >
                <p className="text-lg leading-[26px] font-semibold">Drop an image here</p>
                <p className="text-sm leading-5 text-[var(--cs-muted)]">
                  JPG, PNG or WEBP, up to 10 MB.
                </p>
                <StudioButton loading={busy} onClick={() => inputRef.current?.click()}>
                  Choose a file
                </StudioButton>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm leading-5 text-[var(--cs-danger)]">
                {error}
              </p>
            ) : null}

            <p className="text-sm leading-5 text-[var(--cs-muted)]">
              Images are processed in your browser and are never uploaded.
            </p>

            <div className="flex items-center justify-between gap-3">
              <span id="palette-size" className="text-sm leading-5 font-medium">
                Palette size
              </span>
              <div role="group" aria-labelledby="palette-size" className="flex items-center gap-1">
                <StudioButton
                  variant="secondary"
                  aria-label="Fewer colors"
                  disabled={colorCount <= MIN_IMAGE_COLORS || busy}
                  onClick={() => changeCount(colorCount - 1)}
                >
                  −
                </StudioButton>
                <span
                  aria-live="polite"
                  className="w-8 text-center text-sm leading-5 font-semibold"
                >
                  {colorCount}
                </span>
                <StudioButton
                  variant="secondary"
                  aria-label="More colors"
                  disabled={colorCount >= MAX_IMAGE_COLORS || busy}
                  onClick={() => changeCount(colorCount + 1)}
                >
                  +
                </StudioButton>
              </div>
            </div>
          </div>
        </div>

        {palette ? (
          <>
            <ul className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              {palette.colors.map((color, index) => (
                <li key={color.id} className="min-w-0">
                  <p className="mb-1 text-sm leading-5 font-semibold">{index + 1}</p>
                  <StudioSwatch hex={color.hex} />
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm leading-5 text-[var(--cs-muted)]">
              Extracted colors are a starting point. Check contrast before using them for text.
            </p>
          </>
        ) : null}
      </WorkspacePanel>

      {palette ? (
        <>
          <div className="grid grid-cols-2 gap-6 max-[1023px]:grid-cols-1">
            <WorkspacePanel>
              <h2 className="text-2xl leading-8 font-semibold">Assign color roles</h2>
              <p className="mt-1 mb-4 text-sm leading-5 text-[var(--cs-muted)]">
                Map the extracted colors to common design roles.
              </p>
              <RoleFields palette={palette} onChange={setPalette} />
            </WorkspacePanel>
            <WorkspacePanel>
              <h2 className="text-2xl leading-8 font-semibold">Preview</h2>
              <p className="mt-1 mb-4 text-sm leading-5 text-[var(--cs-muted)]">
                See how your roles work together in a simple UI.
              </p>
              <PalettePreview palette={palette} />
            </WorkspacePanel>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StudioButton
              variant="secondary"
              onClick={() =>
                void copy(
                  palette.colors.map((c) => formatHex(c.hex)).join(", "),
                  "hex-list",
                  "all HEX values",
                )
              }
            >
              Copy HEX
            </StudioButton>
            <StudioButton
              variant="secondary"
              onClick={() => void copy(studioPaletteToCss(palette), "css", "CSS variables")}
            >
              Copy CSS
            </StudioButton>
            <StudioButton
              variant="secondary"
              onClick={() => opener.requestOpen(palette, "/colors/contrast-checker")}
            >
              Check contrast
            </StudioButton>
            <SavePaletteAction palette={palette} store={store} onSaved={setPalette} />
            <div className="ml-auto max-[479px]:ml-0">
              <StudioButton
                onClick={() => opener.requestOpen(palette, "/colors/color-palette-generator")}
              >
                Edit in generator
              </StudioButton>
            </div>
          </div>
        </>
      ) : null}
      {opener.dialog}
    </>
  );
}
