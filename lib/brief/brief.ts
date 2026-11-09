// -----------------------------------------------------------------------------
// @file: lib/brief/brief.ts
// @purpose: The creative brief generator's data: project types, tones, the
//           empty and example briefs, a completeness score and the plain-text
//           / Markdown export. Pure, so it runs on the server and in tests.
// -----------------------------------------------------------------------------

export const PROJECT_TYPES = [
  { id: "logo", label: "Logo or brand identity" },
  { id: "social", label: "Social media content" },
  { id: "ads", label: "Ad campaign" },
  { id: "website", label: "Website or landing page" },
  { id: "presentation", label: "Presentation or pitch deck" },
  { id: "print", label: "Print or packaging" },
  { id: "video", label: "Video or motion" },
  { id: "other", label: "Something else" },
] as const;

export type ProjectTypeId = (typeof PROJECT_TYPES)[number]["id"];

export const TONES = [
  "Bold",
  "Playful",
  "Minimal",
  "Premium",
  "Friendly",
  "Serious",
  "Warm",
  "Techy",
  "Edgy",
  "Calm",
] as const;

/** Deliverables people usually need, per project type, offered as one-click adds. */
export const SUGGESTED_DELIVERABLES: Record<ProjectTypeId, string[]> = {
  logo: [
    "Primary logo (full color, SVG and PNG)",
    "Logo variations: icon, horizontal, one-color",
    "Color palette with HEX codes",
    "Typography pairing",
    "Mini brand guide (PDF)",
  ],
  social: [
    "Instagram post 1080 × 1350",
    "Instagram story 1080 × 1920",
    "LinkedIn post 1200 × 627",
    "Facebook post 1080 × 1350",
    "Editable source files",
  ],
  ads: [
    "Meta feed ad 1440 × 1800",
    "Meta stories ad 1440 × 2560",
    "Google display 300 × 250",
    "Google display 728 × 90",
    "LinkedIn ad 1200 × 627",
  ],
  website: [
    "Homepage design (desktop and mobile)",
    "Landing page design",
    "Hero image or illustration",
    "Icon set",
    "Link preview image 1200 × 630",
  ],
  presentation: [
    "Slide template (master layouts)",
    "Up to 15 designed slides",
    "Charts and diagrams",
    "Editable file (PowerPoint, Keynote or Google Slides)",
  ],
  print: [
    "Print-ready PDF with bleed",
    "Packaging dieline artwork",
    "Business cards",
    "Flyer or poster",
  ],
  video: [
    "Vertical video 1080 × 1920",
    "Landscape video 1920 × 1080",
    "Animated logo",
    "Thumbnail 1280 × 720",
  ],
  other: ["Final files in the formats you need", "Editable source files"],
};

export type Brief = {
  projectName: string;
  projectType: ProjectTypeId | "";
  summary: string;
  company: string;
  companyDescription: string;
  audience: string;
  objective: string;
  successMeasure: string;
  keyMessage: string;
  tones: string[];
  mustInclude: string;
  avoid: string;
  deliverables: string[];
  brandColors: string;
  brandFonts: string;
  references: string;
  deadline: string;
  revisions: string;
  budget: string;
  notes: string;
};

export const EMPTY_BRIEF: Brief = {
  projectName: "",
  projectType: "",
  summary: "",
  company: "",
  companyDescription: "",
  audience: "",
  objective: "",
  successMeasure: "",
  keyMessage: "",
  tones: [],
  mustInclude: "",
  avoid: "",
  deliverables: [],
  brandColors: "",
  brandFonts: "",
  references: "",
  deadline: "",
  revisions: "",
  budget: "",
  notes: "",
};

/** A filled-in brief, so visitors can see what a good one looks like. */
export const EXAMPLE_BRIEF: Brief = {
  projectName: "Spring launch social campaign",
  projectType: "social",
  summary: "A two-week Instagram and LinkedIn campaign announcing our new team plan.",
  company: "Northwind Analytics",
  companyDescription:
    "A dashboard tool that helps small e-commerce teams see which products make money.",
  audience:
    "Founders and marketing leads at online stores with 5 to 50 people, mostly in the US and UK. Busy, skeptical of new tools, and tired of spreadsheets.",
  objective: "Get 300 teams to start a free trial of the new team plan.",
  successMeasure: "Trial sign-ups from the campaign links, and saves on Instagram.",
  keyMessage: "Your whole team, one view of what's selling.",
  tones: ["Friendly", "Bold", "Minimal"],
  mustInclude:
    "Logo, the line 'Free for 14 days', a product screenshot in at least half the posts.",
  avoid: "Stock photos of people pointing at laptops. Red, which reads as losses in our product.",
  deliverables: [
    "Instagram post 1080 × 1350",
    "Instagram story 1080 × 1920",
    "LinkedIn post 1200 × 627",
    "Editable source files",
  ],
  brandColors: "#1F3A5F, #3DDC97, #F5F1EA",
  brandFonts: "Inter for everything; bold for headlines.",
  references: "Our website, and last year's launch posts, which got the most saves.",
  deadline: "March 3",
  revisions: "Two rounds",
  budget: "",
  notes: "We'll post 3 times a week for two weeks, so 6 posts and 6 stories in total.",
};

export function projectTypeLabel(id: Brief["projectType"]): string {
  return PROJECT_TYPES.find((type) => type.id === id)?.label ?? "";
}

