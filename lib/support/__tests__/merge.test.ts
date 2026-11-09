import { describe, expect, it, vi } from "vitest";

import { guideCodeHash } from "../hash";
import { codeGuides } from "../index";
import { codeStatusFor, contentOf, mergeGuides, parseGuideContent } from "../merge";
import { syncGuideEntries, type Notify, type SyncEntry, type SyncStore } from "../sync";
import type { SupportGuide } from "../types";

const guide = (slug: string, title = slug): SupportGuide => ({
  slug,
  title,
  summary: `${title} summary`,
  category: "Workspace",
  routes: [`/customer/${slug}`],
  related: [],
  sections: [{ heading: "How", blocks: [{ type: "p", text: `About ${title}` }] }],
});

const content = (title: string) => ({
  title,
  summary: "Edited summary",
  category: "Billing",
  keywords: ["edited"],
  sections: [{ heading: "Edited", blocks: [{ type: "p", text: "New text" }] }],
});

const entry = (over: Partial<Parameters<typeof mergeGuides>[1][number]>) => ({
  slug: "a",
  fromCode: true,
  hidden: false,
  content: null,
  codeStatus: "IN_SYNC" as const,
  ...over,
});

describe("mergeGuides", () => {
  const code = [guide("a", "Alpha"), guide("b", "Beta")];

  it("returns the code guides untouched without CMS rows", () => {
    expect(mergeGuides(code, [])).toEqual({ guides: code, hiddenSlugs: [] });
  });

  it("applies an edit but keeps routes and links from code", () => {
    const { guides } = mergeGuides(code, [entry({ content: content("Alpha, edited") })]);
    expect(guides[0]).toMatchObject({
      slug: "a",
      title: "Alpha, edited",
      category: "Billing",
      routes: ["/customer/a"],
    });
    expect(guides[1]).toBe(code[1]);
  });

  it("keeps an edit live while a code change waits for review", () => {
    const { guides } = mergeGuides(code, [
      entry({ content: content("Mine"), codeStatus: "CODE_CHANGED" }),
    ]);
    expect(guides[0].title).toBe("Mine");
  });

  it("hides code guides and reports them", () => {
    const merged = mergeGuides(code, [entry({ slug: "b", hidden: true })]);
    expect(merged.guides.map((g) => g.slug)).toEqual(["a"]);
    expect(merged.hiddenSlugs).toEqual(["b"]);
  });

  it("adds CMS-only guides after code guides, without routes", () => {
    const { guides } = mergeGuides(code, [
      entry({ slug: "zeta", fromCode: false, content: content("Zeta") }),
      entry({ slug: "eta", fromCode: false, content: content("Eta") }),
      entry({ slug: "hidden-one", fromCode: false, hidden: true, content: content("Hidden") }),
    ]);
    expect(guides.map((g) => g.slug)).toEqual(["a", "b", "eta", "zeta"]);
    expect(guides[2].routes).toEqual([]);
  });

  it("drops edits of guides that left the code until an admin decides", () => {
    const { guides } = mergeGuides(code, [entry({ slug: "gone", content: content("Gone") })]);
    expect(guides.map((g) => g.slug)).toEqual(["a", "b"]);
  });

  it("ignores malformed content instead of breaking the page", () => {
    const { guides } = mergeGuides(code, [entry({ content: { title: 3, sections: "x" } })]);
    expect(guides[0]).toBe(code[0]);
  });
});

describe("parseGuideContent", () => {
  it("drops empty blocks and sections, keeps list terms", () => {
    const parsed = parseGuideContent({
      title: " Title ",
      summary: "S",
      category: "",
      keywords: ["a", 2],
      sections: [
        {
          heading: "One",
          blocks: [
            { type: "p", text: "  " },
            { type: "list", items: ["x", { term: "T", text: "t" }, { term: "", text: "no" }, 5] },
            { type: "video", text: "nope" },
          ],
        },
        { heading: "Empty", blocks: [] },
      ],
    });
    expect(parsed).toEqual({
      title: "Title",
      summary: "S",
      category: "Other",
      keywords: ["a"],
      sections: [
        { heading: "One", blocks: [{ type: "list", items: ["x", { term: "T", text: "t" }] }] },
      ],
    });
  });

  it("rejects content with no title or no sections", () => {
    expect(parseGuideContent(null)).toBeNull();
    expect(parseGuideContent({ title: "", sections: [] })).toBeNull();
    expect(parseGuideContent({ title: "T", sections: [] })).toBeNull();
  });
});

