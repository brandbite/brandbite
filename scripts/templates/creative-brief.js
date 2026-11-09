// Builds public/templates/brandbite-creative-brief-template.docx
const fs = require("fs");
const path = require("path");
const {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, LevelFormat, Packer,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} = require("docx");

const OUT = process.argv[2];
const INK = "2B2D33";
const MUTED = "6C6D75";
const ORANGE = "FF6426";
const LINE = "E3E0DC";
const SOFT = "F7F4F1";
const FONT = "Arial";

const PAGE_W = 12240; // US Letter
const MARGIN = 1080; // 0.75"
const CONTENT_W = PAGE_W - MARGIN * 2; // 10080

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };

const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { before: 0, after: opts.after ?? 80 },
    children: [new TextRun({ text, font: FONT, size: opts.size ?? 20, color: opts.color ?? INK, bold: opts.bold, italics: opts.italics })],
  });

const hint = (text) => p(text, { color: MUTED, italics: true, size: 18, after: 40 });

function cell(children, width, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 70, bottom: 70, left: 140, right: 140 },
    children,
  });
}

/** Label on the left, writing space with a hint on the right. */
function fieldTable(rows) {
  const left = 2800;
  const right = CONTENT_W - left;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [left, right],
    rows: rows.map(([label, help, lines = 1]) =>
      new TableRow({
        children: [
          cell([p(label, { bold: true, after: 0 })], left, { fill: SOFT }),
          cell([hint(help), ...Array.from({ length: lines }, () => p(" ", { after: 60 }))], right),
        ],
      }),
    ),
  });
}

function gridTable(headers, widths, blankRows) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => cell([p(h, { bold: true, after: 0, size: 18 })], widths[i], { fill: SOFT })),
      }),
      ...blankRows.map((row) =>
        new TableRow({ children: widths.map((w, i) => cell([p(row[i] ?? " ", { color: MUTED, italics: !!row[i], size: 18, after: 0 })], w)) }),
      ),
    ],
  });
}

const section = (number, title, intro) => [
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [
      new TextRun({ text: `${number}  `, font: FONT, color: ORANGE, bold: true, size: 26 }),
      new TextRun({ text: title, font: FONT, color: INK, bold: true, size: 26 }),
    ],
  }),
  ...(intro
    ? [
        new Paragraph({
          keepNext: true,
          spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: intro, font: FONT, size: 18, color: MUTED })],
        }),
      ]
    : []),
];

const doc = new Document({
  creator: "brandbite",
  title: "Creative brief template",
  description: "A one-page creative brief template from brandbite.studio",
  styles: {
    default: { document: { run: { font: FONT, size: 20, color: INK } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", run: { font: FONT, size: 48, bold: true, color: INK }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 26, bold: true, color: INK }, paragraph: { spacing: { before: 200, after: 60 }, keepNext: true, outlineLevel: 0 } },
    ],
  },
  numbering: {
    config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }],
  },
  sections: [
    {
      properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: 900, bottom: 900, left: MARGIN, right: MARGIN } } },
      headers: {
        default: new Header({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "brand", font: FONT, bold: true, size: 18, color: INK }), new TextRun({ text: "bite", font: FONT, bold: true, size: 18, color: ORANGE })] })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Free template by brandbite. Write one online at brandbite.studio/brief-generator", font: FONT, size: 16, color: MUTED })] })],
        }),
      },
      children: [
        new Paragraph({ style: "Title", children: [new TextRun({ text: "Creative brief", font: FONT })] }),
        p("Fill in every gray prompt, then delete the prompts. Keep it to one or two pages.", { color: MUTED, after: 200 }),
        gridTable(["Project name", "Prepared by", "Date"], [4200, 3480, 2400], [["A short name everyone will use", "Your name and role", "Today"]]),

        ...section("1", "The project", "What you need, in a summary a designer could repeat back to you."),
        fieldTable([
          ["What we need", "e.g. Social campaign, logo, landing page, pitch deck."],
          ["Summary", "One or two sentences. Example: Six Instagram posts and six stories announcing our team plan, running for two weeks from March 3.", 2],
        ]),

        ...section("2", "Background", "Who you are and who the work is for."),
        fieldTable([
          ["Company or brand", "Name, and what you do in plain words."],
          ["Audience", "Describe them as people: what they care about, what they think of you today, what would make them stop scrolling.", 2],
        ]),

        ...section("3", "The goal", "What should change because of this work, and how you'll know."),
        fieldTable([
          ["Objective", "Be specific. Example: 300 free trials in two weeks.", 2],
          ["How we'll measure it", "Example: sign-ups from campaign links, saves on Instagram."],
        ]),

        ...section("4", "Message and tone"),
        fieldTable([
          ["Key message", "The one thing people should remember."],
          ["Tone", "About three words, e.g. friendly, bold, minimal."],
          ["Must include", "Logo, legal lines, products, a specific photo."],
          ["Avoid", "Anything to stay away from, and why."],
        ]),

        ...section("5", "Deliverables", "Every file you expect. Exact sizes save a revision round."),
        gridTable(
          ["Deliverable", "Size (px)", "Format", "Due"],
          [3780, 2100, 2100, 2100],
          [["Instagram post", "1080 × 1350", "PNG + source", "Mar 3"], [], [], []],
        ),
        p("Not sure of the sizes? See brandbite.studio/sizes", { color: MUTED, size: 16, after: 0 }),

        ...section("6", "Brand"),
        fieldTable([
          ["Colors", "HEX codes, e.g. #1F3A5F, #3DDC97."],
          ["Fonts", "Heading and body fonts."],
          ["Logo and assets", "Where to find logo files, photos, brand guide."],
          ["References", "Links to work you like, and what you like about each.", 2],
        ]),

        ...section("7", "Timeline and approval"),
        fieldTable([
          ["Final files needed by", "Leave time for your own review."],
          ["Rounds of revisions", "Example: two."],
          ["Budget", "Optional. Say so if it limits the scope."],
          ["Notes", "Anything else the designer should know.", 2],
        ]),
        p(" ", { after: 120 }),
        gridTable(["Approved by", "Role", "Date"], [4200, 3480, 2400], [[], []]),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log("wrote", OUT, buf.length, "bytes");
});
