// -----------------------------------------------------------------------------
// @file: lib/ai/input-images.ts
// @purpose: Rules for an image a customer hands to an AI tool (background
//           removal, upscaling): which files, how big, and where they are
//           kept. No server imports, so the page and the API share them.
// -----------------------------------------------------------------------------

/** Accepted image types and the extension each is stored under. */
export const AI_INPUT_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const AI_INPUT_IMAGE_ACCEPT = Object.keys(AI_INPUT_IMAGE_TYPES).join(",");

export const AI_INPUT_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

/** What's wrong with a picked file, in words for the customer; null when fine. */
export function aiInputImageProblem(file: { type: string; size: number }): string | null {
  if (!AI_INPUT_IMAGE_TYPES[file.type]) return "Choose a PNG, JPG or WebP image.";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > AI_INPUT_IMAGE_MAX_BYTES) return "That image is larger than 20 MB.";
  return null;
}

/** Where a company's uploaded AI inputs live. */
export function aiInputKey(companyId: string, id: string, contentType: string): string {
  return `ai-inputs/${companyId}/${id}.${AI_INPUT_IMAGE_TYPES[contentType]}`;
}

/** True when `key` is an AI input of exactly this company (nothing else may be read). */
export function isAiInputKeyOf(key: string, companyId: string): boolean {
  const prefix = `ai-inputs/${companyId}/`;
  return (
    !!companyId &&
    key.startsWith(prefix) &&
    /^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(key.slice(prefix.length))
  );
}
