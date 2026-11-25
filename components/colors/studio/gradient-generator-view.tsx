// -----------------------------------------------------------------------------
// @file: components/colors/studio/gradient-generator-view.tsx
// @purpose: Gradient generator: color stops, linear or radial, an angle, a
//           live preview, the CSS to copy and a PNG to download. Signed-in
//           customers can start from their brand guide colors.
// -----------------------------------------------------------------------------

"use client";

import { useId, useState } from "react";

import { CloseIcon, CopyIcon, DownloadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { useStudioCopy } from "@/components/colors/studio/use-studio-copy";
import {
  Segmented,
  TOOL_ERROR,
  TOOL_FOCUS,
  TOOL_HINT,
  TOOL_LABEL,
  TOOL_PANEL,
  useToolAccess,
} from "@/components/tools/tool-ui";
import {
  addStop,
  GRADIENT_SIZES,
  gradientCss,
  gradientDeclaration,
  gradientFileName,
  gradientFromColors,
  linearGradientLine,
  MAX_STOPS,
  MIN_STOPS,
  normalizeAngle,
  radialGradientRadius,
  removeStop,
  sortedStops,
  updateStop,
  type Gradient,
  type GradientKind,
  type GradientSizeId,
} from "@/lib/gradient/gradient";
import { saveBlob } from "@/lib/image-tools/render";

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function paint(gradient: Gradient, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  let fill: CanvasGradient;
  if (gradient.kind === "linear") {
    const line = linearGradientLine(width, height, gradient.angle);
    fill = ctx.createLinearGradient(line.x0, line.y0, line.x1, line.y1);
  } else {
    fill = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      radialGradientRadius(width, height),
    );
  }
  for (const stop of sortedStops(gradient)) fill.addColorStop(stop.position / 100, stop.color);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))),
      "image/png",
    ),
  );
}

