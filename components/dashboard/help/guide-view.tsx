// -----------------------------------------------------------------------------
// @file: components/dashboard/help/guide-view.tsx
// @purpose: One Support guide, for every dashboard (customer, creative,
//           admin). On narrow screens the side column follows the guide. Short guides show all sections; longer ones show the
//           first two and fold the rest into native <details>, so keyboard
//           access and find-in-page still work. Beside it, a sticky column
//           with "On this page", related guides and "Was this helpful?".
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowUpRight,
  IconChevronDown,
  IconChevronRight,
  IconImage,
} from "@/components/admin/v2/icons";
import { buttonClass, Callout, Eyebrow, IconTile } from "@/components/admin/v2/ui";
import { BreadcrumbDetail } from "@/components/navigation/breadcrumb-detail";
import { GuideVote } from "@/components/support/guide-vote";
import { ScreenshotView } from "@/components/support/screenshot-view";
import { RichText } from "@/components/support/support-ui";
import {
  guideHref,
  primaryRoute,
  relatedGuides,
  supportBasePath,
  type GuideBlock,
  type GuideSection,
  type SupportGuide,
  type SupportRole,
} from "@/lib/support";

import { pageLabel, StillStuckText, toAnchor } from "./guide-meta";

type TermItem = { term: string; text: string };
type Figure = Extract<GuideBlock, { type: "figure" }>;

/** Sections shown open before the rest fold away (longer guides only). */
const OPEN_SECTIONS = 2;

/** Guides up to this many sections show every section open. */
const SHORT_GUIDE = 3;

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none";

function isTermList(items: (string | TermItem)[]): items is TermItem[] {
  return items.every((i) => typeof i !== "string");
}

/** Whether a figure shows anything: an image, or (admin pages) its empty slot. */
function figureShows(block: Figure, role: SupportRole) {
  return !!block.image || role === "admin";
}

