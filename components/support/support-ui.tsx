// -----------------------------------------------------------------------------
// @file: components/support/support-ui.tsx
// @purpose: Shared rendering for the in-dashboard Support section — theming
//           that works in both shells (customer/creative --bb-* tokens and the
//           admin v2 --av2-* tokens), the **bold** text renderer and the guide
//           body. Server-safe (no hooks).
// -----------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import type { GuideBlock, SupportGuide, SupportRole } from "@/lib/support";
import { guideHref, primaryRoute, relatedGuides, supportBasePath } from "@/lib/support";

/**
 * Support pages render inside two different shells. Map each shell's tokens
 * onto --sp-* so the components below only reference one vocabulary.
 */
export function supportThemeStyle(role: SupportRole): CSSProperties {
  const vars =
    role === "admin"
      ? {
          "--sp-text": "var(--av2-text)",
          "--sp-muted": "var(--av2-text-2)",
          "--sp-border": "var(--av2-border)",
          "--sp-card": "var(--av2-surface)",
          "--sp-card-hover": "var(--av2-bg)",
          "--sp-accent": "var(--av2-accent)",
          "--sp-link": "var(--av2-link)",
          "--sp-tip-bg": "var(--av2-lavender-bg)",
          "--sp-tip-border": "var(--av2-border)",
        }
      : {
          "--sp-text": "var(--bb-secondary)",
          "--sp-muted": "var(--bb-text-secondary)",
          "--sp-border": "var(--bb-border)",
          "--sp-card": "var(--bb-bg-page)",
          "--sp-card-hover": "var(--bb-bg-warm)",
          "--sp-accent": "var(--bb-primary)",
          "--sp-link": "var(--bb-primary)",
          "--sp-tip-bg": "var(--bb-info-bg)",
          "--sp-tip-border": "var(--bb-info-border)",
        };
  return vars as CSSProperties;
}

export function SupportScope({ role, children }: { role: SupportRole; children: ReactNode }) {
  return (
    <div style={supportThemeStyle(role)} className="mx-auto w-full max-w-4xl text-[var(--sp-text)]">
      {children}
    </div>
  );
}

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

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className="leading-7">
          <RichText text={block.text} />
        </p>
      );
    case "steps":
      return (
        <ol className="list-decimal space-y-2 pl-6 leading-7 marker:font-semibold marker:text-[var(--sp-muted)]">
          {block.items.map((item, i) => (
            <li key={i} className="pl-1">
              <RichText text={item} />
            </li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="list-disc space-y-2 pl-6 leading-7 marker:text-[var(--sp-muted)]">
          {block.items.map((item, i) => (
            <li key={i} className="pl-1">
              {typeof item === "string" ? (
                <RichText text={item} />
              ) : (
                <>
                  <span className="font-semibold">{item.term}</span>
                  {" — "}
                  <RichText text={item.text} />
                </>
              )}
            </li>
          ))}
        </ul>
      );
    case "tip":
      return (
        <div className="rounded-xl border border-[var(--sp-tip-border)] bg-[var(--sp-tip-bg)] px-4 py-3 leading-7">
          <span className="font-semibold">Tip: </span>
          <RichText text={block.text} />
        </div>
      );
    case "warning":
      return (
        <div
          role="note"
          className="rounded-xl border border-[var(--bb-warning-border)] bg-[var(--bb-warning-bg)] px-4 py-3 leading-7 text-[var(--bb-warning-text)]"
        >
          <span className="font-semibold">Heads up: </span>
          <RichText text={block.text} />
        </div>
      );
  }
}

function sectionId(heading: string) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function SupportGuideView({
  role,
  guide,
  isSiteOwner = false,
}: {
  role: SupportRole;
  guide: SupportGuide;
  isSiteOwner?: boolean;
}) {
  const related = relatedGuides(role, guide, { isSiteOwner });
  const openHref = primaryRoute(guide);
  const showOpen = openHref && openHref !== supportBasePath(role);
  const showToc = guide.sections.length >= 3;

  return (
    <SupportScope role={role}>
      <Link
        href={supportBasePath(role)}
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--sp-muted)] hover:text-[var(--sp-text)]"
      >
        <span aria-hidden>←</span> Support
      </Link>

      <header className="mt-4 mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--sp-border)] pb-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-[var(--sp-muted)] uppercase">
            {guide.category}
          </p>
          <h1 className="mt-1 text-[28px] leading-9 font-bold tracking-tight">{guide.title}</h1>
          <p className="mt-2 text-base text-[var(--sp-muted)]">{guide.summary}</p>
        </div>
        {showOpen && (
          <Link
            href={openHref}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--sp-border)] bg-[var(--sp-card)] px-4 text-sm font-semibold hover:bg-[var(--sp-card-hover)] focus-visible:ring-2 focus-visible:ring-[var(--sp-accent)] focus-visible:outline-none"
          >
            Open this page <span aria-hidden>→</span>
          </Link>
        )}
      </header>

      {showToc && (
        <nav
          aria-label="On this page"
          className="mb-8 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-card)] px-5 py-4"
        >
          <p className="text-sm font-semibold">On this page</p>
          <ul className="mt-2 space-y-1 text-sm">
            {guide.sections.map((s) => (
              <li key={s.heading}>
                <a
                  href={`#${sectionId(s.heading)}`}
                  className="text-[var(--sp-link)] hover:underline"
                >
                  {s.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="space-y-10">
        {guide.sections.map((s) => (
          <section key={s.heading} id={sectionId(s.heading)} className="scroll-mt-24">
            <h2 className="mb-3 text-xl font-bold tracking-tight">{s.heading}</h2>
            <div className="space-y-4 text-[15px]">
              {s.blocks.map((b, i) => (
                <Block key={i} block={b} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {related.length > 0 && (
        <nav aria-label="Related guides" className="mt-12 border-t border-[var(--sp-border)] pt-6">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Related guides</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {related.map((g) => (
              <li key={g.slug}>
                <Link
                  href={guideHref(role, g.slug)}
                  className="block h-full rounded-xl border border-[var(--sp-border)] bg-[var(--sp-card)] px-5 py-4 transition-colors hover:bg-[var(--sp-card-hover)] focus-visible:ring-2 focus-visible:ring-[var(--sp-accent)] focus-visible:outline-none"
                >
                  <span className="block font-semibold">{g.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--sp-muted)]">
                    {g.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </SupportScope>
  );
}
