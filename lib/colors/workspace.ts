// -----------------------------------------------------------------------------
// @file: lib/colors/workspace.ts
// @purpose: Pure state transitions for the palette being worked on across Color
//           Studio tools: selection, undo/redo, unsaved-change tracking and the
//           session snapshot. No React or storage access.
// -----------------------------------------------------------------------------

import { parseOpaqueHex } from "./convert";
import type { StudioColor, StudioPalette } from "./studio";

const UNDO_LIMIT = 50;
const SNAPSHOT_VERSION = 1;

interface WorkspaceSnapshot {
  palette: StudioPalette;
  selectedColorId: string | null;
}

export interface WorkspaceState {
  activePalette: StudioPalette | null;
  selectedColorId: string | null;
  undoStack: WorkspaceSnapshot[];
  redoStack: WorkspaceSnapshot[];
  /** True when the active palette has changes that were not saved. */
  dirty: boolean;
}

export const INITIAL_WORKSPACE: WorkspaceState = {
  activePalette: null,
  selectedColorId: null,
  undoStack: [],
  redoStack: [],
  dirty: false,
};

/** Keep a selection only if the color still exists; otherwise fall back to the first color. */
function resolveSelection(palette: StudioPalette, selectedColorId: string | null): string | null {
  if (palette.colors.some((c) => c.id === selectedColorId)) return selectedColorId;
  return palette.colors[0]?.id ?? null;
}

function currentSnapshot(state: WorkspaceState): WorkspaceSnapshot | null {
  return state.activePalette
    ? { palette: state.activePalette, selectedColorId: state.selectedColorId }
    : null;
}

/** Start working on a palette. Clears history; the palette counts as unchanged. */
export function loadWorkspacePalette(
  palette: StudioPalette,
  selectedColorId: string | null = null,
): WorkspaceState {
  return {
    ...INITIAL_WORKSPACE,
    activePalette: palette,
    selectedColorId: resolveSelection(palette, selectedColorId),
  };
}

/** Apply one user action as a single undo step. */
export function commitWorkspaceChange(
  state: WorkspaceState,
  palette: StudioPalette,
  selectedColorId: string | null = state.selectedColorId,
): WorkspaceState {
  if (palette === state.activePalette) return state;
  const snapshot = currentSnapshot(state);
  return {
    activePalette: palette,
    selectedColorId: resolveSelection(palette, selectedColorId),
    undoStack: snapshot ? [...state.undoStack, snapshot].slice(-UNDO_LIMIT) : state.undoStack,
    redoStack: [],
    dirty: true,
  };
}

/** Refine the current undo step, e.g. while a slider is being dragged. */
export function replaceWorkspacePalette(
  state: WorkspaceState,
  palette: StudioPalette,
): WorkspaceState {
  return { ...state, activePalette: palette, dirty: true };
}

export function undoWorkspace(state: WorkspaceState): WorkspaceState {
  const previous = state.undoStack[state.undoStack.length - 1];
  const snapshot = currentSnapshot(state);
  if (!previous || !snapshot) return state;
  return {
    activePalette: previous.palette,
    selectedColorId: previous.selectedColorId,
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, snapshot],
    dirty: true,
  };
}

export function redoWorkspace(state: WorkspaceState): WorkspaceState {
  const next = state.redoStack[state.redoStack.length - 1];
  const snapshot = currentSnapshot(state);
  if (!next || !snapshot) return state;
  return {
    activePalette: next.palette,
    selectedColorId: next.selectedColorId,
    undoStack: [...state.undoStack, snapshot],
    redoStack: state.redoStack.slice(0, -1),
    dirty: true,
  };
}

/** Changing the selection is not an undoable edit. */
export function selectWorkspaceColor(state: WorkspaceState, colorId: string): WorkspaceState {
  if (!state.activePalette?.colors.some((c) => c.id === colorId)) return state;
  return { ...state, selectedColorId: colorId };
}

export function markWorkspaceSaved(state: WorkspaceState): WorkspaceState {
  return { ...state, dirty: false };
}

export function getSelectedColor(state: WorkspaceState): StudioColor | null {
  return state.activePalette?.colors.find((c) => c.id === state.selectedColorId) ?? null;
}

/** Session snapshot. Undo history is deliberately left out. */
export function serializeWorkspace(state: WorkspaceState): string {
  return JSON.stringify({
    version: SNAPSHOT_VERSION,
    activePalette: state.activePalette,
    selectedColorId: state.selectedColorId,
    dirty: state.dirty,
  });
}

/** Light shape check for palettes this app wrote to browser storage itself. */
export function isStudioPalette(value: unknown): value is StudioPalette {
  if (typeof value !== "object" || value === null) return false;
  const palette = value as Partial<StudioPalette>;
  return (
    typeof palette.id === "string" &&
    typeof palette.name === "string" &&
    typeof palette.roles === "object" &&
    palette.roles !== null &&
    Array.isArray(palette.colors) &&
    palette.colors.length > 0 &&
    palette.colors.every((c) => typeof c?.id === "string" && parseOpaqueHex(c?.hex) !== null)
  );
}

/** Restore a session snapshot. Anything unreadable gives an empty workspace. */
export function parseWorkspace(text: string | null): WorkspaceState {
  if (!text) return INITIAL_WORKSPACE;
  try {
    const raw = JSON.parse(text);
    if (raw?.version !== SNAPSHOT_VERSION || !isStudioPalette(raw.activePalette)) {
      return INITIAL_WORKSPACE;
    }
    return {
      ...loadWorkspacePalette(
        raw.activePalette,
        typeof raw.selectedColorId === "string" ? raw.selectedColorId : null,
      ),
      dirty: raw.dirty === true,
    };
  } catch {
    return INITIAL_WORKSPACE;
  }
}
