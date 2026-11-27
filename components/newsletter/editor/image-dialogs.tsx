// -----------------------------------------------------------------------------
// @file: components/newsletter/editor/image-dialogs.tsx
// @purpose: The two windows behind a picture field in the newsletter editor,
//           for customers who can upload: cutting a chosen picture to a shape
//           before it is uploaded, and picking one of the pictures the
//           company uploaded before.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useRef, useState } from "react";

import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { cropPreviewStyle } from "@/components/image-tools/crop-editor";
import { TOOL_ERROR, TOOL_FOCUS, TOOL_HINT } from "@/components/tools/tool-ui";
import { DEFAULT_CROP, MAX_CROP_ZOOM, panCrop, type CropAdjust } from "@/lib/image-tools/fit";
import { NEWSLETTER_IMAGE_SHAPES, type NewsletterImageShape } from "@/lib/newsletter/images";
import { uploadNewsletterImage, type NewsletterLibraryImage } from "@/lib/newsletter/upload.client";

const DIALOG =
  "m-auto w-[min(94vw,720px)] rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-0 text-[var(--cs-text)] backdrop:bg-black/50";

/** Opens a native dialog as soon as it is drawn; the browser keeps focus inside it and closes it on Escape. */
function useOpenDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return ref;
}

/**
 * Cut a picture before it is uploaded: choose a shape, drag the picture
 * inside the frame, zoom in. GIFs are uploaded as they are, because cutting
 * one would lose its animation.
 */
