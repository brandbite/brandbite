// -----------------------------------------------------------------------------
// @file: app/creative/moodboards/[moodboardId]/page.tsx
// @purpose: A moodboard, for a creative. Their own are editable; a customer's is
//           view only. The API enforces which.
// -----------------------------------------------------------------------------

import { MoodboardViewLazy } from "@/components/moodboard/moodboard-view-lazy";

type Props = {
  params: Promise<{ moodboardId: string }>;
};

export default async function CreativeMoodboardPage({ params }: Props) {
  const { moodboardId } = await params;

  return <MoodboardViewLazy moodboardId={moodboardId} basePath="/creative/moodboards" />;
}
