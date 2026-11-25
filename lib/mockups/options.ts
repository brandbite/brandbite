// -----------------------------------------------------------------------------
// @file: lib/mockups/options.ts
// @purpose: Mockup Studio's choices as plain data (devices, views,
//           backgrounds, export sizes) and the small pure rules around them.
//           No three.js here, so it is safe to import anywhere and to test.
// -----------------------------------------------------------------------------

export type DeviceKind = "phone" | "tablet" | "laptop";

export const DEVICES: { id: DeviceKind; label: string; hint: string }[] = [
  { id: "phone", label: "Phone", hint: "Portrait screenshots" },
  { id: "tablet", label: "Tablet", hint: "Portrait screenshots" },
  { id: "laptop", label: "Laptop", hint: "Wide screenshots" },
];

export type ViewId = "front" | "left" | "right" | "hero";

/** Camera angles, in degrees: `azimuth` around the device, `polar` down from straight above. */
export const VIEWS: { id: ViewId; label: string; azimuth: number; polar: number }[] = [
  { id: "front", label: "Front", azimuth: 0, polar: 88 },
  { id: "left", label: "Left", azimuth: -28, polar: 82 },
  { id: "right", label: "Right", azimuth: 28, polar: 82 },
  { id: "hero", label: "From above", azimuth: 22, polar: 64 },
];

export type Background =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; from: string; to: string }
  | { kind: "transparent" };

export const BACKGROUND_PRESETS: { id: string; label: string; background: Background }[] = [
  { id: "cream", label: "Cream", background: { kind: "solid", color: "#f3efe6" } },
  { id: "white", label: "White", background: { kind: "solid", color: "#ffffff" } },
  { id: "ink", label: "Ink", background: { kind: "solid", color: "#17161a" } },
  { id: "peach", label: "Peach", background: { kind: "gradient", from: "#ffd9c7", to: "#fff3ea" } },
  { id: "dusk", label: "Dusk", background: { kind: "gradient", from: "#c9b9f5", to: "#f3d5e0" } },
  { id: "sage", label: "Sage", background: { kind: "gradient", from: "#cfe3cf", to: "#f1f0e2" } },
  { id: "none", label: "Transparent", background: { kind: "transparent" } },
];

export type ExportSize = {
  id: "hd" | "4k";
  label: string;
  width: number;
  height: number;
  pro: boolean;
};

/** Free exports are 1080p with a small mark; 4K is Pro and carries none. */
export const EXPORT_SIZES: ExportSize[] = [
  { id: "hd", label: "PNG · 1080p", width: 1920, height: 1080, pro: false },
  { id: "4k", label: "PNG · 4K", width: 3840, height: 2160, pro: true },
];

export type MotionId = "none" | "turn" | "float" | "slide";

export const MOTIONS: { id: MotionId; label: string }[] = [
  { id: "none", label: "Still" },
  { id: "turn", label: "Slow turn" },
  { id: "float", label: "Float" },
  { id: "slide", label: "Slide in" },
];

/** Videos are Pro: one loop of the chosen motion at 1080p. */
export const VIDEO = { width: 1920, height: 1080, seconds: 6, fps: 30, bitsPerSecond: 12_000_000 };

/**
 * Where the device is at a moment of a motion. Angles are in radians; `lift`
 * is in device heights (0.1 = a tenth of the device's height, upward).
 */
export type Pose = { rotateX: number; rotateY: number; lift: number };

const REST: Pose = { rotateX: 0, rotateY: 0, lift: 0 };
const TURN = Math.PI * 2;

/**
 * The pose `seconds` into a motion. Every motion comes back to where it
 * started after VIDEO.seconds, so a recording loops without a jump
 * ("Slide in" starts off-screen again, which is its point).
 */
export function motionPose(id: MotionId, seconds: number): Pose {
  const loop = VIDEO.seconds;
  const t = ((seconds % loop) + loop) % loop;
  switch (id) {
    case "none":
      return REST;
    case "turn":
      return { rotateX: 0, rotateY: 0.45 * Math.sin((TURN * t) / loop), lift: 0 };
    case "float":
      return {
        rotateX: 0.04 * Math.sin((TURN * t) / 3 + Math.PI / 2) - 0.04,
        rotateY: 0.08 * Math.sin((TURN * t) / loop),
        lift: 0.025 * Math.sin((TURN * t) / 3),
      };
    case "slide": {
      // Arrives in the first 1.2 seconds, easing out, then rests.
      const arrive = Math.min(t / 1.2, 1);
      const left = (1 - arrive) ** 3;
      return { rotateX: 0, rotateY: -0.5 * left, lift: -1.25 * left };
    }
  }
}

