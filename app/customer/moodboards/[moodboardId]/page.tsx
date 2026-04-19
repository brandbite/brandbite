// -----------------------------------------------------------------------------
// @file: app/customer/moodboards/[moodboardId]/page.tsx
// @purpose: Moodboard editor page. The canvas bundle (dnd-kit, tiptap,
//           video embeds, drawing libs) is lazy-loaded on the client via
//           MoodboardViewLazy so the server-rendered HTML stays small.
// -----------------------------------------------------------------------------

import { MoodboardViewLazy } from "@/components/moodboard/moodboard-view-lazy";

type Props = {
  params: Promise<{ moodboardId: string }>;
};

export default async function MoodboardEditorPage({ params }: Props) {
  const { moodboardId } = await params;

  return <MoodboardViewLazy moodboardId={moodboardId} />;
}
