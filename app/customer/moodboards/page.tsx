// -----------------------------------------------------------------------------
// @file: app/customer/moodboards/page.tsx
// @purpose: The company's moodboards, plus any a creative has shared.
// -----------------------------------------------------------------------------

"use client";

import { MoodboardList } from "@/components/dashboard/workspace/moodboard-list";

export default function MoodboardsPage() {
  return (
    <MoodboardList
      audience="customer"
      basePath="/customer/moodboards"
      description="Collect inspiration, colors, and references for your design projects."
      emptyDescription="Create your first moodboard to start collecting design inspiration."
    />
  );
}
