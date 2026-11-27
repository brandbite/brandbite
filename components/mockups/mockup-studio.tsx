// -----------------------------------------------------------------------------
// @file: components/mockups/mockup-studio.tsx
// @purpose: Mockup Studio in three steps: add a screenshot or a screen
//           recording, compose it on a 3D phone, tablet or laptop (angle,
//           scene, shadow, motion), then export a PNG or a video. Everything
//           runs in the browser; the file is never uploaded.
//           Free downloads are 1080p with a small brandbite mark; customers on
//           a plan also get 4K without it.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { CloseIcon, DownloadIcon, UploadIcon } from "@/components/colors/studio/icons";
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
import { StepHeading } from "@/components/tools/tool-page";
import type { ToolEntitlement } from "@/lib/tools/entitlement";

type Access = ToolEntitlement & { brandColors: { hex: string; name: string | null }[] };

const SIGNED_OUT: Access = { signedIn: false, pro: false, reason: "signedOut", brandColors: [] };

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-[var(--cs-text)] focus-visible:ring-offset-2 focus-visible:outline-none";

const GROUP_LABEL = "text-sm leading-5 font-semibold";

function sameBackground(a: Background, b: Background): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const PANEL =
  "rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5";
const HINT = "text-sm leading-5 text-[var(--cs-muted)]";
const PLAN_BADGE =
  "rounded-full bg-[var(--cs-soft)] px-2.5 py-0.5 text-xs leading-5 font-semibold text-[var(--cs-soft-text)]";
const FREE_BADGE =
  "rounded-full bg-[#E3F1E4] px-2.5 py-0.5 text-xs leading-5 font-semibold text-[#14532D]";

const DEVICE_ICONS: Record<DeviceKind, string> = {
  phone: "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2",
  tablet: "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2",
  laptop: "M5 5h14v10H5zM2 19h20",
};