/** The first video format this browser can record, MP4 before WebM; null when it can record none. */
export function videoType(
  isSupported: (mime: string) => boolean,
): { mime: string; extension: "mp4" | "webm" } | null {
  const candidates: { mime: string; extension: "mp4" | "webm" }[] = [
    { mime: "video/mp4;codecs=avc1.640028", extension: "mp4" },
    { mime: "video/mp4", extension: "mp4" },
    { mime: "video/webm;codecs=vp9", extension: "webm" },
    { mime: "video/webm", extension: "webm" },
  ];
  return candidates.find((candidate) => isSupported(candidate.mime)) ?? null;
}

export function videoFileName(device: DeviceKind, extension: string): string {
  return `brandbite-mockup-${device}-1080p.${extension}`;
}

export const WATERMARK_TEXT = "made with brandbite";

/** What can go on the screen: a screenshot or a screen recording, with the largest file of each. */
export const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const SCREENSHOT_MAX_BYTES = 15 * 1024 * 1024;
export const SCREEN_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const SCREEN_VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const SCREEN_MEDIA_TYPES = [...SCREENSHOT_TYPES, ...SCREEN_VIDEO_TYPES];

export function screenMediaKind(file: { type: string }): "image" | "video" | null {
  if (SCREENSHOT_TYPES.includes(file.type)) return "image";
  if (SCREEN_VIDEO_TYPES.includes(file.type)) return "video";
  return null;
}

/** Why a chosen file can't be used, or null when it can. */
export function screenshotProblem(file: { type: string; size: number }): string | null {
  const kind = screenMediaKind(file);
  if (!kind) return "Use a PNG, JPG or WebP image, or an MP4, WebM or MOV video.";
  if (kind === "image" && file.size > SCREENSHOT_MAX_BYTES) {
    return "That image is over 15 MB. Use a smaller one.";
  }
  if (kind === "video" && file.size > SCREEN_VIDEO_MAX_BYTES) {
    return "That video is over 200 MB. Use a shorter or smaller one.";
  }
  return null;
}

/**
 * How long a downloaded video runs. With a screen recording on the device it
 * follows the recording, within 3 to 20 seconds; otherwise it is one loop of
 * the motion.
 */
export function recordingSeconds(screenVideoSeconds: number | null): number {
  if (screenVideoSeconds == null || !Number.isFinite(screenVideoSeconds)) return VIDEO.seconds;
  return Math.min(Math.max(screenVideoSeconds, 3), 20);
}

/** Whether an export leaves the studio with the brandbite mark on it. */
export function hasWatermark(pro: boolean): boolean {
  return !pro;
}

/** The CSS for a background, for the live preview behind the 3D canvas. */
export function backgroundCss(background: Background): string {
  switch (background.kind) {
    case "solid":
      return background.color;
    case "gradient":
      return `linear-gradient(135deg, ${background.from}, ${background.to})`;
    case "transparent":
      // The usual checkerboard that says "nothing here".
      return "repeating-conic-gradient(#e6e3dc 0% 25%, #f7f6f2 0% 50%) 50% / 24px 24px";
  }
}

/**
 * How to show an image of one shape on a screen of another without
 * stretching it: fill the screen, cut what doesn't fit. Wide images are cut
 * evenly left and right; tall ones keep their top (where an app's header is).
 * Returns texture `repeat` and `offset` in 0..1.
 */
export function coverFit(
  imageAspect: number,
  screenAspect: number,
): { repeatX: number; repeatY: number; offsetX: number; offsetY: number } {
  if (!(imageAspect > 0) || !(screenAspect > 0)) {
    return { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 };
  }
  if (imageAspect > screenAspect) {
    const repeatX = screenAspect / imageAspect;
    return { repeatX, repeatY: 1, offsetX: (1 - repeatX) / 2, offsetY: 0 };
  }
  const repeatY = imageAspect / screenAspect;
  return { repeatX: 1, repeatY, offsetX: 0, offsetY: 1 - repeatY };
}

export function exportFileName(device: DeviceKind, size: ExportSize): string {
  return `brandbite-mockup-${device}-${size.id === "4k" ? "4k" : "1080p"}.png`;
}
