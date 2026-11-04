import { describe, expect, it } from "vitest";

import {
  commitWorkspaceChange,
  contrastRatio,
  createStudioPalette,
  getSelectedColor,
  INITIAL_WORKSPACE,
  loadWorkspacePalette,
  markWorkspaceSaved,
  moveStudioColor,
  parseWorkspace,
  redoWorkspace,
  removeStudioColor,
  selectWorkspaceColor,
  serializeWorkspace,
  undoWorkspace,
} from "@/lib/colors";

function palette() {
  return createStudioPalette({
    name: "Ocean Breeze",
    hexes: ["#173b59", "#41c2d0", "#f6e5d5"],
    sourceTool: "generator",
  });
}

describe("workspace history", () => {
  it("loads a palette as unchanged, selecting its first color", () => {
    const p = palette();
    const state = loadWorkspacePalette(p);
    expect(state.dirty).toBe(false);
    expect(state.selectedColorId).toBe(p.colors[0].id);
  });

  it("undoes and redoes one step, restoring selection", () => {
    const p = palette();
    let state = selectWorkspaceColor(loadWorkspacePalette(p), p.colors[1].id);
    const moved = moveStudioColor(p, p.colors[1].id, 1);
    state = commitWorkspaceChange(state, moved, p.colors[2].id);
    expect(state.dirty).toBe(true);

    state = undoWorkspace(state);
    expect(state.activePalette).toBe(p);
    expect(state.selectedColorId).toBe(p.colors[1].id);

    state = redoWorkspace(state);
    expect(state.activePalette).toBe(moved);
    expect(state.selectedColorId).toBe(p.colors[2].id);
  });

  it("clears redo when a new change is made", () => {
    const p = palette();
    let state = commitWorkspaceChange(
      loadWorkspacePalette(p),
      moveStudioColor(p, p.colors[0].id, 1),
    );
    state = undoWorkspace(state);
    expect(state.redoStack).toHaveLength(1);
    state = commitWorkspaceChange(state, moveStudioColor(p, p.colors[1].id, 1));
    expect(state.redoStack).toHaveLength(0);
  });

  it("treats undo and redo with empty stacks as no-ops", () => {
    const state = loadWorkspacePalette(palette());
    expect(undoWorkspace(state)).toBe(state);
    expect(redoWorkspace(state)).toBe(state);
    expect(undoWorkspace(INITIAL_WORKSPACE)).toBe(INITIAL_WORKSPACE);
  });

  it("limits undo history to 50 steps", () => {
    const p = palette();
    let state = loadWorkspacePalette(p);
    for (let i = 0; i < 60; i++) {
      state = commitWorkspaceChange(state, { ...p, name: `Step ${i}` });
    }
    expect(state.undoStack).toHaveLength(50);
    expect(state.undoStack[49].palette.name).toBe("Step 58");
  });

  it("moves the selection when the selected color is removed", () => {
    const p = palette();
    const state = loadWorkspacePalette(p, p.colors[0].id);
    const next = commitWorkspaceChange(state, removeStudioColor(p, p.colors[0].id).palette);
    expect(next.selectedColorId).toBe(p.colors[1].id);
    expect(getSelectedColor(next)?.hex).toBe("#41c2d0");
  });

  it("does not record selection as a change", () => {
    const p = palette();
    const state = selectWorkspaceColor(loadWorkspacePalette(p), p.colors[2].id);
    expect(state.dirty).toBe(false);
    expect(state.undoStack).toHaveLength(0);
  });

  it("ignores selecting an unknown color", () => {
    const state = loadWorkspacePalette(palette());
    expect(selectWorkspaceColor(state, "missing")).toBe(state);
  });

  it("clears unsaved state without losing history", () => {
    const p = palette();
    const state = commitWorkspaceChange(loadWorkspacePalette(p), { ...p, name: "Renamed" });
    const saved = markWorkspaceSaved(state);
    expect(saved.dirty).toBe(false);
    expect(saved.undoStack).toHaveLength(1);
  });
});

describe("workspace session snapshot", () => {
  it("restores palette, selection and unsaved state, but not history", () => {
    const p = palette();
    const state = commitWorkspaceChange(loadWorkspacePalette(p, p.colors[1].id), {
      ...p,
      name: "Renamed",
    });
    const restored = parseWorkspace(serializeWorkspace(state));
    expect(restored.activePalette?.name).toBe("Renamed");
    expect(restored.selectedColorId).toBe(p.colors[1].id);
    expect(restored.dirty).toBe(true);
    expect(restored.undoStack).toHaveLength(0);
  });

  it.each([
    ["nothing stored", null],
    ["invalid JSON", "{oops"],
    ["an empty workspace", serializeWorkspace(INITIAL_WORKSPACE)],
    ["another version", JSON.stringify({ version: 99, activePalette: palette() })],
    [
      "a corrupt color",
      JSON.stringify({
        version: 1,
        activePalette: { ...palette(), colors: [{ id: "a", hex: "url(evil)" }] },
      }),
    ],
    [
      "a palette with no colors",
      JSON.stringify({ version: 1, activePalette: { ...palette(), colors: [] } }),
    ],
  ])("falls back to an empty workspace for %s", (_label, text) => {
    expect(parseWorkspace(text)).toEqual(INITIAL_WORKSPACE);
  });
});

describe("Color Studio token contrast", () => {
  it.each([
    ["primary button text", "#FFFFFF", "#C2410C", 4.5],
    ["primary button hover text", "#FFFFFF", "#9A3412", 4.5],
    ["body text on page", "#242528", "#F7F5F2", 4.5],
    ["muted text on page", "#6C6D75", "#F7F5F2", 4.5],
    ["muted text on panel", "#6C6D75", "#FFFFFF", 4.5],
    ["soft label text", "#4C1D95", "#ECE4FF", 4.5],
    ["body text on soft", "#242528", "#ECE4FF", 4.5],
    ["danger text on panel", "#B42318", "#FFFFFF", 4.5],
  ])("%s reaches AA", (_label, foreground, background, minimum) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });
});
