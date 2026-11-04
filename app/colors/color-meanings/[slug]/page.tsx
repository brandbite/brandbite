// -----------------------------------------------------------------------------
// @file: app/colors/color-meanings/[slug]/page.tsx
// @purpose: Per-color page, in the first HTML: the long-form meaning next to the
//           same detail panel the hub uses. Built-in families also have a page.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MeaningPanel } from "@/components/colors/studio/color-meanings-view";
import { StudioShell, WorkspacePanel } from "@/components/colors/studio/studio-shell";
import { CMS_ALLOWED_ATTR, CMS_ALLOWED_TAGS, SafeHtml } from "@/components/ui/safe-html";
import { describeColor, formatHex, suggestPairings } from "@/lib/colors";
import { COLOR_FAMILIES } from "@/lib/colors/color-families";
import { getColorMeaning } from "@/lib/colors/content";
import { isBuiltInMeaning } from "@/lib/colors/meaning-types";
import { NAMED_COLORS } from "@/lib/colors/named-colors";

// Next.js needs a literal here: CMS changes show up within 5 minutes.
export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return COLOR_FAMILIES.map((family) => ({ slug: family.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const meaning = await getColorMeaning(slug);
  if (!meaning) return { title: "Color not found", robots: { index: false, follow: false } };
  return {
    // The parent layout's plain title turns off the site's "| Brandbite" template.
    title: { absolute: meaning.metaTitle || `${meaning.name} Color Meaning | brandbite` },
    description:
      meaning.metaDescription ||
      `What ${meaning.name.toLowerCase()} can communicate: ${meaning.summary ?? meaning.associations.join(", ")}`,
    alternates: { canonical: `/colors/color-meanings/${meaning.slug}` },
  };
}

export default async function ColorMeaningDetailPage({ params }: PageProps) {
  const meaning = await getColorMeaning((await params).slug);
  if (!meaning) notFound();

  const familyColors = NAMED_COLORS.filter(
    (color) => describeColor(color.hex).family === meaning.slug,
  );

  return (
    <StudioShell
      title="The story behind"
      accent={`${meaning.name.toLowerCase()}.`}
      blurb="What this color can communicate, and the shades that belong to it."
      breadcrumb={meaning.name}
    >
      <WorkspacePanel>
        <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start gap-8 max-[1023px]:grid-cols-1">
          <article className="min-w-0">
            <Link
              href="/colors/color-meanings"
              className="text-sm leading-5 font-medium text-[var(--cs-brand-strong)] underline"
            >
              All colors
            </Link>
            {meaning.meaning ? (
              <>
                <h2 className="mt-4 text-2xl leading-8 font-semibold">Meaning and psychology</h2>
                <SafeHtml
                  html={meaning.meaning}
                  allowedTags={CMS_ALLOWED_TAGS}
                  allowedAttrs={CMS_ALLOWED_ATTR}
                  className="prose mt-4 max-w-none"
                />
              </>
            ) : null}
            {familyColors.length > 0 ? (
              <>
                <h2 className="mt-4 text-2xl leading-8 font-semibold">
                  {meaning.name} colors and hex codes
                </h2>
                <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
                  {familyColors.map((color) => (
                    <li key={color.hex}>
                      <Link
                        href={`/colors/hex/${color.hex.slice(1)}`}
                        className="flex min-h-11 items-center gap-2 rounded-[10px] border border-[var(--cs-border)] p-2 hover:border-[var(--cs-text)]"
                      >
                        <span
                          className="h-8 w-8 shrink-0 rounded-md border border-[var(--cs-border)]"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm leading-5 font-medium">
                            {color.name}
                          </span>
                          <span className="block font-mono text-xs leading-4 text-[var(--cs-muted)]">
                            {formatHex(color.hex)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </article>
          <MeaningPanel
            meaning={meaning}
            detail={meaning}
            showReadMore={false}
            pairings={isBuiltInMeaning(meaning) ? suggestPairings(meaning.hex) : undefined}
          />
        </div>
      </WorkspacePanel>
    </StudioShell>
  );
}
