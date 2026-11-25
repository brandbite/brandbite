// -----------------------------------------------------------------------------
// @file: lib/mockups/handoff.ts
// @purpose: Lets another hub tool open Mockup Studio with a picture already on
//           the device: the tool leaves the picture here, goes to /mockups,
//           and the studio picks it up once. Kept in the browser tab's own
//           storage; nothing is uploaded.
// -----------------------------------------------------------------------------

import type { DeviceKind } from "./options";

const KEY = "bb.mockup.handoff";
/** A tab's storage is small; a picture past this is sent smaller or not at all. */
export const HANDOFF_MAX_CHARS = 4_000_000;

/** The tools that hand pictures over, and what the way back is called. */
const TOOL_RETURNS: Record<string, string> = {
  "/post-preview": "Back to Post and ad preview",
  "/logo-pack": "Back to Logo pack",
};

/** A page inside a dashboard (a request, the board): letters, digits, dashes and slashes only. */
const DASHBOARD_PATH = /^\/(customer|creative|admin)(\/[A-Za-z0-9_-]{1,64}){1,4}$/;

/**
 * What the way back to `path` is called, or null when the studio should not
 * link there. Only this site's own tool and dashboard pages qualify, so a
 * note left in the tab's storage can never send someone elsewhere.
 */
export function returnLabel(path: string | null | undefined): string | null {
  if (!path) return null;
  if (Object.hasOwn(TOOL_RETURNS, path)) return TOOL_RETURNS[path];
  if (DASHBOARD_PATH.test(path)) {
    return path.includes("/tickets/") ? "Back to the request" : "Back to where you were";
  }
  return null;
}

export type MockupHandoff = {
  /** The picture as a data: address. */
  dataUrl: string;
  name: string;
  device: DeviceKind;
  /** A background color to start with, when the tool has one in mind. */
  background?: string;
  /** The tool the picture came from, so the studio can offer the way back. */
  returnTo?: string;
};

function isHandoff(value: unknown): value is MockupHandoff {
  const v = value as MockupHandoff | null;
  return (
    !!v &&
    typeof v.dataUrl === "string" &&
    v.dataUrl.startsWith("data:image/") &&
    typeof v.name === "string" &&
    ["phone", "tablet", "laptop"].includes(v.device) &&
    (v.background === undefined || /^#[0-9a-f]{6}$/i.test(v.background)) &&
    (v.returnTo === undefined || returnLabel(v.returnTo) !== null)
  );
}

/** Leave a picture for the studio. False when it is too large or storage is unavailable. */
export function leaveForMockupStudio(handoff: MockupHandoff): boolean {
  if (handoff.dataUrl.length > HANDOFF_MAX_CHARS || !isHandoff(handoff)) return false;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(handoff));
    return true;
  } catch {
    return false;
  }
}

/** The picture another tool left, once: reading it clears it. */
export function takeMockupHandoff(): MockupHandoff | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const parsed: unknown = JSON.parse(raw);
    return isHandoff(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** A canvas as a data: address that fits the handoff: PNG if it is small enough, else JPG. */
export function canvasForHandoff(canvas: HTMLCanvasElement): string | null {
  const png = canvas.toDataURL("image/png");
  if (png.length <= HANDOFF_MAX_CHARS) return png;
  const jpg = canvas.toDataURL("image/jpeg", 0.9);
  return jpg.length <= HANDOFF_MAX_CHARS ? jpg : null;
}

/** A data: address as a file-like blob, read here rather than fetched (the site's policy blocks fetching data:). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const type = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/png";
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes.buffer as ArrayBuffer], { type });
}
