import { describe, expect, it } from "vitest";

import { MAX_BACKUP_BYTES, parseBackup, serializeBackup } from "@/lib/colors/backup";
import {
  createStudioPalette,
  duplicateStudioPalette,
  moveStudioColor,
  removeStudioColor,
  setStudioRole,
  type StudioPalette,
} from "@/lib/colors";

const NOW = new Date("2026-11-04T10:00:00.000Z");
const LATER = new Date("2026-11-04T11:00:00.000Z");

function samplePalette(): StudioPalette {
  const palette = createStudioPalette({
    name: "Ocean Breeze",
    hexes: ["#173b59", "#41c2d0", "#f6e5d5"],
    sourceTool: "generator",
    now: NOW,
  });
  const withText = setStudioRole(palette, "text", palette.colors[0].id, NOW);
  return setStudioRole(withText, "background", palette.colors[2].id, NOW);
}

describe("palette operations", () => {
  it("creates unlocked colors with unique ids", () => {
    const palette = samplePalette();
    expect(new Set(palette.colors.map((c) => c.id)).size).toBe(3);
    expect(palette.colors.every((c) => c.locked === false)).toBe(true);
    expect(palette.createdAt).toBe(NOW.toISOString());
  });

  it("duplicates with new ids and remapped roles, leaving the source alone", () => {
    const source = samplePalette();
    const snapshot = structuredClone(source);
    const copy = duplicateStudioPalette(source, "Copy", LATER);

    expect(copy.id).not.toBe(source.id);
    expect(copy.colors.map((c) => c.hex)).toEqual(source.colors.map((c) => c.hex));
    expect(copy.colors.some((c) => source.colors.some((s) => s.id === c.id))).toBe(false);
    expect(copy.roles.text).toBe(copy.colors[0].id);
    expect(copy.roles.background).toBe(copy.colors[2].id);
    expect(copy.createdAt).toBe(LATER.toISOString());
    expect(source).toEqual(snapshot);
  });

  it("clears roles when their color is removed and reports them", () => {
    const palette = samplePalette();
    const result = removeStudioColor(palette, palette.colors[0].id, LATER);
    expect(result.clearedRoles).toEqual(["text"]);
    expect(result.palette.roles.text).toBeUndefined();
    expect(result.palette.roles.background).toBe(palette.roles.background);
    expect(result.palette.colors).toHaveLength(2);
    expect(result.palette.updatedAt).toBe(LATER.toISOString());
  });

  it("will not remove the last color", () => {
    const single = createStudioPalette({ name: "One", hexes: ["#000000"], sourceTool: "wheel" });
    const result = removeStudioColor(single, single.colors[0].id);
    expect(result.palette).toBe(single);
  });

  it("reorders colors while roles keep following them", () => {
    const palette = samplePalette();
    const moved = moveStudioColor(palette, palette.colors[0].id, 1, LATER);
    expect(moved.colors[1].id).toBe(palette.colors[0].id);
    expect(moved.roles.text).toBe(palette.colors[0].id);
  });

  it("ignores moves past either end", () => {
    const palette = samplePalette();
    expect(moveStudioColor(palette, palette.colors[0].id, -1)).toBe(palette);
    expect(moveStudioColor(palette, palette.colors[2].id, 1)).toBe(palette);
  });

  it("allows one color to hold several roles, and clearing a role", () => {
    const palette = samplePalette();
    const id = palette.colors[0].id;
    const shared = setStudioRole(palette, "primary", id);
    expect(shared.roles.primary).toBe(id);
    expect(shared.roles.text).toBe(id);
    expect(setStudioRole(shared, "primary", null).roles.primary).toBeUndefined();
  });

  it("ignores roles for unknown colors", () => {
    const palette = samplePalette();
    expect(setStudioRole(palette, "accent", "missing")).toBe(palette);
  });
});

describe("backup", () => {
  it("round-trips content under new ids", () => {
    const source = samplePalette();
    const result = parseBackup(serializeBackup([source], LATER));
    if (!result.ok) throw new Error(result.error);

    const [restored] = result.palettes;
    expect(restored.id).not.toBe(source.id);
    expect(restored.name).toBe(source.name);
    expect(restored.colors.map((c) => c.hex)).toEqual(source.colors.map((c) => c.hex));
    expect(restored.colors.some((c) => source.colors.some((s) => s.id === c.id))).toBe(false);
    expect(restored.roles.text).toBe(restored.colors[0].id);
  });

  it("gives each import of the same file separate ids", () => {
    const text = serializeBackup([samplePalette()]);
    const first = parseBackup(text);
    const second = parseBackup(text);
    if (!first.ok || !second.ok) throw new Error("expected valid backups");
    expect(first.palettes[0].id).not.toBe(second.palettes[0].id);
  });

  it("normalizes hex values", () => {
    const source = samplePalette();
    const raw = JSON.parse(serializeBackup([source]));
    raw.palettes[0].colors[0].hex = "#ABC";
    const result = parseBackup(JSON.stringify(raw));
    if (!result.ok) throw new Error(result.error);
    expect(result.palettes[0].colors[0].hex).toBe("#aabbcc");
  });

  it("drops roles that point at missing colors", () => {
    const raw = JSON.parse(serializeBackup([samplePalette()]));
    raw.palettes[0].roles.accent = "missing";
    const result = parseBackup(JSON.stringify(raw));
    if (!result.ok) throw new Error(result.error);
    expect(result.palettes[0].roles.accent).toBeUndefined();
    expect(result.palettes[0].roles.text).toBeDefined();
  });

  it("separates the failure kinds", () => {
    expect(parseBackup("not json")).toEqual({ ok: false, error: "not-json" });
    expect(parseBackup("{}")).toEqual({ ok: false, error: "invalid-backup" });
    expect(parseBackup("x".repeat(MAX_BACKUP_BYTES + 1))).toEqual({
      ok: false,
      error: "too-large",
    });
  });

  type RawPalette = { name: string; sourceTool: string; colors: { id: string; hex: string }[] };

  it.each<[string, (p: RawPalette) => void]>([
    ["an alpha color", (p) => (p.colors[0].hex = "#ff642680")],
    ["a non-color", (p) => (p.colors[0].hex = "url(evil)")],
    ["an empty palette", (p) => (p.colors = [])],
    ["a blank name", (p) => (p.name = "   ")],
    ["an unknown source", (p) => (p.sourceTool = "other")],
    ["duplicate color ids", (p) => (p.colors[1].id = p.colors[0].id)],
  ])("rejects %s", (_label, corrupt) => {
    const raw = JSON.parse(serializeBackup([samplePalette()]));
    corrupt(raw.palettes[0]);
    expect(parseBackup(JSON.stringify(raw))).toEqual({ ok: false, error: "invalid-backup" });
  });

  it("rejects an unsupported schema version", () => {
    const raw = JSON.parse(serializeBackup([samplePalette()]));
    raw.schemaVersion = 2;
    expect(parseBackup(JSON.stringify(raw))).toEqual({ ok: false, error: "invalid-backup" });
  });
});