export function GradientGeneratorView() {
  const access = useToolAccess();
  const angleId = useId();
  const { copy, isCopied } = useStudioCopy();

  const [gradient, setGradient] = useState<Gradient>(() =>
    gradientFromColors(["#fe5000", "#ffb38a", "#f0edff"]),
  );
  const [sizeId, setSizeId] = useState<GradientSizeId>("wide");
  const [exportError, setExportError] = useState<string | null>(null);

  const stops = sortedStops(gradient);
  const css = gradientCss(gradient);
  const declaration = gradientDeclaration(gradient);
  const size = GRADIENT_SIZES.find((option) => option.id === sizeId) ?? GRADIENT_SIZES[0];

  const download = async () => {
    setExportError(null);
    try {
      saveBlob(
        await paint(gradient, size.width, size.height),
        gradientFileName(size.width, size.height),
      );
    } catch (error) {
      console.error("[Gradient] export failed", error);
      setExportError("The download didn't work. Try again.");
    }
  };

  return (
    <section
      aria-label="Gradient generator"
      className="grid grid-cols-[380px_minmax(0,1fr)] gap-6 max-[1023px]:grid-cols-1"
    >
      <div className={`flex flex-col gap-6 ${TOOL_PANEL}`}>
        {access.brandColors.length >= MIN_STOPS ? (
          <div>
            <p className={TOOL_LABEL}>From your brand guide</p>
            <button
              type="button"
              onClick={() =>
                setGradient({
                  ...gradientFromColors(
                    access.brandColors.map((color) => color.hex),
                    gradient.kind,
                  ),
                  angle: gradient.angle,
                })
              }
              className={`mt-2 ${studioButtonClasses("secondary")}`}
            >
              Use my brand colors
            </button>
          </div>
        ) : null}

        <fieldset>
          <legend className={TOOL_LABEL}>Colors</legend>
          <ul className="mt-2 flex flex-col gap-2">
            {stops.map((stop, index) => (
              <li key={stop.id} className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label={`Color ${index + 1}`}
                  value={stop.color}
                  onChange={(event) =>
                    setGradient(updateStop(gradient, stop.id, { color: event.target.value }))
                  }
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-[10px] border border-[var(--cs-border)] bg-transparent p-1"
                />
                <input
                  type="range"
                  aria-label={`Position of color ${index + 1}`}
                  min={0}
                  max={100}
                  value={stop.position}
                  onChange={(event) =>
                    setGradient(
                      updateStop(gradient, stop.id, { position: Number(event.target.value) }),
                    )
                  }
                  className="h-6 min-w-0 flex-1 accent-[var(--cs-text)]"
                />
                <span className="w-11 shrink-0 text-right text-sm text-[var(--cs-muted)] tabular-nums">
                  {stop.position}%
                </span>
                <button
                  type="button"
                  aria-label={`Remove color ${index + 1}`}
                  disabled={gradient.stops.length <= MIN_STOPS}
                  onClick={() => setGradient(removeStop(gradient, stop.id))}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] hover:bg-[var(--cs-background)] disabled:cursor-not-allowed disabled:opacity-40 ${TOOL_FOCUS}`}
                >
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={gradient.stops.length >= MAX_STOPS}
            onClick={() => setGradient(addStop(gradient))}
            className={`mt-3 ${studioButtonClasses("secondary")}`}
          >
            Add a color
          </button>
        </fieldset>

        <Segmented<GradientKind>
          label="Type"
          options={[
            { id: "linear", label: "Linear" },
            { id: "radial", label: "Radial" },
          ]}
          value={gradient.kind}
          onChange={(kind) => setGradient({ ...gradient, kind })}
        />

        {gradient.kind === "linear" ? (
          <div>
            <label htmlFor={angleId} className={TOOL_LABEL}>
              Angle: {normalizeAngle(gradient.angle)}°
            </label>
            <input
              id={angleId}
              type="range"
              min={0}
              max={359}
              value={normalizeAngle(gradient.angle)}
              onChange={(event) => setGradient({ ...gradient, angle: Number(event.target.value) })}
              className="mt-3 h-6 w-full accent-[var(--cs-text)]"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {ANGLES.map((angle) => (
                <button
                  key={angle}
                  type="button"
                  aria-pressed={normalizeAngle(gradient.angle) === angle}
                  onClick={() => setGradient({ ...gradient, angle })}
                  className={`flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-medium ${TOOL_FOCUS} ${
                    normalizeAngle(gradient.angle) === angle
                      ? "border-[var(--cs-text)] bg-[var(--cs-text)] text-[var(--cs-surface)]"
                      : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]"
                  }`}
                >
                  {angle}°
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div
          role="img"
          aria-label={`Gradient preview: ${stops.map((stop) => stop.color).join(" to ")}`}
          className="aspect-video w-full rounded-2xl border border-[var(--cs-border)]"
          style={{ background: css }}
        />

        <div className={TOOL_PANEL}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={TOOL_LABEL}>CSS</h2>
            <button
              type="button"
              onClick={() => void copy(declaration, "gradient-css", "the CSS")}
              className={studioButtonClasses("secondary")}
            >
              <CopyIcon />
              {isCopied("gradient-css") ? "Copied" : "Copy CSS"}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-[var(--cs-background)] p-4 text-sm leading-6 whitespace-pre-wrap">
            <code>{declaration}</code>
          </pre>
        </div>

        <div className={TOOL_PANEL}>
          <Segmented<GradientSizeId>
            label="Image size"
            options={GRADIENT_SIZES.map((option) => ({ id: option.id, label: option.label }))}
            value={sizeId}
            onChange={setSizeId}
          />
          <button
            type="button"
            onClick={() => void download()}
            className={`mt-4 ${studioButtonClasses("primary")}`}
          >
            <DownloadIcon />
            Download PNG
          </button>
          <p className={`mt-3 ${TOOL_HINT}`}>
            The PNG matches the preview: same colors, same angle, at the size you pick.
          </p>
          {exportError ? (
            <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
              {exportError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
