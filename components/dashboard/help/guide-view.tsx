// -----------------------------------------------------------------------------
// @file: components/dashboard/help/guide-view.tsx
// @purpose: A customer / creative Support guide: collapsible sections beside a
//           sticky "On this page" list. The sections use native <details>, so
//           keyboard access and find-in-page work. /admin/support keeps
//           SupportGuideView.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { IconChevronDown } from "@/components/admin/v2/icons";
import {
  Button,
  buttonClass,
  Callout,
  Card,
  Eyebrow,
  IconTile,
  PageHeader,
} from "@/components/admin/v2/ui";
import { GuideVote } from "@/components/support/guide-vote";
import { RichText } from "@/components/support/support-ui";
import {
  guideHref,
  primaryRoute,
  relatedGuides,
  supportBasePath,
  type GuideBlock,
  type SupportGuide,
} from "@/lib/support";

import { guideIcon, type HelpRole, StillStuckText, toAnchor } from "./guide-meta";

type TermItem = { term: string; text: string };

function isTermList(items: (string | TermItem)[]): items is TermItem[] {
  return items.every((i) => typeof i !== "string");
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
        <div role="note">
          <Callout tone="warning" title="Heads up">
            <RichText text={block.text} />
          </Callout>
        </div>
      );
  }
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
      <h2 className="px-2 pb-2 text-base font-semibold">On this page</h2>
      <ul className="space-y-0.5">
        {sections.map((s) => {
          const current = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={() => onPick(s.id)}
                aria-current={current ? "true" : undefined}
                className={`flex min-h-10 items-center rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none ${
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
}: {
  role: HelpRole;
  guide: SupportGuide;
  /** The role's guides with the CMS layer applied; code guides when absent. */
  guides?: SupportGuide[];
}) {
  const sections = useMemo(
    () => guide.sections.map((s) => ({ ...s, id: toAnchor(s.heading) })),
    [guide],
  );
  const related = relatedGuides(role, guide, { source: guides });
  const openHref = primaryRoute(guide);
  const showOpen = openHref && openHref !== supportBasePath(role);
  const showToc = sections.length >= 2;
  const collapsible = sections.length > 2;

  const [open, setOpen] = useState<Set<string>>(
    () => new Set(collapsible ? sections.slice(0, 1).map((s) => s.id) : sections.map((s) => s.id)),
  );
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);

  const openSection = (id: string) => {
    setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    setActive(id);
  };

  // Deep links and the browser's back button can point at a collapsed section.
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

  const allOpen = open.size === sections.length;
  const toc = showToc ? (
    <OnThisPage sections={sections} active={active} onPick={openSection} />
  ) : null;

  return (
    <>
      <Link
        href={`${supportBasePath(role)}#${toAnchor(guide.category)}`}
        className="mb-4 inline-flex min-h-10 items-center gap-1.5 rounded text-sm font-semibold text-[var(--av2-link)] hover:underline"
      >
        <span aria-hidden>←</span> Back to support
      </Link>

      <Eyebrow>{guide.category}</Eyebrow>
      <div className="mt-1">
        <PageHeader
          title={guide.title}
          description={guide.summary}
          actions={
            showOpen ? (
              <Link href={openHref} className={buttonClass("secondary")}>
                Open this page <span aria-hidden>→</span>
              </Link>
            ) : null
          }
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {toc && <div className="xl:hidden">{toc}</div>}

          {collapsible && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                onClick={() => setOpen(new Set(allOpen ? [] : sections.map((s) => s.id)))}
              >
                {allOpen ? "Collapse all" : "Expand all"}
              </Button>
            </div>
          )}

          {sections.map((s) => (
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
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-6 py-4 focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <h2 className="text-xl leading-7 font-semibold">{s.heading}</h2>
                <IconChevronDown
                  aria-hidden
                  className="shrink-0 text-[var(--av2-text-2)] transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="space-y-4 border-t border-[var(--av2-border)] px-6 py-5 text-base">
                {s.blocks.map((b, i) => (
                  <Block key={i} block={b} />
                ))}
              </div>
            </details>
          ))}

          <GuideVote key={guide.slug} slug={guide.slug} />
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
          {toc && <div className="hidden xl:block">{toc}</div>}

          {related.length > 0 && (
            <Card padding="sm">
              <nav aria-label="Related guides">
                <h2 className="px-2 pb-2 text-base font-semibold">Related guides</h2>
                <ul className="space-y-0.5">
                  {related.map((g) => (
                    <li key={g.slug}>
                      <Link
                        href={guideHref(role, g.slug)}
                        className="flex gap-3 rounded-lg p-2 hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
                      >
                        <IconTile tone="neutral" size={40}>
                          {guideIcon(g.slug)}
                        </IconTile>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{g.title}</span>
                          <span className="mt-0.5 block text-xs leading-4 text-[var(--av2-text-2)]">
                            {g.summary}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </Card>
          )}

          <Card padding="sm">
            <div className="px-2 py-1">
              <h2 className="text-base font-semibold">Still stuck?</h2>
              <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                <StillStuckText />
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
