// -----------------------------------------------------------------------------
// @file: lib/newsletter/history.ts
// @purpose: Undo and redo for the newsletter builder. Every change is one
//           step back, except typing: changes that carry the same key and
//           follow each other closely (the letters of one field) count as a
//           single step. Pure.
// -----------------------------------------------------------------------------

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** What the last change was, when it can still be joined by the next one. */
  lastKey: string | null;
  lastAt: number;
};

export const HISTORY_LIMIT = 100;
/** Changes with the same key closer together than this are one step. */
export const HISTORY_JOIN_MS = 1200;

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

/** A change. `key` names what is being typed into, so a run of typing is one step. */
export function commit<T>(
  history: History<T>,
  next: T,
  key: string | null,
  now: number,
): History<T> {
  if (next === history.present) return history;
  const joins = key !== null && key === history.lastKey && now - history.lastAt < HISTORY_JOIN_MS;
  return {
    past: joins ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastKey: key,
    lastAt: now,
  };
}

/** Replace what is shown without a step back to before it (loading, a save's answer). */
export function replace<T>(history: History<T>, present: T): History<T> {
  return { ...history, present, lastKey: null };
}

export function undo<T>(history: History<T>): History<T> {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    lastKey: null,
    lastAt: 0,
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    lastKey: null,
    lastAt: 0,
  };
}
