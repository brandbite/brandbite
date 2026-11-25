// -----------------------------------------------------------------------------
// @file: components/qr/qr-code-generator.tsx
// @purpose: QR code generator: a link or text as a QR code in the visitor's
//           colors, with a choice of shape and an optional logo, downloaded
//           as PNG or SVG. Made in the browser; nothing is sent anywhere.
// -----------------------------------------------------------------------------

"use client";

import { useId, useMemo, useState } from "react";

import { DownloadIcon, UploadIcon, WarningIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  ColorChoice,
  FilePicker,
  Segmented,
  TOOL_ERROR,
  TOOL_HINT,
  TOOL_INPUT,
  TOOL_LABEL,
  TOOL_PANEL,
  useToolAccess,
} from "@/components/tools/tool-ui";
import { saveBlob } from "@/lib/image-tools/render";
import {
  QR_MAX_LENGTH,
  QR_STYLES,
  qrColorWarning,
  qrMatrix,
  qrSvg,
  qrTextProblem,
  type QrStyle,
} from "@/lib/qr/qr";

const CODE_COLORS = [
  { hex: "#000000", name: "Black" },
  { hex: "#292827", name: "Ink" },
  { hex: "#1f3a5f", name: "Navy" },
];
const BACK_COLORS = [
  { hex: "#ffffff", name: "White" },
  { hex: "#f3efe6", name: "Cream" },
];
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const PNG_SIZES = [1024, 2048];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("unreadable"));
    reader.readAsDataURL(file);
  });
}