/** Fields a usable brief needs; the rest are optional. */
const ESSENTIALS: (keyof Brief)[] = [
  "projectName",
  "projectType",
  "summary",
  "audience",
  "objective",
  "keyMessage",
  "deliverables",
  "deadline",
];

function filled(value: Brief[keyof Brief]): boolean {
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

/** How many essentials are filled in, and which are missing. */
export function briefProgress(brief: Brief): { done: number; total: number; missing: string[] } {
  const labels: Partial<Record<keyof Brief, string>> = {
    projectName: "project name",
    projectType: "project type",
    summary: "summary",
    audience: "audience",
    objective: "objective",
    keyMessage: "key message",
    deliverables: "deliverables",
    deadline: "deadline",
  };
  const missing = ESSENTIALS.filter((key) => !filled(brief[key])).map((key) => labels[key]!);
  return { done: ESSENTIALS.length - missing.length, total: ESSENTIALS.length, missing };
}

export type BriefSection = { heading: string; rows: { label: string; value: string }[] };

/** The brief as titled sections, skipping anything left empty. */
export function briefSections(brief: Brief): BriefSection[] {
  const sections: BriefSection[] = [
    {
      heading: "Project",
      rows: [
        { label: "Type", value: projectTypeLabel(brief.projectType) },
        { label: "Summary", value: brief.summary },
      ],
    },
    {
      heading: "Background",
      rows: [
        { label: "Company", value: brief.company },
        { label: "What it does", value: brief.companyDescription },
        { label: "Audience", value: brief.audience },
      ],
    },
    {
      heading: "Goal",
      rows: [
        { label: "Objective", value: brief.objective },
        { label: "How we'll measure it", value: brief.successMeasure },
      ],
    },
    {
      heading: "Message and tone",
      rows: [
        { label: "Key message", value: brief.keyMessage },
        { label: "Tone", value: brief.tones.join(", ") },
        { label: "Must include", value: brief.mustInclude },
        { label: "Avoid", value: brief.avoid },
      ],
    },
    {
      heading: "Deliverables",
      rows: brief.deliverables.map((item) => ({ label: "", value: item })),
    },
    {
      heading: "Brand",
      rows: [
        { label: "Colors", value: brief.brandColors },
        { label: "Fonts", value: brief.brandFonts },
        { label: "References", value: brief.references },
      ],
    },
    {
      heading: "Timeline",
      rows: [
        { label: "Deadline", value: brief.deadline },
        { label: "Revisions", value: brief.revisions },
        { label: "Budget", value: brief.budget },
      ],
    },
    { heading: "Notes", rows: [{ label: "", value: brief.notes }] },
  ];
  return sections
    .map((section) => ({ ...section, rows: section.rows.filter((row) => row.value.trim()) }))
    .filter((section) => section.rows.length > 0);
}

function briefTitle(brief: Brief): string {
  return brief.projectName.trim() || "Creative brief";
}

/** Markdown, for pasting into Notion, Google Docs, Slack or an email. */
export function briefToMarkdown(brief: Brief): string {
  const lines = [`# ${briefTitle(brief)}`, ""];
  for (const section of briefSections(brief)) {
    lines.push(`## ${section.heading}`, "");
    for (const row of section.rows) {
      lines.push(row.label ? `- **${row.label}:** ${row.value.trim()}` : `- ${row.value.trim()}`);
    }
    lines.push("");
  }
  lines.push("_Made with the free brief generator at brandbite.studio/brief-generator_");
  return lines.join("\n");
}

/** Plain text, for anywhere Markdown would show as symbols. */
export function briefToText(brief: Brief): string {
  const title = briefTitle(brief);
  const lines = [title.toUpperCase(), ""];
  for (const section of briefSections(brief)) {
    lines.push(section.heading.toUpperCase());
    for (const row of section.rows) {
      lines.push(row.label ? `${row.label}: ${row.value.trim()}` : `- ${row.value.trim()}`);
    }
    lines.push("");
  }
  lines.push("Made with the free brief generator at brandbite.studio/brief-generator");
  return lines.join("\n");
}

/** File name for downloads, from the project name. */
export function briefFileName(brief: Brief, extension: "md" | "txt"): string {
  const slug = briefTitle(brief)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "creative-brief"}.${extension}`;
}

const STRING_FIELDS = Object.keys(EMPTY_BRIEF).filter(
  (key) => typeof EMPTY_BRIEF[key as keyof Brief] === "string",
) as (keyof Brief)[];

/** Reads a saved brief back from storage, dropping anything malformed. */
export function parseStoredBrief(raw: string | null): Brief | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;
    const brief: Brief = { ...EMPTY_BRIEF, tones: [], deliverables: [] };
    for (const key of STRING_FIELDS) {
      const value = data[key];
      if (typeof value === "string") (brief as Record<string, unknown>)[key] = value.slice(0, 4000);
    }
    if (!PROJECT_TYPES.some((type) => type.id === brief.projectType)) brief.projectType = "";
    for (const key of ["tones", "deliverables"] as const) {
      const value = data[key];
      if (Array.isArray(value)) {
        brief[key] = value.filter((item): item is string => typeof item === "string").slice(0, 50);
      }
    }
    return brief;
  } catch {
    return null;
  }
}
