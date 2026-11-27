// -----------------------------------------------------------------------------
// @file: lib/newsletter/images.ts
// @purpose: Rules for a picture a plan customer uploads for a newsletter:
//           which files, how big, and where they are kept. An email shows a
//           picture only from a public web address, and that address has to
//           keep working for as long as the email sits in someone's inbox, so
//           these files are stored on the public asset domain and are not
//           cleaned up. No server imports; the page and the API share them.
// -----------------------------------------------------------------------------

/** Types mail apps show, and the extension each is stored under. (No WebP: Outlook on Windows drops it.) */
export const NEWSLETTER_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
};

export const NEWSLETTER_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
/** Twice the 600 pixel column, so pictures stay sharp on dense screens. */
export const NEWSLETTER_IMAGE_MAX_WIDTH = 1200;
/** Uploads a company can start in a day. */
export const NEWSLETTER_IMAGE_DAILY_LIMIT = 40;

/** What's wrong with a file about to be stored, in words for the customer; null when fine. */
export function newsletterImageProblem(file: { type: string; size: number }): string | null {
  if (!NEWSLETTER_IMAGE_TYPES[file.type]) return "Choose a PNG, JPG or GIF image.";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > NEWSLETTER_IMAGE_MAX_BYTES) {
    return "That image is over 2 MB, too heavy for an email. Use a smaller one.";
  }
  return null;
}

/** The folder that holds all of one company's newsletter pictures. */
export function newsletterImageFolder(companyId: string): string {
  return `newsletter-images/${companyId}/`;
}

/** Where a company's newsletter pictures live. */
export function newsletterImageKey(companyId: string, id: string, contentType: string): string {
  return `${newsletterImageFolder(companyId)}${id}.${NEWSLETTER_IMAGE_TYPES[contentType]}`;
}

/** Pictures shown in a company's library. */
export const NEWSLETTER_LIBRARY_MAX = 120;

/** Shapes a picture can be cut to before it is uploaded; `ratio` is width over height, null keeps its own. */
export const NEWSLETTER_IMAGE_SHAPES = [
  { id: "original", label: "As it is", ratio: null },
  { id: "wide", label: "Wide 2:1", ratio: 2 },
  { id: "screen", label: "16:9", ratio: 16 / 9 },
  { id: "photo", label: "3:2", ratio: 3 / 2 },
  { id: "classic", label: "4:3", ratio: 4 / 3 },
  { id: "square", label: "Square", ratio: 1 },
] as const;
export type NewsletterImageShape = (typeof NEWSLETTER_IMAGE_SHAPES)[number];

/** The size a cut picture is saved at: no wider than an email needs, never larger than what was cut. */
export function cutSize(cut: { width: number; height: number }): { width: number; height: number } {
  const scale = Math.min(1, NEWSLETTER_IMAGE_MAX_WIDTH / Math.max(1, cut.width));
  return {
    width: Math.max(1, Math.round(cut.width * scale)),
    height: Math.max(1, Math.round(cut.height * scale)),
  };
}
