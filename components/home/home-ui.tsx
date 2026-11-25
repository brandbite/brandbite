// -----------------------------------------------------------------------------
// @file: components/home/home-ui.tsx
// @purpose: The pieces the customer and creative Home pages share: the
//           greeting banner, the shortcut cards, the "needs you" list and the
//           recent-work cards.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

import { IconArrowRight, IconChevronRight, IconImage } from "@/components/admin/v2/icons";
import { Badge, IconTile, type Tone } from "@/components/admin/v2/ui";
import { HERO_IMAGE_SIZE, HERO_SCENES, resolveHeroSlot, type HeroSlot } from "@/lib/home/hero";

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none";

// ---------------------------------------------------------------------------
// Greeting banner
// ---------------------------------------------------------------------------

const subscribeToNothing = () => () => {};

/**
 * The banner's time-of-day slot, known as soon as the page is in the browser
 * (the server can't know the viewer's clock, so it renders none).
 */
export function useHeroSlot(): HeroSlot | null {
  return useSyncExternalStore(
    subscribeToNothing,
    () => resolveHeroSlot(new Date(), window.location.search),
    () => null,
  );
}

const HERO_FRAME = "relative mb-6 overflow-hidden rounded-3xl md:min-h-[320px]";

export function HomeHero({
  slot,
  loading,
  date,
  title,
  tagline,
  stats,
  actions,
}: {
  /** Time of day; picks the picture. Null until the page is in the browser. */
  slot: HeroSlot | null;
  /** The page's data is still on its way: show the picture, hold the words. */
  loading: boolean;
  date: string | null;
  title: string;
  tagline: string;
  stats?: ReactNode;
  actions?: ReactNode;
}) {
  if (!slot) {
    return <div aria-hidden className={`${HERO_FRAME} min-h-[260px] bg-[var(--av2-track)]`} />;
  }
  const scene = HERO_SCENES[slot];
  // The text sits on the picture's own wall color, so its colors follow the
  // picture, not the dashboard theme.
  const textColors = {
    color: scene.text,
    "--av2-text": scene.text,
    "--av2-text-2": scene.textMuted,
    "--hero-link": scene.link,
  } as CSSProperties;

  return (
    <header className={HERO_FRAME} style={{ backgroundColor: scene.wash }}>
      {/* Decorative: the greeting says everything the picture does. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={scene.src}
        alt=""
        aria-hidden
        width={HERO_IMAGE_SIZE.width}
        height={HERO_IMAGE_SIZE.height}
        className="pointer-events-none block h-36 w-full object-cover object-[78%_30%] md:absolute md:inset-y-0 md:right-0 md:h-full md:w-[70%] md:[mask-image:linear-gradient(to_right,transparent,black_30%)] md:object-[right_25%]"
      />
      <div className="relative px-6 py-7 md:max-w-[56%] md:px-9 md:py-9 xl:max-w-[48%]">
        {loading ? (
          <div aria-hidden style={{ color: scene.text }} className="space-y-3">
            <span className="block h-4 w-40 rounded bg-current opacity-15" />
            <span className="block h-11 w-80 max-w-full rounded-lg bg-current opacity-15" />
            <span className="block h-5 w-64 max-w-full rounded bg-current opacity-15" />
            <span className="block h-7 w-72 max-w-full rounded-full bg-current opacity-15" />
            <span className="block h-10 w-44 rounded-lg bg-current opacity-15" />
          </div>
        ) : (
          <>
            <div style={textColors}>
              {date ? <p className="text-[15px] text-[var(--av2-text-2)]">{date}</p> : null}
              <h1 className="mt-1 text-[32px] leading-10 font-bold tracking-tight md:text-[40px] md:leading-[48px]">
                {title}
              </h1>
              <p className="mt-1 text-lg text-[var(--av2-text-2)]">{tagline}</p>
              {stats ? (
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">{stats}</div>
              ) : null}
            </div>
            {actions ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div>
            ) : null}
          </>
        )}
      </div>
    </header>
  );
}

/** One figure in the banner; a link when it leads somewhere. */
export function HeroStat({
  icon,
  tone,
  href,
  children,
}: {
  icon: ReactNode;
  tone: Tone;
  href?: string;
  children: ReactNode;
}) {
  const body = (
    <>
      <IconTile tone={tone} size={28} round>
        {icon}
      </IconTile>
      <span className="text-[15px] font-medium">{children}</span>
    </>
  );
  return href ? (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full hover:underline ${FOCUS}`}
    >
      {body}
    </Link>
  ) : (
    <span className="inline-flex items-center gap-2">{body}</span>
  );
}

// ---------------------------------------------------------------------------
// Shortcut cards
// ---------------------------------------------------------------------------

export type Shortcut = { href: string; title: string; text: string; icon: ReactNode; tone: Tone };

export function ShortcutCards({ items }: { items: Shortcut[] }) {
  return (
    <nav aria-label="Shortcuts">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`flex h-full items-center gap-3.5 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-4 transition-colors hover:border-[var(--av2-text-2)] ${FOCUS}`}
            >
              <IconTile tone={item.tone} size={48}>
                {item.icon}
              </IconTile>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] leading-6 font-semibold">{item.title}</span>
                <span className="block truncate text-sm text-[var(--av2-text-2)]">{item.text}</span>
              </span>
              <IconChevronRight className="shrink-0 text-[var(--av2-text-2)]" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

const THUMB_FILL: Record<Tone, string> = {
  neutral: "bg-[var(--av2-track)] text-[var(--av2-text-2)]",
  peach: "bg-[var(--av2-selected)] text-[var(--av2-accent)]",
  lavender: "bg-[var(--av2-lavender-bg)] text-[#5b4fc4] dark:text-[#b8adf7]",
  green: "bg-[var(--av2-success-bg)] text-[#2f7a45] dark:text-[#7fd396]",
  amber: "bg-[#feead3] text-[#b25e09] dark:bg-[#37250f] dark:text-[#f2a33a]",
  red: "bg-[#fde3e1] text-[var(--av2-error)] dark:bg-[#3a1715]",
  blue: "bg-[#e6f0ff] text-[#2858b8] dark:bg-[#132440] dark:text-[#8db4ff]",
};

/** A picture when there is one; otherwise a tinted tile with a glyph. */
export function Thumb({
  src,
  tone = "neutral",
  icon,
  className,
}: {
  src?: string | null;
  tone?: Tone;
  icon?: ReactNode;
  className: string;
}) {
  if (src) {
    return (
      // Signed storage URLs: the Next image optimizer can't fetch them.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" loading="lazy" className={`${className} object-cover`} />
    );
  }
  return (
    <span
      aria-hidden
      className={`${className} flex items-center justify-center ${THUMB_FILL[tone]}`}
    >
      {icon ?? <IconImage />}
    </span>
  );
}

// ---------------------------------------------------------------------------
// "Needs you" list
// ---------------------------------------------------------------------------

export type AttentionItem = {
  key: string;
  title: string;
  detail: string;
  badge?: { label: string; tone: Tone };
  action: { label: string; href: string };
  thumbnailUrl?: string | null;
  tone?: Tone;
  icon?: ReactNode;
};

const OUTLINE_BUTTON = `inline-flex h-10 min-w-[104px] shrink-0 items-center justify-center rounded-lg border border-[var(--av2-accent)] px-4 text-sm font-semibold text-[var(--av2-link)] transition-colors hover:bg-[var(--av2-selected)] ${FOCUS}`;

export function AttentionList({
  title,
  items,
  total,
  empty,
  footer,
}: {
  title: string;
  items: AttentionItem[];
  /** All items, when more exist than are shown. */
  total: number;
  empty: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-6">
      <div className="flex items-center gap-3">
        <h2 className="text-[22px] leading-7 font-semibold">{title}</h2>
        {total > 0 ? (
          <span
            aria-label={`${total} ${total === 1 ? "item" : "items"}`}
            className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--av2-selected)] px-2 text-sm font-semibold text-[var(--av2-link)] tabular-nums"
          >
            {total}
          </span>
        ) : null}
      </div>
      {items.length === 0 ? (
        empty
      ) : (
        <ul className="mt-3">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--av2-border)] py-3 last:border-b-0 last:pb-0"
            >
              <Thumb
                src={item.thumbnailUrl}
                tone={item.tone}
                icon={item.icon}
                className="h-[68px] w-[112px] shrink-0 rounded-xl max-sm:hidden"
              />
              <div className="min-w-[160px] flex-1">
                <p className="truncate text-[17px] leading-6 font-semibold">{item.title}</p>
                <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">{item.detail}</p>
              </div>
              {item.badge ? <Badge tone={item.badge.tone}>{item.badge.label}</Badge> : null}
              <Link
                href={item.action.href}
                aria-label={`${item.action.label}: ${item.title}`}
                className={OUTLINE_BUTTON}
              >
                {item.action.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {footer}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recent work
// ---------------------------------------------------------------------------

export type RecentItem = {
  key: string;
  title: string;
  href: string;
  /** Shown as a badge when set, otherwise `detail` is plain text. */
  badge?: { label: string; tone: Tone };
  detail?: string;
  thumbnailUrl?: string | null;
  tone?: Tone;
  icon?: ReactNode;
};

export function RecentCards({ items }: { items: RecentItem[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.key}>
          <Link href={item.href} className={`group block rounded-xl ${FOCUS}`}>
            <Thumb
              src={item.thumbnailUrl}
              tone={item.tone}
              icon={item.icon}
              className="aspect-[11/5] w-full rounded-xl"
            />
            <span className="mt-2.5 block truncate text-[15px] font-semibold group-hover:underline">
              {item.title}
            </span>
            <span className="mt-1 block text-sm text-[var(--av2-text-2)]">
              {item.badge ? <Badge tone={item.badge.tone}>{item.badge.label}</Badge> : item.detail}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Underlined green action link with an arrow, as on the brand and recap cards. */
export function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded text-[15px] font-semibold text-[var(--hero-link,#256b3a)] underline underline-offset-2 dark:text-[var(--hero-link,#7fd396)] ${FOCUS}`}
    >
      {children}
      <IconArrowRight width={16} height={16} />
    </Link>
  );
}
