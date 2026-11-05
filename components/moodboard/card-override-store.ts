// -----------------------------------------------------------------------------
// @file: components/moodboard/card-override-store.ts
// @purpose: Where the card being dragged or resized is right now, for the arrows
//           attached to it. Only the arrow layer subscribes, so the cards don't
//           re-render during a drag.
// -----------------------------------------------------------------------------

export type CardOverride = {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export function createCardOverrideStore() {
  let value: CardOverride | null = null;
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set: (next: CardOverride | null) => {
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type CardOverrideStore = ReturnType<typeof createCardOverrideStore>;
