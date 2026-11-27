// -----------------------------------------------------------------------------
// @file: lib/newsletter/rich.ts
// @purpose: Formatted text in a newsletter's text block: paragraphs and lists
//           whose words can be bold, italic, underlined or a link. This file
//           holds the shape it is stored in, the reader that cleans stored or
//           pasted data, its plain-text form, and the translation to and from
//           the editor's own document. Pure; the email HTML is made in
//           ./render.ts.
// -----------------------------------------------------------------------------

/** A run of words that share the same formatting. "\n" inside is a line break. */
export type RichRun = {
  text: string;
  bold?: true;
  italic?: true;
  underline?: true;
  /** An http(s) or mailto: address. */
  link?: string;
};

export type RichNode = { type: "p"; runs: RichRun[] } | { type: "ul" | "ol"; items: RichRun[][] };

export const RICH_MAX_NODES = 60;
export const RICH_MAX_ITEMS = 40;
export const RICH_MAX_RUNS = 80;
export const RICH_MAX_CHARS = 4000;

/** A link a reader can safely follow: http(s), or mailto: with an address. Null for anything else. */
export function richLink(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value || value.length > 500) return null;
  if (/^mailto:/i.test(value)) {
    return /^mailto:[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/i.test(value) ? value : null;
  }
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function readRuns(raw: unknown, budget: { chars: number }): RichRun[] {
  const runs: RichRun[] = [];
  for (const item of Array.isArray(raw) ? raw.slice(0, RICH_MAX_RUNS) : []) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.text !== "string" || !r.text) continue;
    const text = r.text.replace(/\r/g, "").slice(0, Math.max(0, budget.chars));
    if (!text) break;
    budget.chars -= text.length;
    const run: RichRun = { text };
    if (r.bold === true) run.bold = true;
    if (r.italic === true) run.italic = true;
    if (r.underline === true) run.underline = true;
    const link = richLink(r.link);
    if (link) run.link = link;
    // Neighbours with the same formatting are one run, so the same text is always stored the same way.
    const last = runs[runs.length - 1];
    if (
      last &&
      last.bold === run.bold &&
      last.italic === run.italic &&
      last.underline === run.underline &&
      last.link === run.link
    ) {
      last.text += run.text;
    } else runs.push(run);
  }
  return runs;
}

/**
 * Stored or pasted formatted text, cleaned: unknown kinds of node and
 * formatting are dropped, links that aren't web or mail addresses lose their
 * link, and the size is capped. Null when there is nothing left.
 */
export function readRich(raw: unknown): RichNode[] | null {
  if (!Array.isArray(raw)) return null;
  const budget = { chars: RICH_MAX_CHARS };
  const nodes: RichNode[] = [];
  for (const item of raw.slice(0, RICH_MAX_NODES)) {
    if (!item || typeof item !== "object") continue;
    const n = item as Record<string, unknown>;
    if (n.type === "p") {
      nodes.push({ type: "p", runs: readRuns(n.runs, budget) });
    } else if (n.type === "ul" || n.type === "ol") {
      const items = (Array.isArray(n.items) ? n.items.slice(0, RICH_MAX_ITEMS) : [])
        .map((runs) => readRuns(runs, budget))
        .filter((runs) => runs.length);
      if (items.length) nodes.push({ type: n.type, items });
    }
  }
  // Empty paragraphs at the ends are only room, not content.
  const empty = (node: RichNode) => node.type === "p" && !node.runs.length;
  while (nodes.length && empty(nodes[0])) nodes.shift();
  while (nodes.length && empty(nodes[nodes.length - 1])) nodes.pop();
  return nodes.length ? nodes : null;
}

const runsText = (runs: RichRun[]) => runs.map((run) => run.text).join("");

/** The same text without formatting: paragraphs an empty line apart, list items one per line. */
export function richToPlain(nodes: RichNode[]): string {
  return nodes
    .map((node) =>
      node.type === "p"
        ? runsText(node.runs)
        : node.items
            .map((item, index) => `${node.type === "ol" ? `${index + 1}.` : "-"} ${runsText(item)}`)
            .join("\n"),
    )
    .join("\n\n")
    .trim();
}

