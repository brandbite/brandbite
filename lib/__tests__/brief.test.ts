import { describe, expect, it } from "vitest";

import {
  briefFileName,
  briefProgress,
  briefSections,
  briefToMarkdown,
  briefToText,
  EMPTY_BRIEF,
  EXAMPLE_BRIEF,
  parseStoredBrief,
  SUGGESTED_DELIVERABLES,
} from "@/lib/brief/brief";

describe("brief progress", () => {
  it("counts the essentials and names what is missing", () => {
    expect(briefProgress(EMPTY_BRIEF)).toMatchObject({ done: 0, total: 8 });
    expect(briefProgress(EXAMPLE_BRIEF)).toEqual({ done: 8, total: 8, missing: [] });
    const partial = briefProgress({
      ...EMPTY_BRIEF,
      projectName: "Launch",
      deliverables: ["Logo"],
    });
    expect(partial.done).toBe(2);
    expect(partial.missing).toContain("deadline");
    expect(partial.missing).not.toContain("project name");
  });

  it("doesn't count whitespace as filled in", () => {
    expect(briefProgress({ ...EMPTY_BRIEF, projectName: "   " }).done).toBe(0);
  });
});

describe("brief output", () => {
  it("skips empty sections", () => {
    expect(briefSections(EMPTY_BRIEF)).toEqual([]);
    const sections = briefSections({ ...EMPTY_BRIEF, keyMessage: "One view", deadline: "Friday" });
    expect(sections.map((section) => section.heading)).toEqual(["Message and tone", "Timeline"]);
  });

  it("writes Markdown with every filled-in field", () => {
    const md = briefToMarkdown(EXAMPLE_BRIEF);
    expect(md.startsWith("# Spring launch social campaign\n")).toBe(true);
    expect(md).toContain("## Deliverables");
    expect(md).toContain("- Instagram story 1080 × 1920");
    expect(md).toContain("- **Tone:** Friendly, Bold, Minimal");
    expect(md).not.toContain("Budget");
  });

  it("writes plain text without Markdown symbols", () => {
    const text = briefToText(EXAMPLE_BRIEF);
    expect(text).toContain("SPRING LAUNCH SOCIAL CAMPAIGN");
    expect(text).toContain("Key message: Your whole team, one view of what's selling.");
    expect(text).not.toMatch(/\*\*|^#/m);
  });

  it("names downloads after the project", () => {
    expect(briefFileName(EXAMPLE_BRIEF, "md")).toBe("spring-launch-social-campaign.md");
    expect(briefFileName(EMPTY_BRIEF, "txt")).toBe("creative-brief.txt");
    expect(briefFileName({ ...EMPTY_BRIEF, projectName: "!!!" }, "md")).toBe("creative-brief.md");
  });

  it("suggests deliverables for every project type", () => {
    for (const items of Object.values(SUGGESTED_DELIVERABLES))
      expect(items.length).toBeGreaterThan(0);
  });
});

describe("stored drafts", () => {
  it("round-trips a brief", () => {
    expect(parseStoredBrief(JSON.stringify(EXAMPLE_BRIEF))).toEqual(EXAMPLE_BRIEF);
  });

  it("drops malformed data instead of crashing", () => {
    expect(parseStoredBrief(null)).toBeNull();
    expect(parseStoredBrief("not json")).toBeNull();
    const brief = parseStoredBrief(
      JSON.stringify({ projectName: 42, projectType: "nope", tones: ["Bold", 3], summary: "ok" }),
    );
    expect(brief).toMatchObject({
      projectName: "",
      projectType: "",
      tones: ["Bold"],
      summary: "ok",
    });
  });
});
