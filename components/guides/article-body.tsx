// -----------------------------------------------------------------------------
// @file: components/guides/article-body.tsx
// @purpose: Renders a public guide's sections and blocks as an article, in the
//           first HTML. Same block format as the Support guides.
// -----------------------------------------------------------------------------

import { RichText } from "@/components/support/support-ui";
import { sectionAnchor } from "@/lib/guides";
import type { GuideBlock, SupportGuide } from "@/lib/support/types";

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p>
          <RichText text={block.text} />
        </p>
      );
    case "steps":
      return (
        <ol className="list-decimal space-y-2 pl-6">
          {block.items.map((item, i) => (
            <li key={i}>
              <RichText text={item} />
            </li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="list-disc space-y-2 pl-6">
          {block.items.map((item, i) => (
            <li key={i}>
              {typeof item === "string" ? (
                <RichText text={item} />
              ) : (
                <>
                  <strong className="font-semibold">
                    {/[?.!:]$/.test(item.term) ? item.term : `${item.term}:`}
                  </strong>{" "}
                  <RichText text={item.text} />
                </>
              )}
            </li>
          ))}
        </ul>
      );
    case "tip":
    case "warning":
      return (
        <aside
          className={`rounded-xl border-l-4 px-5 py-4 ${
            block.type === "tip"
              ? "border-[var(--cs-selected)] bg-[var(--cs-soft)]"
              : "border-[var(--cs-brand-strong)] bg-[#fff4ee]"
          }`}
        >
          <p className="mb-1 text-sm font-semibold">{block.type === "tip" ? "Tip" : "Watch out"}</p>
          <p>
            <RichText text={block.text} />
          </p>
        </aside>
      );
    case "figure":
      // An empty screenshot slot shows nothing on the public site.
      if (!block.image) return null;
      return (
        <figure className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- CMS uploads, sizes vary */}
          <img
            src={block.image}
            alt={block.alt ?? block.caption}
            loading="lazy"
            className="w-full rounded-xl border border-[var(--cs-border)]"
          />
          <figcaption className="text-sm leading-6 text-[var(--cs-muted)]">
            {block.caption}
          </figcaption>
        </figure>
      );
  }
}

export function ArticleBody({ guide }: { guide: SupportGuide }) {
  return (
    <div className="flex flex-col gap-10 text-[17px] leading-8">
      {guide.sections.map((section) => (
        <section key={section.heading} aria-labelledby={sectionAnchor(section.heading)}>
          <h2
            id={sectionAnchor(section.heading)}
            className="mb-4 scroll-mt-24 text-2xl leading-8 font-semibold"
          >
            {section.heading}
          </h2>
          <div className="flex flex-col gap-4">
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function TableOfContents({ guide }: { guide: SupportGuide }) {
  return (
    <nav aria-label="On this page" className="text-sm leading-5">
      <p className="mb-3 font-semibold">On this page</p>
      <ol className="flex flex-col gap-2">
        {guide.sections.map((section) => (
          <li key={section.heading}>
            <a
              href={`#${sectionAnchor(section.heading)}`}
              className="text-[var(--cs-muted)] hover:text-[var(--cs-text)] hover:underline"
            >
              {section.heading}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
