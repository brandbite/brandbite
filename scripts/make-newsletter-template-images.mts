// -----------------------------------------------------------------------------
// @file: scripts/make-newsletter-template-images.mts
// @purpose: Makes the pictures the newsletter builder's templates start with
//           (public/newsletter/templates/<name>.jpg) with the image model.
//           They are stand-ins a customer replaces with their own; all share
//           one art direction so the gallery reads as one set. Each run costs
//           money per picture, so it only makes the ones named, or the ones
//           that are missing:
//             npx tsx --env-file=.env scripts/make-newsletter-template-images.mts [name ...]
// -----------------------------------------------------------------------------

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { generateImage } from "@/lib/ai/openai";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "newsletter",
  "templates",
);

const LOOK =
  "Editorial still-life photograph in soft natural daylight. Warm neutral palette of cream, sand and pale stone with a single accent of burnt orange. Calm, minimal composition with generous empty space and gentle shadows. Photorealistic, high detail. No people, no hands, no text, no letters, no numbers, no logos, no watermark.";

/** Shapes the pictures are cut to, from the model's 3:2 picture. */
const SHAPES = {
  hero: { width: 1200, height: 600 },
  story: { width: 720, height: 480 },
  product: { width: 880, height: 660 },
  video: { width: 1200, height: 675 },
} as const;

const PICTURES: { name: string; shape: keyof typeof SHAPES; subject: string }[] = [
  {
    name: "offer",
    shape: "hero",
    subject:
      "Three gift boxes wrapped in cream paper, one tied with a burnt orange ribbon, on a linen-covered table.",
  },
  {
    name: "welcome",
    shape: "hero",
    subject:
      "A bright desk by a window with a cup of coffee, a small green plant and an open blank notebook, morning light.",
  },
  {
    name: "invitation",
    shape: "hero",
    subject:
      "An airy event room with rows of empty wooden chairs and a large vase of dried flowers, sunlight falling across the floor.",
  },
  {
    name: "launch",
    shape: "hero",
    subject:
      "A single sculptural ceramic object on a round stone plinth against a plain cream backdrop, like a product reveal.",
  },
  {
    name: "case-study",
    shape: "hero",
    subject:
      "A tidy design studio table seen from above: fabric swatches, a ruler, pencils and a closed laptop, neatly arranged.",
  },
  {
    name: "video",
    shape: "video",
    subject:
      "A film camera on a tripod in a bright studio with a softbox light and a plain backdrop, ready for a recording.",
  },
  {
    name: "story-1",
    shape: "story",
    subject: "A stack of magazines with blank covers beside a cup of coffee on a wooden table.",
  },
  {
    name: "story-2",
    shape: "story",
    subject: "A potted plant on a sunny windowsill with a linen curtain.",
  },
  {
    name: "story-3",
    shape: "story",
    subject: "A cloth-covered notebook and a pen on a stone surface, seen from above.",
  },
  {
    name: "product-1",
    shape: "product",
    subject: "A handmade ceramic mug with a speckled cream glaze on a plain cream backdrop.",
  },
  {
    name: "product-2",
    shape: "product",
    subject: "A candle in an amber glass jar with a blank label, on a plain cream backdrop.",
  },
  {
    name: "product-3",
    shape: "product",
    subject: "A plain natural canvas tote bag standing upright on a plain cream backdrop.",
  },
  {
    name: "product-4",
    shape: "product",
    subject: "A hardcover notebook bound in burnt orange cloth, closed, on a plain cream backdrop.",
  },
];

const wanted = process.argv.slice(2);
await mkdir(OUT, { recursive: true });

for (const picture of PICTURES) {
  const file = join(OUT, `${picture.name}.jpg`);
  if (wanted.length ? !wanted.includes(picture.name) : existsSync(file)) continue;
  const made = await generateImage(`${picture.subject} ${LOOK}`, { size: "1536x1024" });
  await sharp(made.bytes)
    .resize({ ...SHAPES[picture.shape], fit: "cover", position: "centre" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(file);
  console.log(`made ${picture.name}.jpg`);
}