describe("code hashes and status", () => {
  it("changes only when editable content changes", () => {
    const base = guide("a");
    expect(guideCodeHash(base)).toBe(guideCodeHash({ ...base, routes: ["/elsewhere"] }));
    expect(guideCodeHash(base)).not.toBe(guideCodeHash({ ...base, title: "New" }));
    expect(guideCodeHash(base)).toBe(guideCodeHash({ ...base, keywords: [] }));
  });

  it("tracks whether code moved on after an edit", () => {
    const edited = { fromCode: true, baseCodeHash: "h1", content: content("x") };
    expect(codeStatusFor(edited, "h1")).toBe("IN_SYNC");
    expect(codeStatusFor(edited, "h2")).toBe("CODE_CHANGED");
    expect(codeStatusFor(edited, null)).toBe("CODE_REMOVED");
    expect(codeStatusFor({ ...edited, content: null }, "h2")).toBe("IN_SYNC");
    expect(
      codeStatusFor({ fromCode: false, baseCodeHash: null, content: content("x") }, null),
    ).toBe("IN_SYNC");
  });

  it("round-trips a real guide through parsing unchanged", () => {
    for (const real of codeGuides("customer")) {
      expect(parseGuideContent(contentOf(real))).toEqual(contentOf(real));
    }
  });
});

describe("syncGuideEntries", () => {
  const real = codeGuides("customer")[0];
  const currentHash = guideCodeHash(real);

  function store(entries: SyncEntry[]) {
    const updates: { id: string; data: unknown }[] = [];
    const s: SyncStore = {
      entries: async () => entries,
      update: async (id, data) => {
        updates.push({ id, data });
        const row = entries.find((e) => e.id === id)!;
        Object.assign(row, data);
      },
      adminIds: async () => ["admin-1", "admin-2"],
    };
    return { s, updates };
  }

  const row = (over: Partial<SyncEntry>): SyncEntry => ({
    id: "e1",
    audience: "CUSTOMER",
    slug: real.slug,
    fromCode: true,
    content: content("My edit"),
    baseCodeHash: currentHash,
    codeStatus: "IN_SYNC",
    notifiedCodeHash: null,
    ...over,
  });

  it("does nothing while edits match the code", async () => {
    const { s, updates } = store([row({})]);
    const notify = vi.fn<Notify>();
    expect(await syncGuideEntries(s, notify)).toEqual({ checked: 1, changed: 0, notified: 0 });
    expect(updates).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("notifies every admin once when code changed an edited guide", async () => {
    const entries = [row({ baseCodeHash: "old" })];
    const { s } = store(entries);
    const notify = vi.fn<Notify>(async () => {});
    const first = await syncGuideEntries(s, notify);
    expect(first).toEqual({ checked: 1, changed: 1, notified: 2 });
    expect(entries[0].codeStatus).toBe("CODE_CHANGED");
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls[0][0]).toMatchObject({ userId: "admin-1" });
    expect(notify.mock.calls[0][0].message).toContain("My edit (Customer): changed in code");

    // The next deploy with the same code says nothing new.
    notify.mockClear();
    expect(await syncGuideEntries(s, notify)).toEqual({ checked: 1, changed: 0, notified: 0 });
    expect(notify).not.toHaveBeenCalled();
  });

  it("reports guides removed from code", async () => {
    const entries = [row({ slug: "no-longer-in-code" })];
    const { s } = store(entries);
    const notify = vi.fn<Notify>(async () => {});
    await syncGuideEntries(s, notify);
    expect(entries[0].codeStatus).toBe("CODE_REMOVED");
    expect(notify.mock.calls[0][0].message).toContain("removed from code");
  });

  it("clears the flag when code goes back to the edited version", async () => {
    const entries = [row({ codeStatus: "CODE_CHANGED", notifiedCodeHash: "x" })];
    const { s } = store(entries);
    const notify = vi.fn<Notify>();
    await syncGuideEntries(s, notify);
    expect(entries[0].codeStatus).toBe("IN_SYNC");
    expect(notify).not.toHaveBeenCalled();
  });

  it("ignores CMS-only guides", async () => {
    const { s } = store([row({ fromCode: false, slug: "cms-only" })]);
    expect(await syncGuideEntries(s, vi.fn())).toEqual({ checked: 0, changed: 0, notified: 0 });
  });
});
