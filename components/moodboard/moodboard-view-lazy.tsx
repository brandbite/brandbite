// -----------------------------------------------------------------------------
// @file: components/moodboard/moodboard-view-lazy.tsx
// @purpose: Client-side wrapper that lazy-loads MoodboardView so the canvas
//           bundle (@dnd-kit, tiptap, video embeds, drawing libs) does not
//           ship as part of the initial server-rendered HTML. Next requires
//           `dynamic(..., { ssr: false })` to live inside a "use client"
//           boundary, hence this tiny proxy.
// -----------------------------------------------------------------------------

"use client";

import dynamic from "next/dynamic";

const MoodboardView = dynamic(
  () =>
    import("@/components/moodboard/moodboard-view").then((m) => ({
      default: m.MoodboardView,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--bb-text-muted)]">
        Loading moodboard…
      </div>
    ),
  },
);

export function MoodboardViewLazy({ moodboardId }: { moodboardId: string }) {
  return <MoodboardView moodboardId={moodboardId} />;
}
