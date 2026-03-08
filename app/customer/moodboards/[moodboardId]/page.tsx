// -----------------------------------------------------------------------------
// @file: app/customer/moodboards/[moodboardId]/page.tsx
// @purpose: Moodboard editor page — renders the full board view
// -----------------------------------------------------------------------------

import { MoodboardView } from "@/components/moodboard/moodboard-view";

type Props = {
  params: Promise<{ moodboardId: string }>;
};

export default async function MoodboardEditorPage({ params }: Props) {
  const { moodboardId } = await params;

  return <MoodboardView moodboardId={moodboardId} />;
}
