// -----------------------------------------------------------------------------
// @file: components/logo-pack/logo-pack.tsx
// @purpose: Logo pack: one logo in, a zip of everything it is usually needed
//           as: three colorings at three sizes, a favicon set, an app icon and
//           a social profile image. Drawn in the browser; nothing is uploaded.
//           One PNG is free; the full pack comes with a brandbite plan.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { CloseIcon, DownloadIcon, UploadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  ColorChoice,
  FilePicker,
  TOOL_ERROR,
  TOOL_FOCUS,
  TOOL_HINT,
  TOOL_PANEL,
  fetchBrandLogo,
  useToolAccess,
} from "@/components/tools/tool-ui";
import { StepHeading } from "@/components/tools/tool-page";
import { saveBlob, zipFiles } from "@/lib/image-tools/render";
import { canvasForHandoff, leaveForMockupStudio } from "@/lib/mockups/handoff";
import type { DeviceKind } from "@/lib/mockups/options";
import { keepWork, keptWork } from "@/lib/tools/keep";
import {
  FAVICON_FILL,
  FAVICON_SIZES,
  fitLongestEdge,
  FREE_FILE,
  ICON_FILL,
  icoFile,
  LOGO_INPUT_TYPES,
  LOGO_SIZES,
  LOGO_VARIANTS,
  logoInputProblem,
  packEntries,
  packReadme,
  placeInSquare,
  PROFILE_SIZE,
  TOUCH_ICON_SIZE,
  type LogoVariant,
} from "@/lib/logo-pack/pack";

const ICON_BACKGROUNDS = [
  { hex: "#ffffff", name: "White" },
  { hex: "#000000", name: "Black" },
  { hex: "#f3efe6", name: "Cream" },
];

type Logo = {
  name: string;
  url: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  isSvg: boolean;
  file: File;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("unreadable"));
    image.src = url;
  });
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))),
      "image/png",
    ),
  );
}

