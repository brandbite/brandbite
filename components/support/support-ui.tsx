// -----------------------------------------------------------------------------
// @file: components/support/support-ui.tsx
// @purpose: The **bold** text renderer shared by the Support guides, the
//           public /guides articles and the Support content editor.
//           Server-safe (no hooks). The pages themselves live in
//           components/dashboard/help.
// -----------------------------------------------------------------------------

/** Renders `**bold**` spans; everything else is plain text. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}
