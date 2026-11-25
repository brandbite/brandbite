// -----------------------------------------------------------------------------
// @file: lib/mockups/present.ts
// @purpose: "Show on a device": takes a picture from a request (a delivered
//           design, a brief attachment) to Mockup Studio, on the device its
//           shape suits. The picture is read in the browser and handed over
//           through lib/mockups/handoff.ts; nothing new is uploaded.
// -----------------------------------------------------------------------------

import { fetchPresignedUrl } from "@/lib/download-helpers";

import { canvasForHandoff, leaveForMockupStudio } from "./handoff";
import type { DeviceKind } from "./options";

/** The longest edge sent to the studio; more than a device screen can show. */
export const PRESENT_MAX_EDGE = 2400;

/** A tall picture goes on a phone, a wide one on a laptop, the rest on a tablet. */
export function deviceForShape(width: number, height: number): DeviceKind {
  const ratio = width / height;
  if (ratio <= 0.7) return "phone";
  if (ratio >= 1.3) return "laptop";
  return "tablet";
}

/** A size that fits inside `maxEdge` on its longest edge, never enlarged. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Leave a request's picture for Mockup Studio. Resolves to the device it will
 * open on; throws when the picture can't be read or handed over.
 */
export async function presentAssetOnDevice(asset: {
  id: string;
  name: string;
  returnTo: string;
}): Promise<DeviceKind> {
  const response = await fetch(await fetchPresignedUrl(asset.id));
  if (!response.ok) throw new Error(`The picture couldn't be loaded (${response.status}).`);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const size = fitWithin(bitmap.width, bitmap.height, PRESENT_MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't prepare the picture.");
    ctx.imageSmoothingQuality = "high";
    // White behind see-through pictures, as a screen would show them.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);

    const device = deviceForShape(bitmap.width, bitmap.height);
    const dataUrl = canvasForHandoff(canvas);
    if (
      !dataUrl ||
      !leaveForMockupStudio({ dataUrl, name: asset.name, device, returnTo: asset.returnTo })
    ) {
      throw new Error("The picture is too large to hand over.");
    }
    return device;
  } finally {
    bitmap.close();
  }
}