/** Draw an SVG picture onto a canvas and hand back a PNG. */
async function svgToPng(svg: string, pixels: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not draw the code."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = pixels;
    canvas.height = pixels;
    canvas.getContext("2d")!.drawImage(image, 0, 0, pixels, pixels);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function QrCodeGenerator() {
  const access = useToolAccess();
  const textId = useId();

  const [text, setText] = useState("https://");
  const [foreground, setForeground] = useState("#000000");
  const [background, setBackground] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [style, setStyle] = useState<QrStyle>("square");
  const [logo, setLogo] = useState<{ name: string; dataUrl: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const value = text.trim();
  // "https://" alone is the starting hint, not something to encode.
  const problem =
    value === "https://" ? "Type a link or some text to make a code." : qrTextProblem(text);

  const matrix = useMemo(() => {
    if (problem) return null;
    try {
      return qrMatrix(value, logo !== null);
    } catch {
      return null;
    }
  }, [problem, value, logo]);

  const svg = (pixels: number) =>
    matrix
      ? qrSvg({
          matrix,
          pixels,
          foreground,
          background: transparent ? null : background,
          style,
          logoHref: logo?.dataUrl,
        })
      : null;

  const preview = svg(320);
  const colorWarning = qrColorWarning(foreground, transparent ? null : background);

  const onLogo = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoError("Use a PNG, JPG, WebP or SVG logo.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError("That logo is over 2 MB. Use a smaller file.");
      return;
    }
    try {
      setLogo({ name: file.name, dataUrl: await readAsDataUrl(file) });
      setLogoError(null);
    } catch {
      setLogoError("We couldn't read that logo. Try another file.");
    }
  };

  const downloadSvg = () => {
    const picture = svg(1024);
    if (!picture) return;
    saveBlob(new Blob([picture], { type: "image/svg+xml" }), "brandbite-qr-code.svg");
    setStatus("Downloaded the SVG.");
  };

  const downloadPng = async (pixels: number) => {
    const picture = svg(pixels);
    if (!picture) return;
    setExportError(null);
    try {
      saveBlob(await svgToPng(picture, pixels), `brandbite-qr-code-${pixels}.png`);
      setStatus(`Downloaded the ${pixels} pixel PNG.`);
    } catch (error) {
      console.error("[QrCode] export failed", error);
      setExportError("The PNG didn't work. Try the SVG, or a different logo file.");
    }
  };

  return (
    <section
      aria-label="QR code generator"
      className="grid grid-cols-[minmax(0,1fr)_400px] gap-6 max-[1023px]:grid-cols-1"
    >
      <div className={`flex flex-col gap-6 ${TOOL_PANEL}`}>
        <div>
          <label htmlFor={textId} className={TOOL_LABEL}>
            Link or text
          </label>
          <textarea
            id={textId}
            value={text}
            maxLength={QR_MAX_LENGTH}
            rows={2}
            onChange={(event) => setText(event.target.value)}
            className={`mt-2 ${TOOL_INPUT} h-auto resize-y py-2.5`}
          />
          <p className={`mt-2 ${TOOL_HINT}`}>
            The code holds exactly what you type. Start a web address with https:// so phones open
            it as a link.
          </p>
        </div>

        <ColorChoice
          label="Code color"
          value={foreground}
          onChange={setForeground}
          brandColors={access.brandColors}
          presets={CODE_COLORS}
        />

        <div>
          {transparent ? (
            <p className={TOOL_LABEL}>Background</p>
          ) : (
            <ColorChoice
              label="Background"
              value={background}
              onChange={setBackground}
              brandColors={access.brandColors}
              presets={BACK_COLORS}
            />
          )}
          <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-5 font-medium">
            <input
              type="checkbox"
              checked={transparent}
              onChange={(event) => setTransparent(event.target.checked)}
              className="h-5 w-5 accent-[var(--cs-text)]"
            />
            No background (see-through)
          </label>
        </div>

        <Segmented label="Shape" options={QR_STYLES} value={style} onChange={setStyle} />

        <div>
          <p className={TOOL_LABEL}>Logo in the middle (optional)</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FilePicker
              label={logo ? "Change logo" : "Choose a logo"}
              accept={LOGO_TYPES}
              onFiles={(files) => void onLogo(files)}
            >
              <UploadIcon />
            </FilePicker>
            {logo ? (
              <button
                type="button"
                className={studioButtonClasses("tertiary")}
                onClick={() => setLogo(null)}
              >
                Remove
              </button>
            ) : null}
          </div>
          <p className={`mt-2 ${TOOL_HINT}`}>
            {logo
              ? `${logo.name}. The code is made sturdier so it still scans with the logo on it.`
              : "PNG, JPG, WebP or SVG, up to 2 MB. Square logos fit best."}
          </p>
          {logoError ? (
            <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
              {logoError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className={`${TOOL_PANEL} flex flex-col items-center gap-4`}>
          <div
            className="flex aspect-square w-full max-w-[320px] items-center justify-center overflow-hidden rounded-xl border border-[var(--cs-border)]"
            style={{
              background: transparent
                ? "repeating-conic-gradient(#e6e3dc 0% 25%, #f7f6f2 0% 50%) 50% / 20px 20px"
                : undefined,
            }}
          >
            {preview ? (
              <div
                className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
                // Built here from the visitor's own text, colors and logo.
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            ) : (
              <p className={`px-6 text-center ${TOOL_HINT}`}>
                {problem ?? "That text is too long for a QR code. Shorten it."}
              </p>
            )}
          </div>
          {colorWarning && preview ? (
            <p className="flex items-start gap-2 text-sm leading-5 text-[#8a4a05]">
              <span className="mt-0.5 shrink-0">
                <WarningIcon />
              </span>
              {colorWarning}
            </p>
          ) : null}
          <p className={`text-center ${TOOL_HINT}`}>
            Point your phone&apos;s camera at the code to test it before you print it.
          </p>
        </div>

        <div className={TOOL_PANEL}>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!preview}
              onClick={downloadSvg}
              className={studioButtonClasses("primary")}
            >
              <DownloadIcon />
              Download SVG
            </button>
            {PNG_SIZES.map((pixels) => (
              <button
                key={pixels}
                type="button"
                disabled={!preview}
                onClick={() => void downloadPng(pixels)}
                className={studioButtonClasses("secondary")}
              >
                <DownloadIcon />
                PNG · {pixels} px
              </button>
            ))}
          </div>
          <p className={`mt-3 ${TOOL_HINT}`}>
            SVG stays sharp at any size and is best for print. PNG is for screens and documents.
          </p>
          {exportError ? (
            <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
              {exportError}
            </p>
          ) : null}
          <p role="status" className="sr-only">
            {status}
          </p>
        </div>
      </div>
    </section>
  );
}
