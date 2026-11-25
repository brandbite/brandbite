// -----------------------------------------------------------------------------
// @file: components/mockups/mockup-studio.tsx
// @purpose: Mockup Studio: put a screenshot on a 3D phone, tablet or laptop,
//           choose the angle and background, and download a PNG. Everything
//           runs in the browser; the screenshot is never uploaded.
//           Free downloads are 1080p with a small brandbite mark; customers on
//           a plan also get 4K without it.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { DownloadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  BACKGROUND_PRESETS,
  backgroundCss,
  DEVICES,
  EXPORT_SIZES,
  exportFileName,
  hasWatermark,
  MOTIONS,
  screenshotProblem,
  SCREEN_MEDIA_TYPES,
  screenMediaKind,
  VIDEO,
  videoFileName,
  VIEWS,
  type Background,
  type DeviceKind,
  type ExportSize,
  type MotionId,
  type ViewId,
} from "@/lib/mockups/options";
import { dataUrlToBlob, returnLabel, takeMockupHandoff } from "@/lib/mockups/handoff";
import type { MockupScene } from "@/lib/mockups/scene";
import type { ToolEntitlement } from "@/lib/tools/entitlement";

type Access = ToolEntitlement & { brandColors: { hex: string; name: string | null }[] };

const SIGNED_OUT: Access = { signedIn: false, pro: false, reason: "signedOut", brandColors: [] };

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-[var(--cs-text)] focus-visible:ring-offset-2 focus-visible:outline-none";

const GROUP_LABEL = "text-sm leading-5 font-semibold";

