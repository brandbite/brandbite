// -----------------------------------------------------------------------------
// @file: lib/image-tools/render.ts
// @purpose: Draw an image at a new size and shape and hand back a file, in
//           the browser. Shared by the social resizer and the image converter.
// -----------------------------------------------------------------------------

import JSZip from "jszip";

import {
  containTarget,
  cropSource,
  needsBackdrop,
  outputFormat,
  uniqueNames,
  type CropAdjust,
  type OutputFormat,
} from "./fit";

export type FitMode = "cover" | "contain";

export async function renderImage(
  image: ImageBitmap,
  {
    width,
    height,
    mode,
    format,
    quality,
    backdrop,
    crop,
  }: {
    width: number;
    height: number;
    mode: FitMode;
    format: OutputFormat;
    /** 0..1; ignored for PNG. */
    quality: number;
    /** Color behind the image: around it in "contain", under see-through areas for JPG. */
    backdrop: string | null;
    /** Which part to keep in "cover"; the middle when left out. */
    crop?: CropAdjust;
  },
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the image.");
  ctx.imageSmoothingQuality = "high";

  const fill = backdrop ?? (needsBackdrop(format) ? "#ffffff" : null);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
  }

  if (mode === "cover") {
    const source = cropSource(image.width, image.height, width, height, crop);
    ctx.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, width, height);
  } else {
    const target = containTarget(image.width, image.height, width, height);
    ctx.drawImage(image, target.x, target.y, target.width, target.height);
  }

  const { mime } = outputFormat(format);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // A browser that can't write a format quietly hands back a PNG instead.
        if (!blob) reject(new Error("Could not create the image."));
        else if (blob.type !== mime) reject(new Error("This browser can't save that format."));
        else resolve(blob);
      },
      mime,
      quality,
    );
  });
}

/** One zip from several files; names that repeat are numbered. */
export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  const names = uniqueNames(files.map((file) => file.name));
  files.forEach((file, index) => zip.file(names[index], file.blob));
  return zip.generateAsync({ type: "blob" });
}

/** Hand a file to the browser's download. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Give the download a moment to start before the address goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
