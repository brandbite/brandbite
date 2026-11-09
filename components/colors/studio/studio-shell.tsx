// -----------------------------------------------------------------------------
// @file: components/colors/studio/studio-shell.tsx
// @purpose: Page frame shared by every Color Studio and size guide page:
//           HomeHeader, a section menu (ToolNav),
//           PageIntro, the page's panels, CompactCTA and HomeFooter. The 1312px
//           wrapper minus HomeHeader's 56px padding gives the 1200px content
//           width, so content lines up with the header and footer edges.
// -----------------------------------------------------------------------------

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";

import { CopyFallback } from "./copy-fallback";
import { ArrowRightIcon, ChevronRightIcon } from "./icons";
import { studioButtonClasses } from "./studio-button";
import { ToolNav } from "./tool-nav";

import "./studio.css";

const CONTENT_GUTTER = "px-14 max-[1179px]:px-8 max-[767px]:px-4";

export function PageIntro({
  title,
  accent,
  blurb,
  breadcrumb,
  aside,
  label = "COLOR STUDIO",
}: {
  /** Dark part of the headline. */
  title: string;
  /** Accent part of the headline, in the brand orange. At 2.72:1 it is just under AA for large text, by product decision. */
  accent?: string;
  blurb: string;
  /** Current page name, for pages reached from another Color Studio page. */
  breadcrumb?: string;
  /** Decorative art beside the headline. Hidden on small screens. */
  aside?: ReactNode;
  /** Section pill above the headline. */
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-8 pt-4 pb-8">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm leading-5">
          <span className="rounded-full bg-[var(--cs-soft)] px-3 py-1 font-semibold text-[var(--cs-soft-text)]">
            {label}
          </span>
          {breadcrumb ? (
            <>
              <span className="text-[var(--cs-muted)]">
                <ChevronRightIcon />
              </span>
              <span className="font-medium">{breadcrumb}</span>
            </>
          ) : null}
        </div>
        <h1 className="text-[48px] leading-[56px] font-bold max-[767px]:text-[32px] max-[767px]:leading-10">
          {title}
          {accent ? <span className="text-[var(--cs-brand)]"> {accent}</span> : null}
        </h1>
        <p className="mt-2 text-base leading-6 text-[var(--cs-muted)]">{blurb}</p>
      </div>
      {aside ? <div className="shrink-0 max-[767px]:hidden">{aside}</div> : null}
    </div>
  );
}

export function WorkspacePanel({
  children,
  labelledBy,
}: {
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
    >
      {children}
    </section>
  );
}

export function CompactCTA({
  blurb = "Turn your palette into something real with brandbite.",
  heading = "Good colors.",
  headingAccent = "Better creative.",
}: {
  blurb?: string;
  heading?: string;
  headingAccent?: string;
}) {
  return (
    <section className="relative mt-8 flex min-h-[200px] items-center overflow-hidden rounded-2xl bg-[var(--cs-soft)] px-8 py-8 max-[767px]:px-5">
      <div className="relative z-10 max-w-[560px] max-[639px]:max-w-none">
        <h2 className="text-2xl leading-8 font-semibold">
          {heading} <span className="text-[var(--cs-soft-text)]">{headingAccent}</span>
        </h2>
        <p className="mt-2 text-base leading-6">{blurb}</p>
        <Link href="/meet" className={`mt-4 ${studioButtonClasses("primary")}`}>
          Meet brandbite
          <ArrowRightIcon />
        </Link>
      </div>
      <Image
        src="/home/unicorn-wave.webp"
        alt=""
        width={220}
        height={220}
        className="absolute right-8 bottom-[-12px] h-[220px] w-[220px] max-[639px]:hidden"
      />
    </section>
  );
}

export function StudioShell({
  title,
  accent,
  blurb,
  breadcrumb,
  ctaBlurb,
  ctaHeading,
  ctaHeadingAccent,
  aside,
  label,
  nav,
  children,
}: {
  title: string;
  accent?: string;
  blurb: string;
  breadcrumb?: string;
  ctaBlurb?: string;
  ctaHeading?: string;
  ctaHeadingAccent?: string;
  aside?: ReactNode;
  /** Section pill above the headline; Color Studio by default. */
  label?: string;
  /** Section menu; the Color Studio tool menu by default. */
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="color-studio min-h-screen w-full">
      <main id="main-content" className="mx-auto w-full max-w-[1312px]">
        <HomeHeader />
        <div className={`pt-6 ${CONTENT_GUTTER}`}>
          {nav ?? <ToolNav />}
          <PageIntro
            title={title}
            accent={accent}
            blurb={blurb}
            breadcrumb={breadcrumb}
            aside={aside}
            label={label}
          />
          <div className="flex flex-col gap-6">{children}</div>
          <CompactCTA blurb={ctaBlurb} heading={ctaHeading} headingAccent={ctaHeadingAccent} />
        </div>
        <div className="mt-8">
          <HomeFooter />
        </div>
        <div className="h-5" />
      </main>
      <CopyFallback />
    </div>
  );
}