function Glyph({ d }: { d: string }) {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  icons,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  icons?: Record<T, string>;
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
            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] border px-3 text-sm font-semibold whitespace-nowrap transition-colors ${FOCUS} ${
              option.id === value
                ? "border-[var(--cs-selected)] bg-[var(--cs-soft)]"
                : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]"
            }`}
          >
            {icons ? <Glyph d={icons[option.id]} /> : null}
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
      className={`h-9 w-9 rounded-full border ${FOCUS} ${
        selected
          ? "border-[var(--cs-selected)] ring-2 ring-[var(--cs-selected)] ring-offset-2"
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
  const hexInputId = useId();
  const motionId = useId();

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [device, setDevice] = useState<DeviceKind>("phone");
  const [view, setView] = useState<ViewId>("left");
  const [background, setBackground] = useState<Background>(BACKGROUND_PRESETS[0].background);
  const [shadow, setShadow] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  /** Size and kind of the file on the screen, and a small picture of it when it is an image. */
  const [fileDetail, setFileDetail] = useState("");
  const [thumb, setThumb] = useState<string | null>(null);
  const thumbRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);
  /** The hex code as it is being typed; null while the field follows the background. */
  const [hexDraft, setHexDraft] = useState<string | null>(null);
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

  /** Show a small picture of the file; lets go of the one before it. */
  const showThumb = useCallback((url: string | null) => {
    if (thumbRef.current?.startsWith("blob:")) URL.revokeObjectURL(thumbRef.current);
    thumbRef.current = url;
    setThumb(url);
  }, []);
  useEffect(() => () => showThumb(null), [showThumb]);

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
            setFileDetail("Image");
            showThumb(handoff.dataUrl);
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
  }, [showThumb]);

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
          showThumb(null);
        } else {
          const image = await createImageBitmap(file, { imageOrientation: "flipY" });
          sceneRef.current?.setScreenshot(image);
          releaseScreenVideo();
          setScreenIsVideo(false);
          showThumb(URL.createObjectURL(file));
        }
        setFileDetail(
          `${formatSize(file.size)} · ${(file.name.split(".").pop() ?? "").toUpperCase() || "File"}`,
        );
        setFileName(file.name);
        setFileError(null);
        setStatus(`${file.name} is on the screen.`);
      } catch {
        setFileError("We couldn't read that file. Try another one.");
      }
    },
    [releaseScreenVideo, showThumb],
  );

  const removeScreenshot = () => {
    sceneRef.current?.setScreenshot(null);
    releaseScreenVideo();
    setScreenIsVideo(false);
    setFileName(null);
    showThumb(null);
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
  const sceneName =
    background.kind === "solid"
      ? ""
      : (BACKGROUND_PRESETS.find((preset) => sameBackground(preset.background, background))
          ?.label ?? "");
  const busy = exporting !== null || recording !== null;
  const canRecord = motion !== "none" || screenIsVideo;

  const filePicker = (label: string, className: string, icon?: boolean) => (
    <label
      htmlFor={fileInputId}
      className={`${className} cursor-pointer focus-within:ring-2 focus-within:ring-[var(--cs-text)] focus-within:ring-offset-2`}
    >
      {icon ? (
        <Glyph d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4" />
      ) : null}
      {label}
    </label>
  );

  return (
    <section aria-label="Mockup Studio" className="flex flex-col gap-8">
      {cameFrom && returnLabel(cameFrom) ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-5 py-3 text-sm leading-5">
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

      <div>
        <StepHeading
          number={1}
          title="Source"
          hint="Add the screenshot or screen recording you want to show."
        />
        <div className={`mt-4 ${PANEL} ${fileName ? "" : "!p-3"}`}>
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
          {fileName ? (
            <>
              <div className="flex flex-wrap items-center gap-4">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a file on the visitor's device
                  <img
                    src={thumb}
                    alt=""
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] shrink-0 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-background)] object-cover object-top"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
                  >
                    <Glyph d="M4 5h16v14H4zM10 9l5 3-5 3z" />
                  </span>
                )}
                <div className="min-w-[160px] flex-1">
                  <p className="truncate text-base leading-6 font-semibold">{fileName}</p>
                  <p className={HINT}>{fileDetail}</p>
                </div>
                {filePicker("Replace", studioButtonClasses("secondary"), true)}
                <button
                  type="button"
                  aria-label={`Remove ${fileName}`}
                  onClick={removeScreenshot}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] hover:bg-[var(--cs-background)] ${FOCUS}`}
                >
                  <CloseIcon />
                </button>
              </div>
              <p className={`mt-4 border-t border-[var(--cs-border)] pt-3 ${HINT}`}>
                Supported: PNG, JPG, WebP, MP4, WebM, MOV.
              </p>
            </>
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
                void onFile(event.dataTransfer.files[0]);
              }}
              className={`flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-4 py-7 text-center transition-colors ${
                dragging
                  ? "border-[var(--cs-selected)] bg-[var(--cs-soft)]"
                  : "border-[#B9B5AE] hover:border-[var(--cs-text)]"
              }`}
            >
              <span
                aria-hidden
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
              >
                <UploadIcon />
              </span>
              <span className="mt-3 text-base leading-6 font-semibold">
                Drag and drop your screen here
              </span>
              <span className={HINT}>or click to choose a file</span>
              <span className={`mt-3 ${studioButtonClasses("secondary")}`}>Choose a file</span>
              <span className={`mt-3 ${HINT}`}>
                An image (PNG, JPG, WebP) or a video (MP4, WebM, MOV). It stays in your browser.
              </span>
            </label>
          )}
          {fileError ? (
            <p role="alert" className="mt-3 text-sm leading-5 font-medium text-[#b42318]">
              {fileError}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <StepHeading
          number={2}
          title="Compose"
          hint="Choose your device, angle and scene, and preview your mockup."
        />
        <div className="mt-4 grid grid-cols-[380px_minmax(0,1fr)] items-start gap-6 max-[1023px]:grid-cols-1">
          <div className={`flex flex-col gap-6 ${PANEL} max-[1023px]:order-2`}>
            <Segmented
              label="Device"
              options={DEVICES}
              value={device}
              onChange={chooseDevice}
              icons={DEVICE_ICONS}
            />
            <Segmented label="Angle" options={VIEWS} value={view} onChange={chooseView} />

            <fieldset>
              <legend className={GROUP_LABEL}>Scene</legend>
              {access.brandColors.length > 0 ? (
                <>
                  <p className={`mt-2 ${HINT}`}>From your brand guide</p>
                  <div className="mt-2 flex flex-wrap gap-2.5">
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
                  <p className={`mt-3 ${HINT}`}>Presets</p>
                </>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2.5">
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
              <div className="mt-3 flex h-11 items-center gap-2 rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] pr-3 pl-1.5 focus-within:ring-2 focus-within:ring-[var(--cs-text)] focus-within:ring-offset-2">
                <input
                  id={colorInputId}
                  type="color"
                  aria-label="Pick any color"
                  value={customColor}
                  onChange={(event) => {
                    setHexDraft(null);
                    setBackground({ kind: "solid", color: event.target.value });
                  }}
                  className="h-8 w-9 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <label htmlFor={hexInputId} className="sr-only">
                  Color code
                </label>
                <input
                  id={hexInputId}
                  type="text"
                  spellCheck={false}
                  maxLength={7}
                  placeholder={sceneName || "#F3EFE6"}
                  value={
                    hexDraft ?? (background.kind === "solid" ? background.color.toUpperCase() : "")
                  }
                  onChange={(event) => {
                    const typed = event.target.value.trim();
                    setHexDraft(typed);
                    const hex = typed.startsWith("#") ? typed : `#${typed}`;
                    if (/^#[0-9a-f]{6}$/i.test(hex)) {
                      setBackground({ kind: "solid", color: hex.toLowerCase() });
                    }
                  }}
                  onBlur={() => setHexDraft(null)}
                  className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </fieldset>

            <div className="flex min-h-11 items-center justify-between gap-3 border-y border-[var(--cs-border)] py-2">
              <span id={`${motionId}-shadow`} className={GROUP_LABEL}>
                Shadow
              </span>
              <span className="flex items-center gap-2 text-sm leading-5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={shadow}
                  aria-labelledby={`${motionId}-shadow`}
                  onClick={() => toggleShadow(!shadow)}
                  className={`relative h-7 w-12 rounded-full transition-colors ${FOCUS} ${
                    shadow ? "bg-[var(--cs-selected)]" : "bg-[#C9C6C0]"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform ${
                      shadow ? "translate-x-5" : ""
                    }`}
                  />
                </button>
                <span aria-hidden className="w-6">
                  {shadow ? "On" : "Off"}
                </span>
              </span>
            </div>

            <div>
              <label htmlFor={motionId} className={`block ${GROUP_LABEL}`}>
                Motion
              </label>
              <div className="mt-2 flex gap-2">
                <select
                  id={motionId}
                  value={motion}
                  onChange={(event) => chooseMotion(event.target.value as MotionId)}
                  className={`h-11 min-w-0 flex-1 rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm ${FOCUS}`}
                >
                  {MOTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!ready || motion === "none" || recording !== null}
                  aria-pressed={playing}
                  onClick={togglePlay}
                  className={studioButtonClasses("secondary")}
                >
                  {playing ? "Pause" : "Play"}
                </button>
              </div>
              <p className={`mt-2 ${HINT}`}>
                {motion === "none"
                  ? "Pick a motion to preview it."
                  : "A PNG captures the moment you see."}
              </p>
            </div>
          </div>

          <div className={`${PANEL} !p-2 min-[1024px]:sticky min-[1024px]:top-6`}>
            <div
              ref={stageRef}
              className="relative aspect-video w-full overflow-hidden rounded-xl"
              style={{ background: backgroundCss(background) }}
            >
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`3D ${device} mockup${fileName ? ` showing ${fileName}` : ""}. Drag to turn it.`}
                className="absolute inset-0 h-full w-full touch-none"
              />
              {ready && recording === null ? (
                <>
                  <button
                    type="button"
                    onClick={() => chooseView(view)}
                    className={`absolute top-3 right-3 flex h-10 items-center gap-2 rounded-[10px] bg-white px-3 text-sm font-semibold text-[#242528] shadow-[0_2px_8px_rgba(36,37,40,0.14)] hover:bg-[#f7f5f2] ${FOCUS}`}
                  >
                    <Glyph d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4" />
                    Reset view
                  </button>
                  <p className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[10px] bg-white/85 px-3 py-1.5 text-sm leading-5 whitespace-nowrap text-[#242528] max-[479px]:hidden">
                    <Glyph d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
                    Drag to rotate · Scroll to zoom
                  </p>
                </>
              ) : null}
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
                      className="h-full rounded-full bg-[var(--cs-selected)]"
                      style={{ width: `${Math.round(recording * 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-[var(--cs-muted)]">
                    It takes {recordSeconds} seconds. Keep this tab open.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div>
        <StepHeading
          number={3}
          title="Export"
          hint="Download your mockup as an image or a video."
        />
        <div className={`mt-4 ${PANEL}`}>
          <div className="grid grid-cols-3 gap-3 max-[899px]:grid-cols-1">
            {EXPORT_SIZES.map((size) => {
              const locked = size.pro && !access.pro;
              return (
                <button
                  key={size.id}
                  type="button"
                  disabled={!ready || locked || busy}
                  onClick={() => void download(size)}
                  className={`${studioButtonClasses(size.pro ? "secondary" : "primary")} !h-14 !justify-start !px-4 !text-base`}
                >
                  <DownloadIcon />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {exporting === size.id ? "Preparing…" : `Download ${size.label}`}
                  </span>
                  {access.pro ? null : size.pro ? (
                    <span className={PLAN_BADGE}>Plan</span>
                  ) : (
                    <span className={FREE_BADGE}>Free</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              disabled={!ready || !access.pro || !canRecord || busy}
              onClick={() => void downloadVideo()}
              className={`${studioButtonClasses("secondary")} !h-14 !justify-start !px-4 !text-base`}
            >
              <Glyph d="M4 5h16v14H4zM10 9l5 3-5 3z" />
              <span className="min-w-0 flex-1 truncate text-left">Download video · 1080p</span>
              {access.pro ? null : <span className={PLAN_BADGE}>Plan</span>}
            </button>
          </div>
          {access.pro && !canRecord ? (
            <p className={`mt-3 ${HINT}`}>
              Pick a motion, or put a video on the screen, to download a video.
            </p>
          ) : null}
          {access.pro && canRecord && background.kind === "transparent" ? (
            <p className={`mt-3 ${HINT}`}>
              Video can&apos;t be transparent, so it is recorded on white.
            </p>
          ) : null}
          <p className={`mt-3 flex items-start gap-2 ${HINT}`}>
            <span aria-hidden className="mt-px">
              <Glyph d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5M12 8h.01" />
            </span>
            <span>
              {access.pro ? (
                "Your plan includes 4K and video, and your downloads carry no brandbite mark."
              ) : access.signedIn ? (
                "Free exports are 1080p with a small brandbite mark. 4K, video and no mark are included with every brandbite plan."
              ) : (
                <>
                  Free exports are 1080p with a small brandbite mark. 4K, video and no mark are
                  included with every brandbite plan.{" "}
                  <Link href="/login" className="font-semibold text-[var(--cs-text)] underline">
                    Sign in
                  </Link>{" "}
                  if you have one.
                </>
              )}
            </span>
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
