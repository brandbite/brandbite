// -----------------------------------------------------------------------------
// @file: lib/tools/keep.ts
// @purpose: Keeps a hub tool's work while the visitor moves between pages of
//           the site, so going to Mockup Studio and back (by a link or the
//           browser's back button) returns to the work as it was left. Held
//           in the page's memory only: nothing is stored or sent, and a full
//           reload or closing the tab clears it.
// -----------------------------------------------------------------------------

const kept = new Map<string, unknown>();

/** What a tool kept under `key`, or null. */
export function keptWork<T>(key: string): T | null {
  return (kept.get(key) as T | undefined) ?? null;
}

export function keepWork<T>(key: string, value: T): void {
  kept.set(key, value);
}

export function forgetWork(key: string): void {
  kept.delete(key);
}