export function ImageCropDialog({
  file,
  onUploaded,
  onClose,
}: {
  file: File;
  onUploaded: (url: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useOpenDialog();
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; crop: CropAdjust } | null>(null);
  const titleId = useId();
  const zoomId = useId();
  const [picture, setPicture] = useState<{ url: string; width: number; height: number } | null>(
    null,
  );
  const [shape, setShape] = useState<NewsletterImageShape["id"]>("original");
  const [crop, setCrop] = useState<CropAdjust>(DEFAULT_CROP);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const animated = file.type === "image/gif";

  // Read the picture's size, and show it from the device until it is uploaded.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    let live = true;
    createImageBitmap(file)
      .then((bitmap) => {
        if (live) setPicture({ url, width: bitmap.width, height: bitmap.height });
        bitmap.close();
      })
      .catch(() => {
        if (live) setFailure("That file couldn't be read as an image.");
      });
    return () => {
      live = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const ratio =
    NEWSLETTER_IMAGE_SHAPES.find((option) => option.id === shape)?.ratio ??
    (picture ? picture.width / picture.height : 1);
  const target = { width: 1000, height: Math.round(1000 / ratio) };

  const upload = async () => {
    setBusy(true);
    setFailure(null);
    try {
      onUploaded(await uploadNewsletterImage(file, animated ? undefined : { ratio, crop }));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "The upload didn't go through.");
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dimmed area around the box closes it.
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      className={DIALOG}
    >
      <div className="flex flex-col gap-4 p-6 max-[767px]:p-5">
        <div>
          <h2 id={titleId} className="text-lg leading-7 font-semibold">
            Prepare the picture
          </h2>
          <p className={TOOL_HINT}>
            {animated
              ? "A GIF is uploaded as it is, so it keeps moving."
              : "Choose a shape, then drag the picture to choose what stays in the frame."}
          </p>
        </div>

        {!animated ? (
          <div role="group" aria-label="Shape" className="flex flex-wrap gap-2">
            {NEWSLETTER_IMAGE_SHAPES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={shape === option.id}
                onClick={() => {
                  setShape(option.id);
                  setCrop(DEFAULT_CROP);
                }}
                className={`flex min-h-10 items-center rounded-full border px-4 text-sm font-medium ${TOOL_FOCUS} ${
                  shape === option.id
                    ? "border-[var(--cs-text)] bg-[var(--cs-text)] text-[var(--cs-surface)]"
                    : "border-[var(--cs-border)] hover:border-[var(--cs-text)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex justify-center rounded-xl bg-[#eeece8] p-3">
          {picture ? (
            <div
              ref={frameRef}
              role="img"
              aria-label="The part of the picture that will be uploaded"
              onPointerDown={(event) => {
                if (animated) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { x: event.clientX, y: event.clientY, crop };
              }}
              onPointerMove={(event) => {
                const start = drag.current;
                const frame = frameRef.current;
                if (!start || !frame) return;
                const box = frame.getBoundingClientRect();
                setCrop(
                  panCrop(
                    picture.width,
                    picture.height,
                    target.width,
                    target.height,
                    start.crop,
                    (event.clientX - start.x) / box.width,
                    (event.clientY - start.y) / box.height,
                  ),
                );
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              className={`max-h-[46vh] w-full touch-none rounded-lg ${animated ? "" : "cursor-grab active:cursor-grabbing"}`}
              style={{
                aspectRatio: `${target.width} / ${target.height}`,
                maxWidth: `calc(46vh * ${target.width / target.height})`,
                ...cropPreviewStyle(picture.url, picture, target, animated ? DEFAULT_CROP : crop),
              }}
            />
          ) : (
            <p className={`py-16 ${TOOL_HINT}`}>{failure ? "" : "Reading the picture…"}</p>
          )}
        </div>

        {!animated ? (
          <div>
            <label htmlFor={zoomId} className="text-sm leading-5 font-semibold">
              Zoom
            </label>
            <input
              id={zoomId}
              type="range"
              min={1}
              max={MAX_CROP_ZOOM}
              step={0.05}
              value={crop.zoom}
              onChange={(event) => setCrop({ ...crop, zoom: Number(event.target.value) })}
              className="mt-1 h-6 w-full accent-[var(--cs-text)]"
            />
          </div>
        ) : null}

        <p role="alert" className={`${TOOL_ERROR} empty:hidden`}>
          {failure ?? ""}
        </p>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={studioButtonClasses("secondary")}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!picture || busy}
            onClick={() => void upload()}
            className={studioButtonClasses("primary")}
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Pick one of the pictures the company uploaded for its newsletters before. */
export function ImageLibraryDialog({
  onPick,
  onClose,
}: {
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useOpenDialog();
  const titleId = useId();
  const [images, setImages] = useState<NewsletterLibraryImage[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/tools/newsletter-image", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as {
          images?: NewsletterLibraryImage[];
          error?: string;
        } | null;
        if (!live) return;
        if (res.ok && body?.images) setImages(body.images);
        else setFailure(body?.error ?? "Your pictures couldn't be loaded.");
      })
      .catch(() => {
        if (live) setFailure("Your pictures couldn't be loaded. Check your connection.");
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      className={DIALOG}
    >
      <div className="flex max-h-[84vh] flex-col gap-4 p-6 max-[767px]:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg leading-7 font-semibold">
              Your pictures
            </h2>
            <p className={TOOL_HINT}>
              Everything your company uploaded for its newsletters, newest first.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={studioButtonClasses("secondary")}
          >
            Close
          </button>
        </div>

        <p role="alert" className={`${TOOL_ERROR} empty:hidden`}>
          {failure ?? ""}
        </p>
        {images === null && !failure ? <p className={TOOL_HINT}>Loading…</p> : null}
        {images && !images.length ? (
          <p className={TOOL_HINT}>
            Nothing here yet. Pictures you upload in the editor are kept here to use again.
          </p>
        ) : null}
        {images?.length ? (
          <ul className="grid min-h-0 grid-cols-4 gap-3 overflow-y-auto pr-1 max-[639px]:grid-cols-2">
            {images.map((image) => (
              <li key={image.url}>
                <button
                  type="button"
                  aria-label={`Use the picture uploaded ${new Date(image.uploadedAt).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}`}
                  onClick={() => {
                    onPick(image.url);
                    dialogRef.current?.close();
                  }}
                  className={`block aspect-[4/3] w-full overflow-hidden rounded-lg border border-[var(--cs-border)] bg-[#eeece8] hover:border-[var(--cs-text)] ${TOOL_FOCUS}`}
                >
                  {/* A customer's own upload on the public asset domain; its size isn't known ahead. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </dialog>
  );
}
