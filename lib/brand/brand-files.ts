// -----------------------------------------------------------------------------
// @file: lib/brand/brand-files.ts
// @purpose: Rules for files in a brand guide: which types are accepted, how
//           big they may be, where they live in R2 and which ones a browser
//           can preview. No server imports, so the page checks a file with
//           the same rules before uploading.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const BRAND_ASSET_KINDS = [
  "LOGO_PRIMARY",
  "LOGO_SECONDARY",
  "LOGO_ICON",
  "LOGO_WORDMARK",
  "GUIDELINES",
  "OTHER",
] as const;
export type BrandAssetKindValue = (typeof BRAND_ASSET_KINDS)[number];

export const BRAND_ASSET_BACKGROUNDS = ["ANY", "LIGHT", "DARK"] as const;
export type BrandAssetBackgroundValue = (typeof BRAND_ASSET_BACKGROUNDS)[number];

export const BRAND_ASSET_KIND_LABELS: Record<BrandAssetKindValue, string> = {
  LOGO_PRIMARY: "Primary logo",
  LOGO_SECONDARY: "Secondary logo",
  LOGO_ICON: "Icon",
  LOGO_WORDMARK: "Wordmark",
  GUIDELINES: "Brand guidelines",
  OTHER: "Other",
};

export const BRAND_ASSET_BACKGROUND_LABELS: Record<BrandAssetBackgroundValue, string> = {
  ANY: "Any background",
  LIGHT: "For light backgrounds",
  DARK: "For dark backgrounds",
};

/** Vector and layered design files, plus the image and document types around them. */
export const BRAND_FILE_EXTENSIONS = [
  "svg",
  "ai",
  "eps",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "psd",
  "fig",
  "sketch",
  "indd",
  "zip",
] as const;

export const BRAND_FILE_ACCEPT = BRAND_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(",");
export const BRAND_FILE_TYPES_LABEL =
  "SVG, AI, EPS, PDF, PNG, JPG, WebP, PSD, Fig, Sketch, INDD, ZIP";

export const BRAND_FILE_MAX_BYTES = 200 * 1024 * 1024;
export const BRAND_FILE_MAX_COUNT = 60;

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function isBrandFileAllowed(name: string): boolean {
  return (BRAND_FILE_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

/** Files a browser can show in an <img>. SVGs are only ever shown that way. */
export function isBrandFilePreviewable(name: string): boolean {
  return ["svg", "png", "jpg", "jpeg", "webp"].includes(fileExtension(name));
}

/** Why a file can't be uploaded, or null when it can. */
export function brandFileProblem(file: { name: string; size: number }): string | null {
  if (!isBrandFileAllowed(file.name)) {
    return `That file type isn't supported. Allowed: ${BRAND_FILE_TYPES_LABEL}.`;
  }
  if (file.size <= 0) return "That file is empty.";
  if (file.size > BRAND_FILE_MAX_BYTES) return "Brand files can be up to 200 MB each.";
  return null;
}

/** R2 object key for a brand file. */
export function brandAssetKey(brandId: string, assetId: string, name: string): string {
  const safe = name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  return `brands/${brandId}/${assetId}_${safe || "file"}`;
}

/**
 * The Content-Type to store and serve a brand file with. Taken from the
 * extension, never from the browser, so a file can't be stored as something
 * a browser would run.
 */
export function brandFileContentType(name: string): string {
  switch (fileExtension(name)) {
    case "svg":
      return "image/svg+xml";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}