function GuideFigure({
  block,
  number,
  editHref,
}: {
  block: Figure;
  number: number | null;
  /** Admin pages: where to add the missing screenshot. */
  editHref?: string;
}) {
  if (block.image) {
    return (
      <figure className="flex flex-col gap-2">
        <ScreenshotView
          image={block.image}
          mobileImage={block.mobileImage}
          alt={block.alt ?? block.caption}
          caption={block.caption}
          tone="dashboard"
          frameClassName="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-bg)]"
          expandable
        />
        <figcaption className="text-sm text-[var(--av2-text-2)] italic">
          {number !== null ? `Figure ${number}. ` : ""}
          {block.caption}
        </figcaption>
      </figure>
    );
  }

  // An empty slot, shown on admin pages only: it marks where a screenshot goes.
  return (
    <figure
      aria-label={`Screenshot to add: ${block.caption}`}
      className="overflow-hidden rounded-2xl border border-dashed border-[var(--av2-border)] bg-[var(--av2-surface)]"
    >
      <div className="flex items-center gap-3 bg-[var(--av2-lavender-bg)] px-4 py-3">
        <IconTile tone="neutral" size={40}>
          <IconImage />
        </IconTile>
        <figcaption className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Screenshot to add</span>
          <span className="block text-sm text-[var(--av2-text-2)]">{block.caption}</span>
        </figcaption>
        {editHref && (
          <Link
            href={editHref}
            className={`shrink-0 text-sm font-semibold text-[var(--av2-link)] hover:underline ${FOCUS}`}
          >
            Add it
          </Link>
        )}
      </div>
      <div aria-hidden className="grid grid-cols-4 gap-3 p-4 max-sm:grid-cols-2">
        {[0, 1, 2, 3].map((col) => (
          <div key={col} className="flex flex-col gap-2 rounded-xl bg-[var(--av2-bg)] p-3">
            <span className="h-2 w-1/2 rounded-full bg-[var(--av2-track)]" />
            {[0, 1].map((card) => (
              <span
                key={card}
                className="flex flex-col gap-1.5 rounded-lg bg-[var(--av2-surface)] p-2.5"
              >
                <span className="h-2 w-4/5 rounded-full bg-[var(--av2-track)]" />
                <span className="h-2 w-1/2 rounded-full bg-[var(--av2-track)]" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </figure>
  );
}

function Block({
  block,
  figureNumber,
  editHref,
}: {
  block: GuideBlock;
  figureNumber: number | null;
  editHref?: string;
}) {
  switch (block.type) {
    case "p":
      return (
        <p className="leading-7">
          <RichText text={block.text} />
        </p>
      );
    case "steps":
      return (
        <ol className="list-decimal space-y-2 pl-6 leading-7 marker:font-semibold marker:text-[var(--av2-text-2)]">
          {block.items.map((item, i) => (
            <li key={i} className="pl-1">
              <RichText text={item} />
            </li>
          ))}
        </ol>
      );
    case "list":
      if (isTermList(block.items)) {
        return (
          <dl className="divide-y divide-[var(--av2-border)] border-y border-[var(--av2-border)]">
            {block.items.map((item) => (
              <div
                key={item.term}
                className="gap-4 py-3 sm:grid sm:grid-cols-[176px_minmax(0,1fr)]"
              >
                <dt className="font-semibold">{item.term}</dt>
                <dd className="leading-7 text-[var(--av2-text-2)]">
                  <RichText text={item.text} />
                </dd>
              </div>
            ))}
          </dl>
        );
      }
      return (
        <ul className="list-disc space-y-2 pl-6 leading-7 marker:text-[var(--av2-text-2)]">
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
        <Callout tone="info" title="Tip">
          <RichText text={block.text} />
        </Callout>
      );
    case "warning":
      return (
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-[#f3d58a] bg-[#fff8e5] px-4 py-3.5 leading-6 font-medium text-[#7a4a00] dark:border-[#6b4a1a] dark:bg-[#2e2110] dark:text-[#f2c27a]"
        >
          <IconAlertCircle className="mt-0.5 shrink-0" />
          <p>
            <span className="sr-only">Heads up: </span>
            <RichText text={block.text} />
          </p>
        </div>
      );
    case "figure":
      return <GuideFigure block={block} number={figureNumber} editHref={editHref} />;
  }
}

function SectionBody({
  section,
  role,
  figureNumbers,
  editHref,
}: {
  section: GuideSection & { id: string };
  role: SupportRole;
  figureNumbers: Map<GuideBlock, number>;
  editHref?: string;
}) {
  return (
    <div className="space-y-5 text-base">
      {section.blocks
        .filter((b) => b.type !== "figure" || figureShows(b, role))
        .map((b, i) => (
          <Block
            key={i}
            block={b}
            figureNumber={figureNumbers.get(b) ?? null}
            editHref={editHref}
          />
        ))}
    </div>
  );
}

function OnThisPage({
  sections,
  active,
  onPick,
}: {
  sections: { id: string; heading: string }[];
  active: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <nav
      aria-label="On this page"
      className="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-4"
    >
      <h2 className="px-2 pb-3 text-lg leading-7 font-semibold">On this page</h2>
      <ul className="space-y-0.5">
        {sections.map((s) => {
          const current = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={() => onPick(s.id)}
                aria-current={current ? "true" : undefined}
                className={`flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium ${FOCUS} ${
                  current
                    ? "bg-[var(--av2-selected)] text-[var(--av2-link)] shadow-[inset_3px_0_0_var(--av2-accent)]"
                    : "hover:bg-[var(--av2-bg)]"
                }`}
              >
                {s.heading}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function GuideView({
  role,
  guide,
  guides,
  isSiteOwner = false,
}: {
  role: SupportRole;
  guide: SupportGuide;
  /** The role's guides with the CMS layer applied; code guides when absent. */
  guides?: SupportGuide[];
  /** Admin only: owner-only guides can be listed as related. */
  isSiteOwner?: boolean;
}) {
  const sections = useMemo(
    () => guide.sections.map((s) => ({ ...s, id: toAnchor(s.heading) })),
    [guide],
  );
  const related = relatedGuides(role, guide, { source: guides, isSiteOwner });
  const openHref = primaryRoute(guide);
  const showOpen = !!openHref && openHref !== supportBasePath(role);
  const openLabel = openHref ? pageLabel(role, openHref) : undefined;
  const showToc = sections.length >= 2;
  const foldFrom = sections.length > SHORT_GUIDE ? OPEN_SECTIONS : sections.length;
  const editHref = role === "admin" ? `/admin/support-content/admin/${guide.slug}` : undefined;

  // Number the screenshots that are actually shown, in reading order.
  const figureNumbers = useMemo(() => {
    const numbers = new Map<GuideBlock, number>();
    for (const s of guide.sections) {
      for (const b of s.blocks)
        if (b.type === "figure" && b.image) numbers.set(b, numbers.size + 1);
    }
    return numbers;
  }, [guide]);

  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);

  const openSection = (id: string) => {
    setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    setActive(id);
  };

  // Deep links and the browser's back button can point at a folded section.
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!sections.some((s) => s.id === id)) return;
      setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
      setActive(id);
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView?.());
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [sections]);

  // Follow the reader through the page.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-96px 0px -70% 0px" },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  const toc = showToc ? (
    <OnThisPage sections={sections} active={active} onPick={openSection} />
  ) : null;

  return (
    <>
      <BreadcrumbDetail label={guide.title} />

      <Link
        href={`${supportBasePath(role)}#${toAnchor(guide.category)}`}
        className={`mb-6 inline-flex min-h-10 items-center gap-2 rounded text-sm font-semibold hover:text-[var(--av2-link)] ${FOCUS}`}
      >
        <IconArrowLeft aria-hidden /> All guides
      </Link>

      <div className="grid items-start gap-8 min-[1140px]:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="min-w-0">
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-[var(--av2-border)] pb-8">
            <div className="min-w-0 flex-1 basis-80">
              <Eyebrow>{guide.category}</Eyebrow>
              <h1 className="mt-1 text-[32px] leading-10 font-bold tracking-tight">
                {guide.title}
              </h1>
              <p className="mt-2 text-base text-[var(--av2-text-2)]">{guide.summary}</p>
            </div>
            {showOpen && (
              <Link href={openHref} className={buttonClass("primary")}>
                Open {openLabel ?? "this page"} <IconArrowUpRight aria-hidden />
              </Link>
            )}
          </header>

          {toc && <div className="mt-8 min-[1140px]:hidden">{toc}</div>}

          <div className="mt-10 space-y-12">
            {sections.slice(0, foldFrom).map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
                <h2 id={`${s.id}-h`} className="mb-4 text-2xl leading-8 font-semibold">
                  {s.heading}
                </h2>
                <SectionBody
                  section={s}
                  role={role}
                  figureNumbers={figureNumbers}
                  editHref={editHref}
                />
              </section>
            ))}
          </div>

          {foldFrom < sections.length && (
            <div className="mt-12 space-y-3">
              {sections.slice(foldFrom).map((s) => {
                const hasFigure = s.blocks.some((b) => b.type === "figure" && figureShows(b, role));
                return (
                  <details
                    key={s.id}
                    id={s.id}
                    open={open.has(s.id)}
                    onToggle={(e) => {
                      const isOpen = e.currentTarget.open;
                      setOpen((prev) => {
                        if (prev.has(s.id) === isOpen) return prev;
                        const next = new Set(prev);
                        if (isOpen) next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      });
                    }}
                    className="group scroll-mt-24 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)]"
                  >
                    <summary
                      className={`flex min-h-16 cursor-pointer list-none items-center gap-4 rounded-2xl px-5 py-4 [&::-webkit-details-marker]:hidden ${FOCUS}`}
                    >
                      {hasFigure && (
                        <IconImage
                          aria-label="Has a screenshot"
                          className="shrink-0 text-[var(--av2-text-2)]"
                        />
                      )}
                      <h2 className="min-w-0 flex-1 text-xl leading-7 font-semibold">
                        {s.heading}
                      </h2>
                      <IconChevronDown
                        aria-hidden
                        width={20}
                        height={20}
                        className="shrink-0 text-[var(--av2-text-2)] transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <div className="border-t border-[var(--av2-border)] px-5 py-5">
                      <SectionBody
                        section={s}
                        role={role}
                        figureNumbers={figureNumbers}
                        editHref={editHref}
                      />
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </article>

        <aside className="min-w-0 space-y-4 min-[1140px]:sticky min-[1140px]:top-24 min-[1140px]:max-h-[calc(100vh-7rem)] min-[1140px]:overflow-y-auto">
          {toc && <div className="hidden min-[1140px]:block">{toc}</div>}

          {related.length > 0 && (
            <nav
              aria-label="Related guides"
              className="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-4"
            >
              <h2 className="px-2 pb-1 text-lg leading-7 font-semibold">Related guides</h2>
              <ul className="divide-y divide-[var(--av2-border)]">
                {related.map((g) => (
                  <li key={g.slug}>
                    <Link
                      href={guideHref(role, g.slug)}
                      className={`group flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-[var(--av2-bg)] ${FOCUS}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{g.title}</span>
                        <span className="mt-0.5 block text-sm leading-5 text-[var(--av2-text-2)]">
                          {g.summary}
                        </span>
                      </span>
                      <IconChevronRight
                        aria-hidden
                        className="shrink-0 text-[var(--av2-text-2)] transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <GuideVote key={guide.slug} slug={guide.slug} />

          <p className="px-2 text-sm text-[var(--av2-text-2)]">
            Still stuck? <StillStuckText />
          </p>
        </aside>
      </div>
    </>
  );
}
