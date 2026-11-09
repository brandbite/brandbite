// Builds public/templates/brandbite-brand-guidelines-template.pptx
const pptxgen = require("pptxgenjs");

const SKILL = process.argv[3];
const { applyTheme } = require(`${SKILL}/scripts/apply_theme.js`);
const OUT = process.argv[2];

const THEME = {
  name: "Brand guidelines",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: "1F2024", lt1: "FFFFFF", dk2: "2B2D33", lt2: "F4F4F6",
    accent1: "FF6426", accent2: "3B5BDB", accent3: "2F9E44", accent4: "F59F00",
    accent5: "868E96", accent6: "E9ECEF", hlink: "3B5BDB", folHlink: "7048E8",
  },
};
// Hex copies for options that only take hex.
const HEX = { line: "D9DBE0", muted: "6C6D75" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.author = "brandbite";
pres.title = "Brand guidelines template";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

const W = 13.33;
const M = 0.7;
const FOOT = "Free template by brandbite · brandbite.studio/brand-kit";

// --- Layouts --------------------------------------------------------------
pres.defineSlideMaster({
  title: "COVER",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.4, w: 8.6, h: 1.6, fontSize: 44, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "[Brand name] brand guidelines" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.2, w: 8.6, h: 0.8, fontSize: 18, color: C.background2, align: "left", margin: 0 }, text: "Version 1.0 · [Month year]" } },
    { text: { text: FOOT, options: { x: M, y: 6.8, w: 8, h: 0.3, fontSize: 10, color: C.accent5, margin: 0 } } },
  ],
});

pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  margin: [0.6, M, 0.6, M],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.45, w: W - 2 * M, h: 0.8, fontSize: 32, bold: true, color: C.text1, valign: "top", align: "left", margin: 0 }, text: "Title" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 1.2, w: W - 2 * M, h: 0.5, fontSize: 14, color: C.accent5, align: "left", margin: 0 }, text: "One line on what this page covers." } },
    { text: { text: FOOT, options: { x: M, y: 6.95, w: 8, h: 0.3, fontSize: 10, color: C.accent5, margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.5, y: 6.95, w: 0.5, h: 0.3, fontSize: 10, color: HEX.muted, align: "right" },
});

pres.defineSlideMaster({
  title: "SECTION",
  background: { color: C.accent1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.8, w: 11, h: 1.4, fontSize: 44, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "Section" } },
  ],
});

// --- Helpers --------------------------------------------------------------
let n = 0;
const name = (what) => `${what}-${++n}`;

/** A dashed box where the user drops a logo, photo or mock-up. */
function dropZone(slide, x, y, w, h, label) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.12, fill: { color: C.background2 },
    line: { color: HEX.line, width: 1.25, dashType: "dash" }, objectName: name("drop-zone"),
  });
  slide.addText(label, {
    x, y, w, h, align: "center", valign: "middle", fontSize: 13, color: C.accent5, isTextBox: true, objectName: name("drop-label"),
  });
}

function card(slide, x, y, w, h, title, text, opts = {}) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.12, fill: { color: opts.fill ?? C.background2 }, line: { color: opts.fill ?? C.background2 },
    objectName: name("card"),
  });
  slide.addText(
    [
      { text: title, options: { bold: true, fontSize: 16, color: opts.titleColor ?? C.text1, breakLine: true } },
      { text, options: { fontSize: 14, color: opts.textColor ?? C.text2 } },
    ],
    { x: x + 0.3, y: y + 0.25, w: w - 0.6, h: h - 0.5, valign: "top", margin: 0, paraSpaceAfter: 6, isTextBox: true, objectName: name("card-text") },
  );
}

function content(section, title, subtitle) {
  const slide = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  slide.addText(title, { placeholder: "title" });
  slide.addText(subtitle, { placeholder: "body" });
  return slide;
}

// --- Slides ---------------------------------------------------------------
pres.addSection({ title: "Cover" });
const cover = pres.addSlide({ masterName: "COVER", sectionTitle: "Cover" });
cover.addText("[Brand name] brand guidelines", { placeholder: "title" });
cover.addText("Version 1.0 · [Month year]", { placeholder: "body" });
cover.addShape(pres.ShapeType.ellipse, { x: 10.0, y: 2.0, w: 2.6, h: 2.6, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: "cover-mark" });
cover.addNotes("How to use this template: replace every [bracketed] text. To use your brand colors everywhere at once, change the theme colors (Design > Variants > Colors > Customize Colors).");

