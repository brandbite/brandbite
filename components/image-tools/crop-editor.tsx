// -----------------------------------------------------------------------------
// @file: components/image-tools/crop-editor.tsx
// @purpose: Choose which part of an image a size keeps: drag the image inside
//           the frame, zoom in, or nudge it with the arrow keys. Used by the
//           social resizer for one size at a time.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useRef, useState } from "react";

import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { TOOL_FOCUS, TOOL_HINT, TOOL_LABEL } from "@/components/tools/tool-ui";
import {
  cropBackground,
  DEFAULT_CROP,
  MAX_CROP_ZOOM,
  panCrop,
  type CropAdjust,
} from "@/lib/image-tools/fit";

/** CSS that shows exactly the part of the image a crop keeps. */
export function cropPreviewStyle(
  url: string,
  source: { width: number; height: number },
  target: { width: number; height: number },
  crop: CropAdjust,
) {
  const background = cropBackground(source.width, source.height, target.width, target.height, crop);
  return {
    backgroundImage: `url("${url}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${background.sizeX}% ${background.sizeY}%`,
    backgroundPosition: `${background.positionX}% ${background.positionY}%`,
  };
}

export function CropEditor({
  title,
  url,
  source,
  target,
  value,
  onChange,
  onApplyToAll,
  onClose,
}: {
  title: string;
  url: string;
  source: { width: number; height: number };
  target: { width: number; height: number };
  value: CropAdjust;
  onChange: (crop: CropAdjust) => void;
  /** Use this position and zoom for every size. */
  onApplyToAll: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; crop: CropAdjust } | null>(null);
  const zoomId = useId();
  const titleId = useId();
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  /** Move the image by a share of the frame's width and height. */
  const moveBy = (from: CropAdjust, dx: number, dy: number) =>
    onChange(panCrop(source.width, source.height, target.width, target.height, from, dx, dy));

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, crop: value };
    setDragging(true);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const frame = frameRef.current;
    if (!start || !frame) return;
    const box = frame.getBoundingClientRect();
    moveBy(
      start.crop,
      (event.clientX - start.x) / box.width,
      (event.clientY - start.y) / box.height,
    );
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    moveBy(value, move[0], move[1]);
  };

  const wide = target.width >= target.height;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dimmed area around the box closes it.
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-auto w-[min(92vw,640px)] rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-0 text-[var(--cs-text)] backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-4 p-6 max-[767px]:p-5">
        <div>
          <h2 id={titleId} className="text-lg leading-7 font-semibold">
            {title}
          </h2>
          <p className={TOOL_HINT}>
            Drag the image to choose what stays in the frame. Arrow keys nudge it.
          </p>
        </div>

        <div className="flex justify-center rounded-xl bg-[var(--cs-background)] p-3">
          <div
            ref={frameRef}
            role="img"
            tabIndex={0}
            aria-label={`${title}: the part of the image that will be kept. Use the arrow keys to move it.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            className={`touch-none rounded-md border border-[var(--cs-border)] ${dragging ? "cursor-grabbing" : "cursor-grab"} ${TOOL_FOCUS}`}
            style={{
              aspectRatio: `${target.width} / ${target.height}`,
              width: wide ? "100%" : undefined,
              height: wide ? undefined : "min(60vh, 460px)",
              maxWidth: "100%",
              ...cropPreviewStyle(url, source, target, value),
            }}
          />
        </div>

        <div>
          <label htmlFor={zoomId} className={TOOL_LABEL}>
            Zoom: {value.zoom.toFixed(1)}×
          </label>
          <input
            id={zoomId}
            type="range"
            min={1}
            max={MAX_CROP_ZOOM}
            step={0.05}
            value={value.zoom}
            onChange={(event) => onChange({ ...value, zoom: Number(event.target.value) })}
            className="mt-2 h-6 w-full accent-[var(--cs-text)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={studioButtonClasses("primary")}
          >
            Done
          </button>
          <button type="button" onClick={onApplyToAll} className={studioButtonClasses("secondary")}>
            Use for every size
          </button>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_CROP)}
            className={studioButtonClasses("tertiary")}
          >
            Reset
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** A size at a comfortable viewing scale: what the download will look like. */
export function SizePreview({
  title,
  note,
  target,
  frameStyle,
  children,
  actions,
  onClose,
}: {
  title: string;
  note?: string;
  target: { width: number; height: number };
  /** Paints the frame itself (a crop, or a fill color behind `children`). */
  frameStyle: React.CSSProperties;
  /** Shown inside the frame, e.g. the whole image when it is fitted rather than cropped. */
  children?: React.ReactNode;
  actions?: React.ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const wide = target.width >= target.height;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-auto w-[min(94vw,880px)] rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-0 text-[var(--cs-text)] backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4 p-6 max-[767px]:p-5">
        <div>
          <h2 id={titleId} className="text-lg leading-7 font-semibold">
            {title}
          </h2>
          {note ? <p className={TOOL_HINT}>{note}</p> : null}
        </div>
        <div className="flex justify-center rounded-xl bg-[var(--cs-background)] p-3">
          <div
            role="img"
            aria-label={`${title}, as it will be downloaded`}
            className="overflow-hidden rounded-md border border-[var(--cs-border)]"
            style={{
              aspectRatio: `${target.width} / ${target.height}`,
              width: wide ? "100%" : undefined,
              height: wide ? undefined : "min(70vh, 640px)",
              maxWidth: "100%",
              ...frameStyle,
            }}
          >
            {children}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={studioButtonClasses("primary")}
          >
            Close
          </button>
          {actions}
        </div>
      </div>
    </dialog>
  );
}