function sameBackground(a: Background, b: Background): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className={GROUP_LABEL}>{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === value}
            onClick={() => onChange(option.id)}
            className={`flex h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors ${FOCUS} ${
              option.id === value
                ? "border-[var(--cs-text)] bg-[var(--cs-text)] text-[var(--cs-surface)]"
                : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Swatch({
  label,
  background,
  selected,
  onSelect,
}: {
  label: string;
  background: Background;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onSelect}
      className={`h-11 w-11 rounded-full border ${FOCUS} ${
        selected
          ? "border-[var(--cs-text)] ring-2 ring-[var(--cs-text)] ring-offset-2"
          : "border-[var(--cs-border)]"
      }`}
      style={{ background: backgroundCss(background) }}
    />
  );
}

export function MockupStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MockupScene | null>(null);
  const fileInputId = useId();
  const colorInputId = useId();

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [device, setDevice] = useState<DeviceKind>("phone");
  const [view, setView] = useState<ViewId>("left");
  const [background, setBackground] = useState<Background>(BACKGROUND_PRESETS[0].background);
  const [shadow, setShadow] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>(SIGNED_OUT);
  const [exporting, setExporting] = useState<ExportSize["id"] | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [motion, setMotion] = useState<MotionId>("none");
  const [playing, setPlaying] = useState(false);
  /** 0..1 while a video is being recorded, otherwise null. */
  const [recording, setRecording] = useState<number | null>(null);
  const [recordSeconds, setRecordSeconds] = useState<number>(VIDEO.seconds);
  const [screenIsVideo, setScreenIsVideo] = useState(false);
  const [cameFrom, setCameFrom] = useState<string | null>(null);
  /** The video on the screen and its temporary address, to let go of when it is replaced. */
  const screenVideoRef = useRef<{ element: HTMLVideoElement; url: string } | null>(null);

  const releaseScreenVideo = useCallback(() => {
    const current = screenVideoRef.current;
    if (!current) return;
    current.element.pause();
    current.element.removeAttribute("src");
    current.element.load();
    URL.revokeObjectURL(current.url);
    screenVideoRef.current = null;
  }, []);

  useEffect(() => releaseScreenVideo, [releaseScreenVideo]);

  // Start the 3D scene. three.js is loaded here, not with the page, so the
  // page's text shows first and the library only reaches people who use the tool.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    (async () => {
      try {
        const { MockupScene } = await import("@/lib/mockups/scene");
        if (cancelled || !canvasRef.current || !stageRef.current) return;
        const scene = new MockupScene(canvasRef.current);
        sceneRef.current = scene;
        const stage = stageRef.current;
        const fit = () => scene.resize(stage.clientWidth, stage.clientHeight);
        observer = new ResizeObserver(fit);
        observer.observe(stage);
        fit();
        scene.setView("left");
        setReady(true);

        // Another hub tool may have left a picture to open with.
        const handoff = takeMockupHandoff();
        if (handoff) {
          try {
            const image = await createImageBitmap(dataUrlToBlob(handoff.dataUrl), {
              imageOrientation: "flipY",
            });
            if (cancelled) return;
            scene.setDevice(handoff.device);
            scene.setScreenshot(image);
            setDevice(handoff.device);
            setFileName(handoff.name);
            setCameFrom(handoff.returnTo ?? null);
            if (handoff.background) setBackground({ kind: "solid", color: handoff.background });
            setStatus(`${handoff.name} is on the screen.`);
          } catch (error) {
            console.error("[MockupStudio] could not open the handed-over picture", error);
          }
        }
      } catch (error) {
        console.error("[MockupStudio] could not start", error);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/tools/entitlement", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: Access | null) => {
        if (live && json) setAccess({ ...SIGNED_OUT, ...json });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const chooseDevice = (next: DeviceKind) => {
    setDevice(next);
    sceneRef.current?.setDevice(next);
  };
  const chooseView = (next: ViewId) => {
    setView(next);
    sceneRef.current?.setView(next);
  };
  const toggleShadow = (next: boolean) => {
    setShadow(next);
    sceneRef.current?.setShadow(next);
  };

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const problem = screenshotProblem(file);
      if (problem) {
        setFileError(problem);
        return;
      }
      try {
        if (screenMediaKind(file) === "video") {
          const url = URL.createObjectURL(file);
          const element = document.createElement("video");
          element.muted = true;
          element.loop = true;
          element.playsInline = true;
          element.src = url;
          try {
            await new Promise<void>((resolve, reject) => {
              element.onloadeddata = () => resolve();
              element.onerror = () => reject(new Error("unreadable video"));
            });
            await element.play();
          } catch (error) {
            URL.revokeObjectURL(url);
            throw error;
          }
          sceneRef.current?.setScreenshot(element);
          releaseScreenVideo();
          screenVideoRef.current = { element, url };
          setScreenIsVideo(true);
        } else {
          const image = await createImageBitmap(file, { imageOrientation: "flipY" });
          sceneRef.current?.setScreenshot(image);
          releaseScreenVideo();
          setScreenIsVideo(false);
        }
        setFileName(file.name);
        setFileError(null);
        setStatus(`${file.name} is on the screen.`);
      } catch {
        setFileError("We couldn't read that file. Try another one.");
      }
    },
    [releaseScreenVideo],
  );

  const removeScreenshot = () => {
    sceneRef.current?.setScreenshot(null);
    releaseScreenVideo();
    setScreenIsVideo(false);
    setFileName(null);
    setStatus("Removed from the screen.");
  };

  const chooseMotion = (next: MotionId) => {
    setMotion(next);
    sceneRef.current?.setMotion(next);
    if (next === "none") setPlaying(false);
  };
  const togglePlay = () => {
    const scene = sceneRef.current;
    if (!scene || motion === "none") return;
    if (playing) scene.pause();
    else scene.play();
    setPlaying(!playing);
  };

  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadVideo = async () => {
    const scene = sceneRef.current;
    if (!scene || (motion === "none" && !scene.hasScreenVideo)) return;
    const seconds = Math.round(scene.videoSeconds);
    setRecordSeconds(seconds);
    setRecording(0);
    setExportError(null);
    setStatus(`Recording a ${seconds}-second video.`);
    try {
      const { blob, extension } = await scene.recordVideo({
        background,
        watermark: hasWatermark(access.pro),
        onProgress: (fraction) => setRecording(fraction),
      });
      save(blob, videoFileName(device, extension));
      setStatus("Downloaded the video.");
    } catch (error) {
      console.error("[MockupStudio] video failed", error);
      setExportError(
        "The video didn't record. Keep this tab open while it records, or try Chrome or Edge.",
      );
    } finally {
      setRecording(null);
    }
  };

  const download = async (size: ExportSize) => {
    const scene = sceneRef.current;
    if (!scene) return;
    setExporting(size.id);
    setExportError(null);
    try {
      const blob = await scene.exportPng({
        width: size.width,
        height: size.height,
        background,
        watermark: hasWatermark(access.pro),
      });
      save(blob, exportFileName(device, size));
      setStatus(`Downloaded ${size.label}.`);
    } catch (error) {
      console.error("[MockupStudio] export failed", error);
      setExportError("The download didn't work. Try again, or try the smaller size.");
    } finally {
      setExporting(null);
    }
  };

  const customColor = background.kind === "solid" ? background.color : "#f3efe6";

  return (
    <section
      aria-label="Mockup Studio"
      className="grid grid-cols-[340px_minmax(0,1fr)] gap-6 max-[1023px]:grid-cols-1"
    >
      {cameFrom && returnLabel(cameFrom) ? (
        <p className="col-span-full flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-5 py-3 text-sm leading-5">
          <Link
            href={cameFrom}
            className="flex min-h-11 items-center gap-2 font-semibold underline underline-offset-2"
          >
            <span aria-hidden>←</span>
            {returnLabel(cameFrom)}
          </Link>
          <span className="text-[var(--cs-muted)]">
            {cameFrom.startsWith("/post-preview") || cameFrom.startsWith("/logo-pack")
              ? "Your work there is kept as you left it. Change it and open it here again."
              : "Turn the device, pick a background and download a picture or a video to share."}
          </span>
        </p>
      ) : null}

      {/* Controls */}
      <div className="flex flex-col gap-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5">
        <div>
          <p className={GROUP_LABEL}>Screenshot or screen recording</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label
              htmlFor={fileInputId}
              className={`${studioButtonClasses("secondary")} cursor-pointer focus-within:ring-2 focus-within:ring-[var(--cs-text)] focus-within:ring-offset-2`}
            >
              {fileName ? "Change file" : "Choose a file"}
              <input
                id={fileInputId}
                type="file"
                accept={SCREEN_MEDIA_TYPES.join(",")}
                className="sr-only"
                onChange={(event) => {
                  void onFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {fileName ? (
              <button
                type="button"
                className={studioButtonClasses("tertiary")}
                onClick={removeScreenshot}
              >
                Remove
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">
            {fileName ??
              "An image (PNG, JPG, WebP) or a video (MP4, WebM, MOV). It stays in your browser."}
          </p>
          {fileError ? (
            <p role="alert" className="mt-2 text-sm leading-5 font-medium text-[#b42318]">
              {fileError}
            </p>
          ) : null}
        </div>

        <Segmented label="Device" options={DEVICES} value={device} onChange={chooseDevice} />
        <div>
          <Segmented label="Angle" options={VIEWS} value={view} onChange={chooseView} />
          <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">
            Or drag the device to turn it, and scroll to zoom.
          </p>
        </div>

        <fieldset>
          <legend className={GROUP_LABEL}>Background</legend>
          {access.brandColors.length > 0 ? (
            <>
              <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">From your brand guide</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {access.brandColors.map((color) => {
                  const swatch: Background = { kind: "solid", color: color.hex };
                  return (
                    <Swatch
                      key={color.hex}
                      label={color.name ? `${color.name} (${color.hex})` : color.hex}
                      background={swatch}
                      selected={sameBackground(background, swatch)}
                      onSelect={() => setBackground(swatch)}
                    />
                  );
                })}
              </div>
              <p className="mt-3 text-sm leading-5 text-[var(--cs-muted)]">Presets</p>
            </>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {BACKGROUND_PRESETS.map((preset) => (
              <Swatch
                key={preset.id}
                label={preset.label}
                background={preset.background}
                selected={sameBackground(background, preset.background)}
                onSelect={() => setBackground(preset.background)}
              />
            ))}
          </div>
          <label
            htmlFor={colorInputId}
            className="mt-3 flex min-h-11 items-center gap-3 text-sm leading-5"
          >
            <input
              id={colorInputId}
              type="color"
              value={customColor}
              onChange={(event) => setBackground({ kind: "solid", color: event.target.value })}
              className="h-9 w-12 cursor-pointer rounded border border-[var(--cs-border)] bg-transparent p-0.5"
            />
            Pick any color
          </label>
        </fieldset>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-5 font-medium">
          <input
            type="checkbox"
            checked={shadow}
            onChange={(event) => toggleShadow(event.target.checked)}
            className="h-5 w-5 accent-[var(--cs-text)]"
          />
          Soft shadow under the device
        </label>

        <div>
          <Segmented label="Motion" options={MOTIONS} value={motion} onChange={chooseMotion} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!ready || motion === "none" || recording !== null}
              aria-pressed={playing}
              onClick={togglePlay}
              className={studioButtonClasses("secondary")}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <p className="min-w-[140px] flex-1 text-sm leading-5 text-[var(--cs-muted)]">
              {motion === "none"
                ? "Pick a motion to preview it."
                : "A PNG captures the moment you see."}
            </p>
          </div>
        </div>
      </div>

      {/* Stage and downloads */}
      <div className="flex min-w-0 flex-col gap-4">
        <div
          ref={stageRef}
          className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--cs-border)]"
          style={{ background: backgroundCss(background) }}
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`3D ${device} mockup${fileName ? ` showing ${fileName}` : ""}. Drag to turn it.`}
            className="absolute inset-0 h-full w-full touch-none"
          />
          {!ready && !failed ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-[var(--cs-muted)]">
              Loading the studio…
            </p>
          ) : null}
          {failed ? (
            <p
              role="alert"
              className="absolute inset-0 flex items-center justify-center bg-[var(--cs-surface)] p-6 text-center text-sm leading-6"
            >
              The 3D studio couldn&apos;t start in this browser. It needs WebGL; try a current
              version of Chrome, Edge, Firefox or Safari.
            </p>
          ) : null}
          {recording !== null ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--cs-surface)]/95 p-6 text-center">
              <p className="text-base font-semibold">Recording your video…</p>
              <div
                role="progressbar"
                aria-label="Recording progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(recording * 100)}
                className="h-2 w-64 max-w-full overflow-hidden rounded-full bg-[var(--cs-border)]"
              >
                <div
                  className="h-full rounded-full bg-[var(--cs-text)]"
                  style={{ width: `${Math.round(recording * 100)}%` }}
                />
              </div>
              <p className="text-sm text-[var(--cs-muted)]">
                It takes {recordSeconds} seconds. Keep this tab open.
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5">
          <div className="flex flex-wrap items-center gap-3">
            {EXPORT_SIZES.map((size) => {
              const locked = size.pro && !access.pro;
              return (
                <button
                  key={size.id}
                  type="button"
                  disabled={!ready || locked || exporting !== null || recording !== null}
                  onClick={() => void download(size)}
                  className={studioButtonClasses(size.pro ? "secondary" : "primary")}
                >
                  <DownloadIcon />
                  {exporting === size.id ? "Preparing…" : `Download ${size.label}`}
                  {size.pro ? (
                    <span className="rounded-full bg-[#f0edff] px-2 py-0.5 text-xs font-semibold text-[#4a3fa8]">
                      Pro
                    </span>
                  ) : null}
                </button>
              );
            })}
            <button
              type="button"
              disabled={
                !ready ||
                !access.pro ||
                (motion === "none" && !screenIsVideo) ||
                exporting !== null ||
                recording !== null
              }
              onClick={() => void downloadVideo()}
              className={studioButtonClasses("secondary")}
            >
              <DownloadIcon />
              Download video · 1080p
              <span className="rounded-full bg-[#f0edff] px-2 py-0.5 text-xs font-semibold text-[#4a3fa8]">
                Pro
              </span>
            </button>
          </div>
          {access.pro && motion === "none" && !screenIsVideo ? (
            <p className="mt-3 text-sm leading-6 text-[var(--cs-muted)]">
              Pick a motion, or put a video on the screen, to download a video.
            </p>
          ) : null}
          {access.pro &&
          (motion !== "none" || screenIsVideo) &&
          background.kind === "transparent" ? (
            <p className="mt-3 text-sm leading-6 text-[var(--cs-muted)]">
              Video can&apos;t be transparent, so it is recorded on white.
            </p>
          ) : null}
          <p className="mt-3 text-sm leading-6 text-[var(--cs-muted)]">
            {access.pro ? (
              "Your plan includes 4K and video, and your downloads carry no brandbite mark."
            ) : access.signedIn ? (
              "Free downloads are 1080p with a small brandbite mark. 4K, video and no mark are included with every brandbite plan."
            ) : (
              <>
                Free downloads are 1080p with a small brandbite mark. 4K, video and no mark are
                included with every brandbite plan.{" "}
                <Link href="/login" className="font-semibold text-[var(--cs-text)] underline">
                  Sign in
                </Link>{" "}
                if you have one.
              </>
            )}
          </p>
          {exportError ? (
            <p role="alert" className="mt-2 text-sm leading-5 font-medium text-[#b42318]">
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