pres.addSection({ title: "Brand" });
const contents = content("Brand", "Contents", "What's in this guide.");
const items = ["Our brand", "Voice and tone", "Logo", "Color", "Typography", "Imagery", "In use", "Contacts"];
items.forEach((item, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = M + col * 6.1;
  const y = 2.0 + row * 1.15;
  contents.addShape(pres.ShapeType.ellipse, { x, y, w: 0.7, h: 0.7, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: name("num") });
  contents.addText(String(i + 1).padStart(2, "0"), { x, y, w: 0.7, h: 0.7, align: "center", valign: "middle", fontSize: 14, bold: true, color: C.background1, isTextBox: true, margin: 0, objectName: name("num-text") });
  contents.addText(item, { x: x + 0.95, y, w: 4.8, h: 0.7, valign: "middle", fontSize: 18, color: C.text1, isTextBox: true, margin: 0, objectName: name("contents-item") });
});

const brand = content("Brand", "Our brand", "Why we exist and what we stand for.");
card(brand, M, 2.0, 3.8, 2.2, "Mission", "[What you do, for whom, and why it matters. One or two sentences.]");
card(brand, M + 4.1, 2.0, 3.8, 2.2, "Vision", "[The change you want to see in the world.]");
card(brand, M + 8.2, 2.0, 3.73, 2.2, "Audience", "[Who you serve, described as people.]");
["[Value one]", "[Value two]", "[Value three]"].forEach((v, i) =>
  card(brand, M + i * 4.1, 4.5, i === 2 ? 3.73 : 3.8, 1.9, v, "[What it means in practice, in one line.]", { fill: C.accent6 }),
);

const voice = content("Brand", "Voice and tone", "How we sound in every message.");
card(voice, M, 2.0, 5.85, 4.4, "We are", "[Friendly, but never sloppy]\n[Clear, not clever for its own sake]\n[Confident, not arrogant]\n[Helpful, with real examples]", { fill: C.background2 });
card(voice, M + 6.1, 2.0, 5.83, 4.4, "We are not", "[Jargon-heavy]\n[Pushy or salesy]\n[Vague]\n[Overexcited, with too many exclamation marks]", { fill: C.accent6 });

pres.addSection({ title: "Logo" });
const div1 = pres.addSlide({ masterName: "SECTION", sectionTitle: "Logo" });
div1.addText("Logo", { placeholder: "title" });

const logo = content("Logo", "Logo", "Our primary logo and its versions.");
dropZone(logo, M, 2.0, 7.4, 4.4, "Place your primary logo here");
dropZone(logo, M + 7.7, 2.0, 4.23, 1.3, "Icon only");
dropZone(logo, M + 7.7, 3.55, 4.23, 1.3, "Horizontal");
dropZone(logo, M + 7.7, 5.1, 4.23, 1.3, "One color / reversed");

const dos = content("Logo", "Logo do's and don'ts", "Keep the logo recognizable everywhere.");
const rules = [
  ["Do", "Use the files from the brand folder."], ["Do", "Keep the clear space around it."], ["Do", "Use the reversed version on dark backgrounds."],
  ["Don't", "Stretch, squash or rotate it."], ["Don't", "Change its colors or add effects."], ["Don't", "Place it on busy photos."],
];
rules.forEach(([kind, text], i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = M + col * 4.1;
  const y = 2.0 + row * 2.3;
  dropZone(dos, x, y, i % 3 === 2 ? 3.73 : 3.8, 1.4, "Example");
  dos.addText([{ text: `${kind}: `, options: { bold: true, color: kind === "Do" ? C.accent3 : C.accent1 } }, { text, options: { color: C.text2 } }], {
    x, y: y + 1.5, w: 3.8, h: 0.5, fontSize: 14, margin: 0, isTextBox: true, objectName: name("rule"),
  });
});

const space = content("Logo", "Clear space and minimum size", "Give the logo room to breathe.");
dropZone(space, M + 0.6, 2.2, 5.2, 3.6, "Logo with clear space marked");
space.addText("[X]", { x: M + 0.6, y: 1.75, w: 5.2, h: 0.4, align: "center", fontSize: 14, color: C.accent5, isTextBox: true, margin: 0, objectName: "space-x" });
card(space, M + 6.6, 2.2, 5.33, 1.65, "Clear space", "[Keep space equal to X, the height of the icon, on every side.]");
card(space, M + 6.6, 4.15, 5.33, 1.65, "Minimum size", "[Digital: 24px high. Print: 10mm high.]");

pres.addSection({ title: "Color" });
const div2 = pres.addSlide({ masterName: "SECTION", sectionTitle: "Color" });
div2.addText("Color", { placeholder: "title" });

