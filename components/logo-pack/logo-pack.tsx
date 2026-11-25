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
import { useEffect, useState } from "react";

import { DownloadIcon, UploadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  ColorChoice,
  FilePicker,
  TOOL_ERROR,
  TOOL_HINT,
  TOOL_LABEL,
  TOOL_PANEL,
  fetchBrandLogo,
  useToolAccess,
} from "@/components/tools/tool-ui";
import { saveBlob, zipFiles } from "@/lib/image-tools/render";
import { canvasForHandoff, leaveForMockupStudio } from "@/lib/mockups/handoff";
import type { DeviceKind } from "@/lib/mockups/options";
import { keepWork, keptWork } from "@/lib/tools/keep";
import { readableTextOn } from "@/lib/colors/contrast";
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

export function LogoPack() {
  const access = useToolAccess();
  const router = useRouter();

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

  const onBackground = readableTextOn(iconBackground);

  return (
    <section
      aria-label="Logo pack"
      className="grid grid-cols-[360px_minmax(0,1fr)] gap-6 max-[1023px]:grid-cols-1"
    >
      <div className={`flex flex-col gap-6 ${TOOL_PANEL}`}>
        <div>
          <p className={TOOL_LABEL}>Logo</p>
          <div className="mt-2">
            <FilePicker
              label={logo ? "Change logo" : "Choose a logo"}
              accept={LOGO_INPUT_TYPES}
              onFiles={(files) => void onFiles(files)}
            >
              <UploadIcon />
            </FilePicker>
            {access.hasBrandLogo ? (
              <button
                type="button"
                onClick={() => void loadBrandLogo()}
                className={`mt-2 ${studioButtonClasses("secondary")}`}
              >
                Use the logo from my brand guide
              </button>
            ) : null}
          </div>
          <p className={`mt-2 ${TOOL_HINT}`}>
            {logo
              ? `${logo.name} · ${logo.isSvg ? "SVG, sharp at every size" : `${logo.width} × ${logo.height}`}`
              : "SVG is best. A PNG with a see-through background works too. It stays in your browser."}
          </p>
          {logo && !logo.isSvg && Math.max(logo.width, logo.height) < Math.max(...LOGO_SIZES) ? (
            <p className={`mt-2 ${TOOL_HINT}`}>
              This image is smaller than the largest size in the pack, so that size will look soft.
              An SVG avoids that.
            </p>
          ) : null}
          {fileError ? (
            <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
              {fileError}
            </p>
          ) : null}
        </div>

        <div>
          <ColorChoice
            label="Icon background"
            value={iconBackground}
            onChange={setIconBackground}
            brandColors={access.brandColors}
            presets={ICON_BACKGROUNDS}
          />
          <p className={`mt-2 ${TOOL_HINT}`}>
            Behind your logo in the favicon, the app icon and the profile image.
          </p>
        </div>

        <div>
          <p className={TOOL_LABEL}>In the pack</p>
          <ul className={`mt-2 flex flex-col gap-1 ${TOOL_HINT}`}>
            <li>
              Logo in {LOGO_VARIANTS.length} colorings × {LOGO_SIZES.length} sizes (
              {LOGO_SIZES.join(", ")} px)
            </li>
            <li>favicon.ico and PNGs ({FAVICON_SIZES.join(", ")} px)</li>
            <li>App icon (180 px) and profile image (1080 px)</li>
            {logo?.isSvg ? <li>Your original SVG</li> : null}
            <li>{entries.length} files in all, with a note on what each is for</li>
          </ul>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className={TOOL_PANEL}>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!logo || busy}
              onClick={() => void downloadFree()}
              className={studioButtonClasses("primary")}
            >
              <DownloadIcon />
              Download PNG · {FREE_FILE.size} px
            </button>
            <button
              type="button"
              disabled={!logo || busy || !access.pro}
              onClick={() => void downloadPack()}
              className={studioButtonClasses("secondary")}
            >
              <DownloadIcon />
              {busy ? "Preparing…" : "Download the full pack (.zip)"}
              <span className="rounded-full bg-[#f0edff] px-2 py-0.5 text-xs font-semibold text-[#4a3fa8]">
                Pro
              </span>
            </button>
          </div>
          <p className={`mt-3 ${TOOL_HINT}`}>
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
          {exportError ? (
            <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
              {exportError}
            </p>
          ) : null}
          <p role="status" className="sr-only">
            {status}
          </p>
        </div>

        {logo ? (
          <ul className="grid grid-cols-3 gap-4 max-[767px]:grid-cols-1">
            {LOGO_VARIANTS.map((variant) => (
              <li key={variant.id} className={`${TOOL_PANEL} flex flex-col gap-3 !p-4`}>
                <div
                  className="flex h-36 items-center justify-center rounded-xl border border-[var(--cs-border)] p-5"
                  style={{ background: variant.id === "white" ? "#1c1b1f" : "#ffffff" }}
                >
                  {/* A local preview of the visitor's own file. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
                </div>
                <p className="text-sm leading-5 font-semibold">{variant.label}</p>
              </li>
            ))}
            <li className={`${TOOL_PANEL} flex flex-col gap-3 !p-4`}>
              <div className="flex h-36 items-center justify-center rounded-xl bg-[var(--cs-background)]">
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-[22%] border border-[var(--cs-border)]"
                  style={{ background: iconBackground }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo.url}
                    alt=""
                    style={{ maxWidth: `${ICON_FILL * 100}%`, maxHeight: `${ICON_FILL * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-sm leading-5 font-semibold">App icon and favicon</p>
            </li>
            <li className={`${TOOL_PANEL} flex flex-col gap-3 !p-4`}>
              <div className="flex h-36 items-center justify-center rounded-xl bg-[var(--cs-background)]">
                <div
                  className="flex h-28 w-28 items-center justify-center rounded-full border border-[var(--cs-border)]"
                  style={{ background: iconBackground }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo.url} alt="" style={{ maxWidth: "58%", maxHeight: "58%" }} />
                </div>
              </div>
              <p className="text-sm leading-5 font-semibold">Profile image</p>
              <p className={TOOL_HINT}>Shown in a circle here, as most platforms crop it.</p>
            </li>
            <li className={`${TOOL_PANEL} flex flex-col gap-3 !p-4`}>
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
              <p className="text-sm leading-5 font-semibold">Browser tab</p>
              <p className={TOOL_HINT}>The favicon at its real size, 16 pixels.</p>
            </li>
          </ul>
        ) : (
          <p className={`${TOOL_PANEL} ${TOOL_HINT}`}>
            Choose your logo to see it in every version the pack holds.
          </p>
        )}

        {logo ? (
          <div className={TOOL_PANEL}>
            <h2 className={TOOL_LABEL}>See it in use</h2>
            <ul className="mt-3 grid grid-cols-2 gap-4 max-[767px]:grid-cols-1">
              <li className="flex flex-col gap-2">
                <div className="flex h-44 items-center justify-center rounded-xl bg-[var(--cs-background)] p-4">
                  <div
                    className="flex aspect-[1.75] h-full max-w-full flex-col items-center justify-center gap-2 rounded-lg border border-[var(--cs-border)] shadow-sm"
                    style={{ background: iconBackground }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo.url} alt="" style={{ maxWidth: "52%", maxHeight: "44%" }} />
                    <span
                      className="text-[10px] tracking-wide"
                      style={{ color: onBackground, opacity: 0.75 }}
                    >
                      yourwebsite.com
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-5 font-semibold">Business card</p>
              </li>
              <li className="flex flex-col gap-2">
                <div className="flex h-44 items-center justify-center rounded-xl bg-[var(--cs-background)] p-4">
                  <div className="flex aspect-[9/16] h-full flex-col items-center justify-center gap-1.5 rounded-[18px] border-4 border-[#1c1b1f] bg-[#e9e7e2]">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-[22%] shadow-sm"
                      style={{ background: iconBackground }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo.url} alt="" style={{ maxWidth: "72%", maxHeight: "72%" }} />
                    </span>
                    <span className="text-[9px] text-[#292827]">Your app</span>
                  </div>
                </div>
                <p className="text-sm leading-5 font-semibold">Phone home screen</p>
              </li>
            </ul>

            <h3 className={`mt-5 ${TOOL_LABEL}`}>On a 3D device</h3>
            <p className={`mt-1 ${TOOL_HINT}`}>
              Opens Mockup Studio with your logo on the screen, on your icon background. Turn the
              device, change the background and download it there.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {(
                [
                  ["phone", "On a phone"],
                  ["laptop", "On a laptop"],
                  ["tablet", "On a tablet"],
                ] as [DeviceKind, string][]
              ).map(([device, label]) => (
                <button
                  key={device}
                  type="button"
                  onClick={() => openInMockupStudio(device)}
                  className={studioButtonClasses("secondary")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
