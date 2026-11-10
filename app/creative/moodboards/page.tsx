// -----------------------------------------------------------------------------
// @file: app/creative/moodboards/page.tsx
// @purpose: A creative's own moodboards, plus the customer boards on their jobs.
// -----------------------------------------------------------------------------

"use client";

import { MoodboardList } from "@/components/dashboard/workspace/moodboard-list";

export default function CreativeMoodboardsPage() {
  return (
    <MoodboardList
      audience="creative"
      basePath="/creative/moodboards"
      description="Develop ideas for your work. Boards customers attach to your requests appear here too."
      emptyDescription="Start a moodboard to collect references and try out directions. Only you and the brandbite team can see it until you share it."
    />
  );
}