const color = content("Color", "Color palette", "Recolor the swatches, or change the theme colors to update the whole deck.");
const swatches = [
  ["Primary", C.accent1], ["Secondary", C.accent2], ["Accent", C.accent4], ["Dark", C.text2], ["Light", C.background2],
];
const sw = (W - 2 * M - 4 * 0.25) / 5;
swatches.forEach(([role, fill], i) => {
  const x = M + i * (sw + 0.25);
  color.addShape(pres.ShapeType.roundRect, { x, y: 2.0, w: sw, h: 2.3, rectRadius: 0.12, fill: { color: fill }, line: { color: role === "Light" ? HEX.line : fill }, objectName: name("swatch") });
  color.addText(
    [
      { text: role, options: { bold: true, fontSize: 16, color: C.text1, breakLine: true } },
      { text: "HEX  [#000000]", options: { fontSize: 12, color: C.text2, breakLine: true } },
      { text: "RGB  [0, 0, 0]", options: { fontSize: 12, color: C.text2, breakLine: true } },
      { text: "CMYK [0, 0, 0, 0]", options: { fontSize: 12, color: C.text2 } },
    ],
    { x, y: 4.45, w: sw, h: 1.5, valign: "top", margin: 0, paraSpaceAfter: 4, isTextBox: true, objectName: name("swatch-text") },
  );
});
color.addText("Make one in a minute: brandbite.studio/brand-kit", { x: M, y: 6.25, w: 8, h: 0.35, fontSize: 12, color: C.accent5, margin: 0, isTextBox: true, objectName: "color-tip" });

pres.addSection({ title: "Typography" });
const type = content("Typography", "Typography", "Two fonts: one for headings, one for reading.");
[
  { x: M, label: "Headings: [Font name]", sample: "Aa", note: "[Weights you use, e.g. Bold 700]\n[Where to get it, e.g. Google Fonts]", bold: true },
  { x: M + 6.1, label: "Body: [Font name]", sample: "Aa", note: "The quick brown fox jumps over the lazy dog.\n[Weights: Regular 400, Bold 700]", bold: false },
].forEach((col) => {
  type.addShape(pres.ShapeType.roundRect, { x: col.x, y: 2.0, w: 5.85, h: 3.4, rectRadius: 0.12, fill: { color: C.background2 }, line: { color: C.background2 }, objectName: name("type-card") });
  type.addText(col.label, { x: col.x + 0.3, y: 2.2, w: 5.25, h: 0.4, fontSize: 16, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: name("type-label") });
  type.addText(col.sample, { x: col.x + 0.3, y: 2.65, w: 5.25, h: 1.4, fontSize: 88, bold: col.bold, color: C.accent1, margin: 0, valign: "middle", isTextBox: true, objectName: name("type-sample") });
  type.addText(col.note, { x: col.x + 0.3, y: 4.15, w: 5.25, h: 1.0, fontSize: 14, color: C.text2, margin: 0, valign: "top", paraSpaceAfter: 4, isTextBox: true, objectName: name("type-note") });
});
type.addText("Type scale: Title 48 · Heading 32 · Subheading 24 · Body 16 · Small 14", { x: M, y: 5.65, w: 11.93, h: 0.5, fontSize: 14, color: C.text2, margin: 0, isTextBox: true, objectName: "type-scale" });
type.addText("Find a pairing: brandbite.studio/brand-kit/font-pairings", { x: M, y: 6.2, w: 8, h: 0.35, fontSize: 12, color: C.accent5, margin: 0, isTextBox: true, objectName: "type-tip" });

pres.addSection({ title: "Imagery" });
const imagery = content("Imagery", "Imagery", "The look and feel of our photos and illustrations.");
dropZone(imagery, M, 2.0, 3.8, 2.6, "Example photo");
dropZone(imagery, M + 4.1, 2.0, 3.8, 2.6, "Example photo");
dropZone(imagery, M + 8.2, 2.0, 3.73, 2.6, "Example illustration");
card(imagery, M, 4.85, 11.93, 1.55, "Our style", "[e.g. Natural light, real people at work, warm tones. Avoid staged stock photos and heavy filters.]");

pres.addSection({ title: "In use" });
const use = content("In use", "In use", "Examples of the brand on real things.");
dropZone(use, M, 2.0, 3.0, 3.75, "Social post 1080 × 1350");
dropZone(use, M + 3.3, 2.0, 4.2, 2.4, "Business card");
dropZone(use, M + 7.8, 2.0, 4.13, 4.4, "Website or app screen");
dropZone(use, M + 3.3, 4.65, 4.2, 1.75, "Email header");
use.addText("Exact sizes for every platform: brandbite.studio/sizes", { x: M, y: 6.0, w: 3.0, h: 0.4, fontSize: 11, color: C.accent5, margin: 0, isTextBox: true, objectName: "sizes-tip" });

pres.addSection({ title: "Contacts" });
const contact = content("Contacts", "Contacts", "Who to ask, and where the files live.");
card(contact, M, 2.0, 5.85, 2.0, "Brand owner", "[Name, role, email]");
card(contact, M + 6.1, 2.0, 5.83, 2.0, "Brand files", "[Link to logos, fonts and templates]");
card(contact, M, 4.3, 11.93, 2.1, "Need design help?", "brandbite gives you a creative team on one simple subscription. brandbite.studio", { fill: C.accent1, titleColor: C.background1, textColor: C.background1 });

pres.writeFile({ fileName: OUT }).then(async () => {
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
});
