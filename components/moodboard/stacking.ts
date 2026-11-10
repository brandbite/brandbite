// -----------------------------------------------------------------------------
// @file: components/moodboard/stacking.ts
// @purpose: Stacking order of moodboard objects. Each object's `position` is
//           an integer and higher draws on top. Bringing to front or sending
//           to back only renumbers the moved objects, past the current top or
//           bottom, so the rest keep their numbers and need no saving.
// -----------------------------------------------------------------------------

type Stackable = { id: string; position: number };

/** The position for an object added now: above everything. */
export function nextPosition(items: Stackable[]): number {
  return items.length === 0 ? 0 : Math.max(...items.map((i) => i.position)) + 1;
}

/**
 * New positions for `ids`, moved above (front) or below (back) every other
 * object while keeping their order among themselves. Objects already there
 * are left out, so a repeat press changes nothing.
 */
export function restack(
  items: Stackable[],
  ids: string[],
  where: "front" | "back",
): Map<string, number> {
  const moving = new Set(ids);
  const chosen = items.filter((i) => moving.has(i.id)).sort((a, b) => a.position - b.position);
  const others = items.filter((i) => !moving.has(i.id));
  const changes = new Map<string, number>();
  if (chosen.length === 0) return changes;

  if (others.length === 0) return changes;
  if (where === "front") {
    const top = Math.max(...others.map((i) => i.position));
    if (chosen[0].position > top) return changes;
    chosen.forEach((item, index) => changes.set(item.id, top + 1 + index));
  } else {
    const bottom = Math.min(...others.map((i) => i.position));
    if (chosen[chosen.length - 1].position < bottom) return changes;
    chosen.forEach((item, index) => changes.set(item.id, bottom - chosen.length + index));
  }
  return changes;
}