/** The logo at a size, in its own colors or painted one solid color. */
function drawLogo(logo: Logo, width: number, height: number, fill: string | null) {
  const { canvas, ctx } = canvasOf(width, height);
  ctx.drawImage(logo.image, 0, 0, width, height);
  if (fill) {
    // Keep the logo's shape, replace its colors.
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}

/** A square with a background and the logo centered in it. */
function drawIcon(logo: Logo, size: number, background: string, fill: number) {
  const { canvas, ctx } = canvasOf(size, size);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  const place = placeInSquare(logo.width, logo.height, size, fill);
  ctx.drawImage(logo.image, place.x, place.y, place.width, place.height);
  return canvas;
}

const KEEP_KEY = "logo-pack";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LogoPack() {
  const access = useToolAccess();
  const router = useRouter();
  const fileInputId = useId();
  const [dragging, setDragging] = useState(false);

  // Coming back from Mockup Studio returns to the logo as it was left
  // (lib/tools/keep.ts). Its address stays valid until the logo is replaced.
  const [kept] = useState(() => keptWork<{ logo: Logo | null; iconBackground: string }>(KEEP_KEY));
  const [logo, setLogo] = useState<Logo | null>(kept?.logo ?? null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [iconBackground, setIconBackground] = useState(kept?.iconBackground ?? "#ffffff");
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    keepWork(KEEP_KEY, { logo, iconBackground });
  }, [logo, iconBackground]);

  const onFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const problem = logoInputProblem(file);
    if (problem) {
      setFileError(problem);
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      const isSvg = file.type === "image/svg+xml";
      // An SVG without a size of its own reports none: give it a square to draw in.
      const width = image.naturalWidth || 1024;
      const height = image.naturalHeight || 1024;
      if (logo) URL.revokeObjectURL(logo.url);
      setLogo({ name: file.name, url, image, width, height, isSvg, file });
      setFileError(null);
      setStatus(`${file.name} is ready.`);
    } catch {
      URL.revokeObjectURL(url);
      setFileError("We couldn't read that logo. Try another file.");
    }
  };

  const removeLogo = () => {
    if (logo) URL.revokeObjectURL(logo.url);
    setLogo(null);
    setFileError(null);
    setStatus("Logo removed.");
  };

  const logoPng = (variant: LogoVariant, edge: number) => {
    const size = fitLongestEdge(logo!.width, logo!.height, edge);
    const fill = LOGO_VARIANTS.find((v) => v.id === variant)?.fill ?? null;
    return toPng(drawLogo(logo!, size.width, size.height, fill));
  };

  const run = async (work: () => Promise<void>, done: string) => {
    if (!logo) return;
    setBusy(true);
    setExportError(null);
    try {
      await work();
      setStatus(done);
    } catch (error) {
      console.error("[LogoPack] export failed", error);
      setExportError("The download didn't work. Try again, or try a smaller logo file.");
    } finally {
      setBusy(false);
    }
  };

  const downloadFree = () =>
    run(
      async () =>
        saveBlob(
          await logoPng(FREE_FILE.variant, FREE_FILE.size),
          `logo-${FREE_FILE.variant}-${FREE_FILE.size}.png`,
        ),
      "Downloaded the PNG.",
    );

  const downloadPack = () =>
    run(async () => {
      const files: { name: string; blob: Blob }[] = [];
      const faviconPngs: { size: number; png: Uint8Array }[] = [];
      for (const size of FAVICON_SIZES) {
        const blob = await toPng(drawIcon(logo!, size, iconBackground, FAVICON_FILL));
        faviconPngs.push({ size, png: new Uint8Array(await blob.arrayBuffer()) });
      }
      for (const entry of packEntries({ isSvg: logo!.isSvg })) {
        switch (entry.kind) {
          case "logo":
            files.push({ name: entry.path, blob: await logoPng(entry.variant, entry.edge) });
            break;
          case "favicon": {
            const png = faviconPngs.find((image) => image.size === entry.size)!.png;
            files.push({
              name: entry.path,
              blob: new Blob([png.buffer as ArrayBuffer], { type: "image/png" }),
            });
            break;
          }
          case "ico":
            files.push({
              name: entry.path,
              blob: new Blob([icoFile(faviconPngs).buffer as ArrayBuffer], {
                type: "image/x-icon",
              }),
            });
            break;
          case "icon":
            files.push({
              name: entry.path,
              blob: await toPng(drawIcon(logo!, entry.size, iconBackground, ICON_FILL)),
            });
            break;
          case "source":
            files.push({ name: entry.path, blob: logo!.file });
            break;
          case "readme":
            files.push({
              name: entry.path,
              blob: new Blob([packReadme({ isSvg: logo!.isSvg, iconBackground })], {
                type: "text/plain",
              }),
            });
            break;
        }
      }
      saveBlob(await zipFiles(files), "brandbite-logo-pack.zip");
    }, "Downloaded the logo pack.");

  const entries = packEntries({ isSvg: logo?.isSvg ?? false });

  const loadBrandLogo = async () => {
    const file = await fetchBrandLogo("primary");
    if (file) await onFiles([file]);
    else setFileError("We couldn't load the logo from your brand guide. Choose the file instead.");
  };

  /** Open Mockup Studio with the logo on a device screen, on the icon background. */
  const openInMockupStudio = (device: DeviceKind) => {
    if (!logo) return;
    const [width, height] =
      device === "laptop" ? [1920, 1200] : device === "tablet" ? [1536, 2048] : [1080, 2340];
    const { canvas, ctx } = canvasOf(width, height);
    ctx.fillStyle = iconBackground;
    ctx.fillRect(0, 0, width, height);
    const box = fitLongestEdge(logo.width, logo.height, Math.min(width, height) * 0.55);
    ctx.drawImage(
      logo.image,
      (width - box.width) / 2,
      (height - box.height) / 2,
      box.width,
      box.height,
    );
    const dataUrl = canvasForHandoff(canvas);
    if (
      !dataUrl ||
      !leaveForMockupStudio({ dataUrl, name: logo.name, device, returnTo: "/logo-pack" })
    ) {
      setExportError(
        "We couldn't pass the logo to Mockup Studio. Download the PNG and add it there.",
      );
      return;
    }
    router.push("/mockups");
  };

  const SUMMARY = [
    {
      title: `${LOGO_VARIANTS.length} color versions`,
      detail: "Original, black, white",
      icon: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01",
    },
    {
      title: `${LOGO_SIZES.length} sizes`,
      detail: `${LOGO_SIZES.join(", ")} px`,
      icon: "M5 19L19 5M13 5h6v6M11 19H5v-6",
    },
    {
      title: "Favicons",
      detail: `${FAVICON_SIZES.join(", ")} px and .ico`,
      icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z",
    },
    {
      title: "App icon",
      detail: `${TOUCH_ICON_SIZE} × ${TOUCH_ICON_SIZE}`,
      icon: "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2",
    },
    {
      title: "Profile",
      detail: `${PROFILE_SIZE} × ${PROFILE_SIZE}`,
      icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
    },
  ];

  return (
    <section aria-label="Logo pack" className="flex flex-col gap-8">
      <div>
        <StepHeading number={1} title="Source" hint="Add your logo file." />
        <div className={`mt-4 ${TOOL_PANEL} ${logo ? "" : "!p-3"}`}>
          {logo ? (
            <div className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- a file on the visitor's device */}
              <img
                src={logo.url}
                alt=""
                width={72}
                height={72}
                className="h-[72px] w-[72px] shrink-0 rounded-xl border border-[var(--cs-border)] bg-white object-contain p-2"
              />
              <div className="min-w-[160px] flex-1">
                <p className="truncate text-base leading-6 font-semibold">{logo.name}</p>
                <p className={`${TOOL_HINT} tabular-nums`}>
                  {formatSize(logo.file.size)} ·{" "}
                  {logo.isSvg ? "SVG, sharp at every size" : `${logo.width} × ${logo.height}`}
                </p>
              </div>
              <FilePicker
                label="Replace"
                accept={LOGO_INPUT_TYPES}
                onFiles={(files) => void onFiles(files)}
              />
              <button
                type="button"
                aria-label={`Remove ${logo.name}`}
                onClick={removeLogo}
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
                accept={LOGO_INPUT_TYPES.join(",")}
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
                Drag and drop your logo here
              </span>
              <span className={TOOL_HINT}>or click to choose a file</span>
              <span className={`mt-3 ${studioButtonClasses("secondary")}`}>Choose file</span>
              <span className={`mt-3 ${TOOL_HINT}`}>
                SVG is best. A PNG with a see-through background works too. Up to 10 MB.
              </span>
            </label>
          )}
          {access.hasBrandLogo && !logo ? (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => void loadBrandLogo()}
                className={studioButtonClasses("secondary")}
              >
                Use the logo from my brand guide
              </button>
            </div>
          ) : null}
          {logo && !logo.isSvg && Math.max(logo.width, logo.height) < Math.max(...LOGO_SIZES) ? (
            <p className={`mt-4 border-t border-[var(--cs-border)] pt-3 ${TOOL_HINT}`}>
              This image is smaller than the largest size in the pack, so that size will look soft.
              An SVG avoids that.
            </p>
          ) : null}
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
          title="Preview your pack"
          hint="Choose the icon background and see what is in your logo pack."
        />
        <div className={`mt-4 ${TOOL_PANEL}`}>
          <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-8 max-[1023px]:grid-cols-1">
            <div>
              <h3 className="text-lg leading-7 font-bold">Options</h3>
              <div className="mt-2">
                <ColorChoice
                  label="Icon background"
                  value={iconBackground}
                  onChange={setIconBackground}
                  brandColors={access.brandColors}
                  presets={ICON_BACKGROUNDS}
                />
              </div>
              <p className={`mt-2 ${TOOL_HINT}`}>
                Behind your logo in the favicon, the app icon and the profile image.
              </p>
            </div>

            <div className="min-w-0 min-[1024px]:border-l min-[1024px]:border-[var(--cs-border)] min-[1024px]:pl-8">
              <h3 className="text-lg leading-7 font-bold">Variants</h3>
              <p className={TOOL_HINT}>
                {LOGO_VARIANTS.length} color versions × {LOGO_SIZES.length} sizes, plus favicons, an
                app icon and a profile image.
              </p>
              <ul className="mt-3 grid grid-cols-3 gap-3 max-[639px]:grid-cols-1">
                {LOGO_VARIANTS.map((variant) => (
                  <li key={variant.id}>
                    <div
                      className="flex h-28 items-center justify-center rounded-xl border border-[var(--cs-border)] p-5"
                      style={{ background: variant.id === "white" ? "#1c1b1f" : "#ffffff" }}
                    >
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- a file on the visitor's device
                        <img
                          src={logo.url}
                          alt=""
                          className="max-h-full max-w-full"
                          style={{
                            filter:
                              variant.id === "black"
                                ? "brightness(0)"
                                : variant.id === "white"
                                  ? "brightness(0) invert(1)"
                                  : undefined,
                          }}
                        />
                      ) : (
                        <span
                          className="text-sm leading-5"
                          style={{ color: variant.id === "white" ? "#d6d3cd" : "#8a867f" }}
                        >
                          Your logo
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-5 font-semibold">{variant.label}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-background)] px-4 py-3">
            {SUMMARY.map((item) => (
              <li key={item.title} className="flex items-center gap-3">
                <svg
                  aria-hidden
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <path d={item.icon} />
                </svg>
                <span className="text-sm leading-5">
                  <span className="block font-semibold">{item.title}</span>
                  <span className="block text-[var(--cs-muted)] tabular-nums">{item.detail}</span>
                </span>
              </li>
            ))}
            <li className="ml-auto rounded-full bg-[var(--cs-soft)] px-3 py-1 text-sm leading-5 font-semibold text-[var(--cs-soft-text)] tabular-nums">
              {entries.length} files
            </li>
          </ul>

          {logo ? (
            <div className="mt-6 border-t border-[var(--cs-border)] pt-5">
              <h3 className="text-lg leading-7 font-bold">Applications</h3>
              <p className={TOOL_HINT}>See how your logo looks in common places.</p>
              <ul className="mt-3 grid grid-cols-3 gap-4 max-[767px]:grid-cols-1">
                <li>
                  <div className="flex h-36 flex-col justify-center rounded-xl bg-[var(--cs-background)] px-4">
                    <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2">
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px]"
                        style={{ background: iconBackground }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logo.url} alt="" style={{ maxWidth: "90%", maxHeight: "90%" }} />
                      </span>
                      <span className="truncate text-xs">Your website</span>
                    </div>
                    <div className="h-10 rounded-b-lg border border-[var(--cs-border)] bg-[var(--cs-surface)]" />
                  </div>
                  <p className="mt-2 text-sm leading-5 font-semibold">Browser favicon</p>
                  <p className={`${TOOL_HINT} tabular-nums`}>
                    {FAVICON_SIZES.map((size) => `${size} × ${size}`).join(" · ")}
                  </p>
                </li>
                <li>
                  <div className="flex h-36 items-center justify-center rounded-xl bg-[#F3EFE6]">
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-[22%] border border-[var(--cs-border)] shadow-sm"
                      style={{ background: iconBackground }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logo.url}
                        alt=""
                        style={{
                          maxWidth: `${ICON_FILL * 100}%`,
                          maxHeight: `${ICON_FILL * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-5 font-semibold">App icon</p>
                  <p className={`${TOOL_HINT} tabular-nums`}>
                    {TOUCH_ICON_SIZE} × {TOUCH_ICON_SIZE}
                  </p>
                </li>
                <li>
                  <div className="flex h-36 items-center justify-center rounded-xl bg-[var(--cs-soft)]">
                    <div
                      className="flex h-24 w-24 items-center justify-center rounded-full border border-[var(--cs-border)]"
                      style={{ background: iconBackground }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo.url} alt="" style={{ maxWidth: "58%", maxHeight: "58%" }} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-5 font-semibold">Profile image</p>
                  <p className={`${TOOL_HINT} tabular-nums`}>
                    {PROFILE_SIZE} × {PROFILE_SIZE}, shown in a circle as most platforms crop it
                  </p>
                </li>
              </ul>

              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-[var(--cs-background)] px-4 py-3">
                <div className="min-w-[220px] flex-1">
                  <p className="text-sm leading-5 font-semibold">On a 3D device</p>
                  <p className={TOOL_HINT}>
                    Opens Mockup Studio with your logo on the screen, on your icon background.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["phone", "Phone"],
                      ["laptop", "Laptop"],
                      ["tablet", "Tablet"],
                    ] as [DeviceKind, string][]
                  ).map(([device, label]) => (
                    <button
                      key={device}
                      type="button"
                      aria-label={`Open on a ${device} in Mockup Studio`}
                      onClick={() => openInMockupStudio(device)}
                      className={studioButtonClasses("secondary")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <StepHeading
          number={3}
          title="Export"
          hint="Download your logo pack in the formats you need."
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!logo || busy}
            onClick={() => void downloadFree()}
            className={`${studioButtonClasses("primary")} !h-14 min-w-[260px] !px-6 max-[639px]:w-full`}
          >
            <DownloadIcon />
            Download PNG ({FREE_FILE.size})
            {access.pro ? null : (
              <span className="rounded-full bg-[#E3F1E4] px-2.5 py-0.5 text-xs leading-5 font-semibold text-[#14532D]">
                Free
              </span>
            )}
          </button>
          <button
            type="button"
            disabled={!logo || busy || !access.pro}
            onClick={() => void downloadPack()}
            className={`${studioButtonClasses("secondary")} !h-14 min-w-[260px] !px-6 max-[639px]:w-full`}
          >
            <DownloadIcon />
            {busy ? "Preparing…" : "Full pack (ZIP)"}
            {access.pro ? null : (
              <span className="rounded-full bg-[var(--cs-soft)] px-2.5 py-0.5 text-xs leading-5 font-semibold text-[var(--cs-soft-text)]">
                Plan
              </span>
            )}
          </button>
          <p className={`min-w-[220px] flex-1 ${TOOL_HINT}`}>
            {access.pro ? (
              "Your plan includes the full pack."
            ) : (
              <>
                One PNG is free. The full pack is included with every brandbite plan.
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
        </div>
        {exportError ? (
          <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
            {exportError}
          </p>
        ) : null}
        <p role="status" className="sr-only">
          {status}
        </p>
      </div>
    </section>
  );
}
