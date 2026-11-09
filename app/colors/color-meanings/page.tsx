// -----------------------------------------------------------------------------
// @file: app/colors/color-meanings/page.tsx
// @purpose: Color families with a detail panel, in the first HTML. CMS entries come
//           first, followed by built-in families.
// -----------------------------------------------------------------------------

import { ColorMeaningsView } from "@/components/colors/studio/color-meanings-view";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { getColorMeanings } from "@/lib/colors/content";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";

// Next.js needs a literal here: CMS changes show up within 5 minutes.
export const revalidate = 300;

export default async function ColorMeaningsHubPage() {
  const meanings = await getColorMeanings();
  return (
    <StudioShell
      title="Every color has a"
      accent="story."
      blurb="Explore the associations behind a shade, then put it to work."
      ctaBlurb="Turn color insights into on-brand palettes, shades, and more with brandbite."
    >
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Color Studio", path: "/colors" },
          { name: "Color Meanings", path: "/colors/color-meanings" },
        ])}
      />
      <ColorMeaningsView meanings={meanings} />
    </StudioShell>
  );
}
