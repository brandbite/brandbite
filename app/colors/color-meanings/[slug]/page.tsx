// -----------------------------------------------------------------------------
// @file: app/colors/color-meanings/[slug]/page.tsx
// @purpose: Per-color page: the long-form meaning next to the same detail panel
//           the hub uses. Client-side 404 like the other CMS detail pages.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { MeaningPanel, type MeaningDetail } from "@/components/colors/studio/color-meanings-view";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { StudioShell, WorkspacePanel } from "@/components/colors/studio/studio-shell";
import { CMS_ALLOWED_ATTR, CMS_ALLOWED_TAGS, SafeHtml } from "@/components/ui/safe-html";

export default function ColorMeaningDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [meaning, setMeaning] = useState<MeaningDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/color-meanings/${slug}`);
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && json?.meaning) {
          setMeaning(json.meaning);
          setStatus("ready");
        } else {
          setStatus("missing");
        }
      } catch {
        if (!cancelled) setStatus("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <StudioShell
      title="The story behind"
      accent={meaning ? `${meaning.name.toLowerCase()}.` : "every shade."}
      blurb="Associations, symbolism, and sample palettes for this color."
      breadcrumb={meaning?.name ?? "Color meanings"}
    >
      <WorkspacePanel>
        {status === "loading" ? (
          <p
            aria-busy="true"
            className="py-16 text-center text-sm leading-5 text-[var(--cs-muted)]"
          >
            Loading…
          </p>
        ) : status === "missing" || !meaning ? (
          <div className="py-16 text-center">
            <p className="text-base leading-6 font-medium">This color page wasn&apos;t found.</p>
            <Link
              href="/colors/color-meanings"
              className={`mt-4 ${studioButtonClasses("secondary")}`}
            >
              Back to Color meanings
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start gap-8 max-[1023px]:grid-cols-1">
            <article className="min-w-0">
              <Link
                href="/colors/color-meanings"
                className="text-sm leading-5 font-medium text-[var(--cs-brand-strong)] underline"
              >
                All colors
              </Link>
              <h2 className="mt-4 text-2xl leading-8 font-semibold">Meaning and psychology</h2>
              {meaning.meaning ? (
                <SafeHtml
                  html={meaning.meaning}
                  allowedTags={CMS_ALLOWED_TAGS}
                  allowedAttrs={CMS_ALLOWED_ATTR}
                  className="prose mt-4 max-w-none"
                />
              ) : (
                <p className="mt-4 text-base leading-6">{meaning.summary}</p>
              )}
            </article>
            <MeaningPanel meaning={meaning} detail={meaning} showReadMore={false} />
          </div>
        )}
      </WorkspacePanel>
    </StudioShell>
  );
}
