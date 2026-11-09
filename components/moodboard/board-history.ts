// -----------------------------------------------------------------------------
// @file: components/moodboard/board-history.ts
// @purpose: Undo and redo work by comparing two states of a board, so anything
//           that changes the board can be undone without its own reverse logic.
//           Also the format copied items travel in on the clipboard.
// -----------------------------------------------------------------------------

import type { MoodboardConnection, MoodboardItemClient } from "@/lib/moodboard";

export type BoardSnapshot = {
  items: MoodboardItemClient[];
  connections: MoodboardConnection[];
};

export type BoardDiff = {
  /** On the board now, but not in the target. */
  remove: string[];
  /** In the target, but not on the board now. */
  restore: string[];
  /** On both, but different. */
  change: MoodboardItemClient[];
  connectionsChanged: boolean;
};

function sameItem(a: MoodboardItemClient, b: MoodboardItemClient) {
  if (a === b) return true;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.position === b.position &&
    (a.locked ?? false) === (b.locked ?? false) &&
    (a.groupId ?? null) === (b.groupId ?? null) &&
    JSON.stringify(a.data) === JSON.stringify(b.data)
  );
}

export function diffBoards(current: BoardSnapshot, target: BoardSnapshot): BoardDiff {
  const now = new Map(current.items.map((i) => [i.id, i]));
  const wanted = new Map(target.items.map((i) => [i.id, i]));
  return {
    remove: current.items.filter((i) => !wanted.has(i.id)).map((i) => i.id),
    restore: target.items.filter((i) => !now.has(i.id)).map((i) => i.id),
    change: target.items.filter((i) => {
      const existing = now.get(i.id);
      return existing && !sameItem(existing, i);
    }),
    connectionsChanged:
      current.connections !== target.connections &&
      JSON.stringify(current.connections) !== JSON.stringify(target.connections),
  };
}

export function isEmptyDiff(diff: BoardDiff) {
  return (
    diff.remove.length === 0 &&
    diff.restore.length === 0 &&
    diff.change.length === 0 &&
    !diff.connectionsChanged
  );
}

// -----------------------------------------------------------------------------
// Clipboard
// -----------------------------------------------------------------------------

const CLIPBOARD_MARKER = "brandbite-moodboard-v1:";

export type CopiedItem = Pick<
  MoodboardItemClient,
  "id" | "type" | "data" | "x" | "y" | "width" | "height" | "groupId"
>;

export type BoardClipboard = {
  moodboardId: string;
  items: CopiedItem[];
  connections: MoodboardConnection[];
};

/** The chosen items, and only the arrows that run between them. */
export function buildClipboard(
  moodboardId: string,
  board: BoardSnapshot,
  ids: string[],
): BoardClipboard {
  const chosen = new Set(ids);
  return {
    moodboardId,
    items: board.items
      .filter((i) => chosen.has(i.id))
      .map(({ id, type, data, x, y, width, height, groupId }) => ({
        id,
        type,
        data,
        x,
        y,
        width,
        height,
        groupId: groupId ?? null,
      })),
    connections: board.connections.filter(
      (c) => chosen.has(c.sourceItemId) && chosen.has(c.targetItemId),
    ),
  };
}

export function serializeClipboard(clipboard: BoardClipboard) {
  return CLIPBOARD_MARKER + JSON.stringify(clipboard);
}

/** Null for anything else that's on the clipboard, like text from another app. */
export function parseClipboard(text: string | null | undefined): BoardClipboard | null {
  if (!text?.startsWith(CLIPBOARD_MARKER)) return null;
  try {
    const parsed = JSON.parse(text.slice(CLIPBOARD_MARKER.length));
    if (typeof parsed?.moodboardId !== "string" || !Array.isArray(parsed.items)) return null;
    return {
      moodboardId: parsed.moodboardId,
      items: parsed.items,
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    };
  } catch {
    return null;
  }
}
