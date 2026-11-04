// -----------------------------------------------------------------------------
// @file: components/colors/studio/workspace-store.ts
// @purpose: Keeps the active palette while moving between Color Studio tools.
//           Module state survives client navigation; sessionStorage restores it
//           after a reload. The server and hydration render always see an empty
//           workspace, so restored state can't cause a hydration mismatch.
// -----------------------------------------------------------------------------

"use client";

import { useSyncExternalStore } from "react";

import {
  commitWorkspaceChange,
  INITIAL_WORKSPACE,
  loadWorkspacePalette,
  markWorkspaceSaved,
  parseWorkspace,
  redoWorkspace,
  replaceWorkspacePalette,
  selectWorkspaceColor,
  serializeWorkspace,
  undoWorkspace,
  type StudioPalette,
  type WorkspaceState,
} from "@/lib/colors";

const STORAGE_KEY = "brandbite.colorStudio.workspace.v1";

let state: WorkspaceState = INITIAL_WORKSPACE;
let restored = false;
const listeners = new Set<() => void>();

function readSession(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): WorkspaceState {
  if (!restored) {
    restored = true;
    state = parseWorkspace(readSession());
  }
  return state;
}

function setState(next: WorkspaceState): void {
  if (next === state) return;
  state = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, serializeWorkspace(next));
  } catch {
    // Storage may be full or blocked. The workspace still works for this page view.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const workspaceActions = {
  load: (palette: StudioPalette, selectedColorId?: string | null) =>
    setState(loadWorkspacePalette(palette, selectedColorId ?? null)),
  commit: (palette: StudioPalette, selectedColorId?: string | null) =>
    setState(commitWorkspaceChange(getSnapshot(), palette, selectedColorId ?? undefined)),
  replace: (palette: StudioPalette) => setState(replaceWorkspacePalette(getSnapshot(), palette)),
  undo: () => setState(undoWorkspace(getSnapshot())),
  redo: () => setState(redoWorkspace(getSnapshot())),
  select: (colorId: string) => setState(selectWorkspaceColor(getSnapshot(), colorId)),
  markSaved: () => setState(markWorkspaceSaved(getSnapshot())),
};

export function useWorkspace(): WorkspaceState {
  return useSyncExternalStore(subscribe, getSnapshot, () => INITIAL_WORKSPACE);
}

/** Test helper: forget in-memory state so the next read restores from storage. */
export function resetWorkspaceStoreForTests(): void {
  state = INITIAL_WORKSPACE;
  restored = false;
  listeners.clear();
}
