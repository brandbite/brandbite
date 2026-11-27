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
  action,
  accentBelow = false,
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
  /** A control on the pill's row, at the far side: the free tools' "Switch tool" menu. */
  action?: ReactNode;
  /** Put the accent part of the headline on a line of its own. */
  accentBelow?: boolean;
}) {
  const pill = (
    <div className="flex flex-wrap items-center gap-2 text-sm leading-5">
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
  );
  return (
    <div className="pt-4 pb-8">
      {action ? (
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-3">
          {pill}
          {action}
        </div>
      ) : null}
      <div className={`flex items-center justify-between gap-8 ${action ? "mt-4" : ""}`}>
        <div className="min-w-0">
          {action ? null : <div className="mb-4">{pill}</div>}
          <h1 className="text-[48px] leading-[56px] font-bold max-[767px]:text-[32px] max-[767px]:leading-10">
            {title}
            {accent ? (
              <span className={`text-[var(--cs-brand)] ${accentBelow ? "block" : ""}`}>
                {" "}
                {accent}
              </span>
            ) : null}
          </h1>
          <p className="mt-2 text-base leading-6 text-[var(--cs-muted)]">{blurb}</p>
        </div>
        {aside ? <div className="shrink-0 max-[767px]:hidden">{aside}</div> : null}
      </div>
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
  button = "Meet brandbite",
}: {
  blurb?: string;
  heading?: string;
  headingAccent?: string;
  button?: string;
}) {
  return (
    <section className="relative mt-8 flex min-h-[200px] items-center overflow-hidden rounded-2xl bg-[var(--cs-soft)] px-8 py-8 max-[767px]:px-5">
      <div className="relative z-10 max-w-[560px] max-[639px]:max-w-none">
        <h2 className="text-2xl leading-8 font-semibold">
          {heading}
          {headingAccent ? (
            <span className="text-[var(--cs-soft-text)]"> {headingAccent}</span>
          ) : null}
        </h2>
        <p className="mt-2 text-base leading-6">{blurb}</p>
        <Link href="/meet" className={`mt-4 ${studioButtonClasses("primary")}`}>
          {button}
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
  action,
  accentBelow,
  closing = "page",
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
  action?: ReactNode;
  accentBelow?: boolean;
  /**
   * How the page ends. "page": its own lavender band, then the footer's purple
   * Ready band. "ready": one lavender band that asks the Ready band's question,
   * and no purple band.
   */
  closing?: "page" | "ready";
  /** Section pill above the headline; Color Studio by default. */
  label?: string;
  /** Section menu; the Color Studio tool menu by default, none with null. */
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="color-studio min-h-screen w-full">
      <main id="main-content" className="mx-auto w-full max-w-[1312px]">
        <HomeHeader />
        <div className={`pt-6 ${CONTENT_GUTTER}`}>
          {nav === undefined ? <ToolNav /> : nav}
          <PageIntro
            title={title}
            accent={accent}
            blurb={blurb}
            breadcrumb={breadcrumb}
            aside={aside}
            action={action}
            accentBelow={accentBelow}
            label={label}
          />
          <div className="flex flex-col gap-6">{children}</div>
          {closing === "ready" ? (
            <CompactCTA
              heading="Ready to feed your brand better creative?"
              headingAccent=""
              blurb="Design on subscription."
              button="Get started"
            />
          ) : (
            <CompactCTA blurb={ctaBlurb} heading={ctaHeading} headingAccent={ctaHeadingAccent} />
          )}
        </div>
        <div className="mt-8">
          <HomeFooter readyBand={closing !== "ready"} />
        </div>
        <div className="h-5" />
      </main>
      <CopyFallback />
    </div>
  );
}
