// -----------------------------------------------------------------------------
// @file: components/qr/qr-code-generator.tsx
// @purpose: QR code generator: a link or text as a QR code in the visitor's
//           colors, with a choice of shape and an optional logo, downloaded
//           as PNG or SVG. Made in the browser; nothing is sent anywhere.
// -----------------------------------------------------------------------------

"use client";

import { useId, useMemo, useState } from "react";

import { CloseIcon, DownloadIcon, UploadIcon, WarningIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  ColorChoice,
  FilePicker,
  TOOL_ERROR,
  TOOL_FOCUS,
  TOOL_HINT,
  TOOL_INPUT,
  TOOL_LABEL,
  TOOL_PANEL,
  useToolAccess,
} from "@/components/tools/tool-ui";
import { StepHeading } from "@/components/tools/tool-page";
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
    <section aria-label="QR code generator" className="flex flex-col gap-8">
      <div>
        <StepHeading
          number={1}
          title="Content"
          hint="Add the link or text you want to put in your QR code."
        />
        <div className={`mt-4 ${TOOL_PANEL}`}>
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute top-0 left-3 flex h-12 items-center text-[var(--cs-muted)]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 20l4-1 11-11-3-3L5 16zM14 7l3 3" />
              </svg>
            </span>
            <textarea
              id={textId}
              aria-label="Link or text"
              value={text}
              maxLength={QR_MAX_LENGTH}
              rows={1}
              onChange={(event) => setText(event.target.value)}
              className={`${TOOL_INPUT} block h-auto min-h-12 resize-y py-3 pl-10 text-base`}
            />
          </div>
          <p className={`mt-2 ${TOOL_HINT}`}>
            The code holds exactly what you type. Start a web address with https:// so phones open
            it as a link.
          </p>
        </div>
      </div>

      <div>
        <StepHeading
          number={2}
          title="Customize & preview"
          hint="Style your QR code and see it before you export."
        />
        <div className="mt-4 grid grid-cols-[420px_minmax(0,1fr)] items-start gap-6 max-[1023px]:grid-cols-1">
          <div className={`flex flex-col gap-6 ${TOOL_PANEL}`}>
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
              <div className="mt-3 flex items-center justify-between gap-3">
                <span id={`${textId}-transparent`} className="text-sm leading-5 font-medium">
                  Transparent background
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden className={TOOL_HINT}>
                    {transparent ? "On" : "Off"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={transparent}
                    aria-labelledby={`${textId}-transparent`}
                    onClick={() => setTransparent((on) => !on)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${TOOL_FOCUS} ${
                      transparent ? "bg-[var(--cs-selected)]" : "bg-[#C9C5BE]"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                        transparent ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </span>
              </div>
            </div>

            <fieldset>
              <legend className={TOOL_LABEL}>Shape</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {QR_STYLES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={style === option.id}
                    onClick={() => setStyle(option.id)}
                    className={`flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-[10px] border text-sm font-semibold transition-colors ${TOOL_FOCUS} ${
                      style === option.id
                        ? "border-[var(--cs-selected)] bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
                        : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]"
                    }`}
                  >
                    <svg
                      aria-hidden
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill={option.id === "dots" ? "currentColor" : "none"}
                      stroke={option.id === "dots" ? "none" : "currentColor"}
                      strokeWidth="1.75"
                    >
                      {option.id === "dots" ? (
                        [5, 12, 19].flatMap((cx) =>
                          [5, 12, 19].map((cy) => (
                            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" />
                          )),
                        )
                      ) : (
                        <rect
                          x="4"
                          y="4"
                          width="16"
                          height="16"
                          rx={option.id === "rounded" ? 5 : 1}
                        />
                      )}
                    </svg>
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="border-t border-[var(--cs-border)] pt-5">
              <p className={TOOL_LABEL}>Logo (optional)</p>
              {logo ? (
                <div className="mt-2 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a file on the visitor's device */}
                  <img
                    src={logo.dataUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-background)] object-contain p-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-5 font-semibold">{logo.name}</p>
                    <p className={TOOL_HINT}>The code is made sturdier so it still scans.</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${logo.name}`}
                    onClick={() => setLogo(null)}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[var(--cs-border)] hover:border-[var(--cs-text)] ${TOOL_FOCUS}`}
                  >
                    <CloseIcon />
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-2">
                    <FilePicker
                      label="Choose a logo"
                      accept={LOGO_TYPES}
                      onFiles={(files) => void onLogo(files)}
                    >
                      <UploadIcon />
                    </FilePicker>
                  </div>
                  <p className={`mt-2 ${TOOL_HINT}`}>
                    PNG, JPG, WebP or SVG, up to 2 MB. Square logos fit best.
                  </p>
                </>
              )}
              {logoError ? (
                <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
                  {logoError}
                </p>
              ) : null}
            </div>
          </div>

          <div
            className={`${TOOL_PANEL} flex min-h-full flex-col items-center justify-center gap-4 min-[1024px]:sticky min-[1024px]:top-6 min-[1024px]:py-10`}
          >
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
              <p className="flex max-w-[360px] items-start gap-2 text-sm leading-5 text-[#8a4a05]">
                <span className="mt-0.5 shrink-0">
                  <WarningIcon />
                </span>
                {colorWarning}
              </p>
            ) : null}
            <p className={`text-center ${TOOL_HINT}`}>
              {preview ? "This is your real code. Point your phone's camera at it." : "Preview"}
            </p>
          </div>
        </div>
      </div>

      <div>
        <StepHeading
          number={3}
          title="Export"
          hint="Download your QR code in the format you need."
        />
        <div className={`mt-4 ${TOOL_PANEL}`}>
          <div className="grid grid-cols-3 gap-3 max-[767px]:grid-cols-1">
            <button
              type="button"
              disabled={!preview}
              onClick={downloadSvg}
              className={`${studioButtonClasses("primary")} !h-14 w-full`}
            >
              <DownloadIcon />
              SVG
            </button>
            {PNG_SIZES.map((pixels) => (
              <button
                key={pixels}
                type="button"
                disabled={!preview}
                onClick={() => void downloadPng(pixels)}
                className={`${studioButtonClasses("secondary")} !h-14 w-full`}
              >
                <DownloadIcon />
                PNG ({pixels}px)
              </button>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-3 rounded-xl bg-[#FFF0D6] px-4 py-3 text-sm leading-5 font-semibold text-[#8a4a05]">
            <span className="shrink-0">
              <WarningIcon />
            </span>
            Test with your phone before printing.
          </p>
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