/** Plain text as unformatted paragraphs: an empty line starts a new one. */
export function plainToRich(text: string): RichNode[] {
  return text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({ type: "p" as const, runs: [{ text: paragraph }] }));
}

/** Whether any of it is formatted, i.e. more than plain paragraphs. */
export function hasFormatting(nodes: RichNode[] | null): boolean {
  return Boolean(
    nodes?.some(
      (node) =>
        node.type !== "p" ||
        node.runs.some((run) => run.bold || run.italic || run.underline || run.link),
    ),
  );
}

// ---------------------------------------------------------------------------
// To and from the editor's document (Tiptap / ProseMirror JSON)
// ---------------------------------------------------------------------------

type EditorNode = {
  type?: string;
  text?: string;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
  content?: EditorNode[];
};

function runsFromEditor(content: EditorNode[] | undefined): RichRun[] {
  const runs: RichRun[] = [];
  for (const node of content ?? []) {
    if (node.type === "hardBreak") {
      // A line break joins the run before it, so it carries that run's formatting.
      if (runs.length)
        runs[runs.length - 1] = {
          ...runs[runs.length - 1],
          text: `${runs[runs.length - 1].text}\n`,
        };
      else runs.push({ text: "\n" });
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const run: RichRun = { text: node.text };
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") run.bold = true;
      else if (mark.type === "italic") run.italic = true;
      else if (mark.type === "underline") run.underline = true;
      else if (mark.type === "link") {
        const link = richLink(mark.attrs?.href);
        if (link) run.link = link;
      }
    }
    runs.push(run);
  }
  return runs;
}

/** The editor's document as stored formatted text; null when it is empty. */
export function richFromEditor(doc: unknown): RichNode[] | null {
  const root = (doc ?? {}) as EditorNode;
  const nodes: unknown[] = [];
  for (const node of root.content ?? []) {
    if (node.type === "paragraph") nodes.push({ type: "p", runs: runsFromEditor(node.content) });
    else if (node.type === "bulletList" || node.type === "orderedList") {
      nodes.push({
        type: node.type === "bulletList" ? "ul" : "ol",
        // A list item holds paragraphs; they become one item, a line break between them.
        items: (node.content ?? []).map((item) =>
          (item.content ?? []).flatMap((paragraph, index) => [
            ...(index ? [{ text: "\n" }] : []),
            ...runsFromEditor(paragraph.content),
          ]),
        ),
      });
    }
  }
  return readRich(nodes);
}

/** A node of the document handed to the editor: like EditorNode, with nothing left open. */
export type EditorDoc = {
  type: string;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: EditorDoc[];
};

function runsToEditor(runs: RichRun[]): EditorDoc[] {
  const out: EditorDoc[] = [];
  for (const run of runs) {
    const marks: NonNullable<EditorDoc["marks"]> = [];
    if (run.bold) marks.push({ type: "bold" });
    if (run.italic) marks.push({ type: "italic" });
    if (run.underline) marks.push({ type: "underline" });
    if (run.link) marks.push({ type: "link", attrs: { href: run.link } });
    run.text.split("\n").forEach((piece, index) => {
      if (index) out.push({ type: "hardBreak" });
      if (piece) out.push({ type: "text", text: piece, ...(marks.length ? { marks } : {}) });
    });
  }
  return out;
}

/** Stored formatted text as the editor's document. */
export function richToEditor(nodes: RichNode[]): EditorDoc {
  return {
    type: "doc",
    content: nodes.length
      ? nodes.map((node) =>
          node.type === "p"
            ? { type: "paragraph", content: runsToEditor(node.runs) }
            : {
                type: node.type === "ul" ? "bulletList" : "orderedList",
                content: node.items.map((item) => ({
                  type: "listItem",
                  content: [{ type: "paragraph", content: runsToEditor(item) }],
                })),
              },
        )
      : [{ type: "paragraph" }],
  };
}
