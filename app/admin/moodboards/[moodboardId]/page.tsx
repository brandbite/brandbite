// -----------------------------------------------------------------------------
// @file: app/admin/moodboards/[moodboardId]/page.tsx
// @purpose: Any moodboard, view only, for the brandbite team.
// -----------------------------------------------------------------------------

import { MoodboardViewLazy } from "@/components/moodboard/moodboard-view-lazy";

type Props = {
  params: Promise<{ moodboardId: string }>;
};

export default async function AdminMoodboardPage({ params }: Props) {
  const { moodboardId } = await params;

  return <MoodboardViewLazy moodboardId={moodboardId} basePath="/admin/moodboards" />;
}
