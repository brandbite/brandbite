// -----------------------------------------------------------------------------
// @file: components/auth/auth-shell.tsx
// @purpose: Page chrome shared by the sign-up / log-in screens (2026 redesign).
//           Header (logo + "Back to home"), lavender BB panel on the left
//           (desktop) or a banner above the form (mobile), the form slot on
//           the right, and a © / Privacy footer row. Pure presentational —
//           the auth logic lives in app/login/page.tsx.
// @version: v1.1.0
// @status: active
// @lastUpdate: 2026-10-31
// -----------------------------------------------------------------------------

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { copyrightLine } from "@/lib/brand";
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_MAIN_LINKS,
  FOOTER_SOCIAL_LINKS,
} from "@/components/marketing/home-footer";

export const AUTH_DISPLAY_FONT = "font-[family-name:var(--font-inter)]";

/**
 * "fullbleed": the page itself is the layout — header and footer span the
 * viewport, the lavender panel is flush with the left edge, no card border.
 * "card": the same layout inside a centred, bordered, rounded card (the
 * original mockup). Flip this one constant to switch; everything else is
 * shared.
 */
const AUTH_SHELL_LAYOUT = "fullbleed" as "fullbleed" | "card";
const isCard = AUTH_SHELL_LAYOUT === "card";

const EDGE_PADDING = isCard ? "px-6" : "px-10 max-[1023px]:px-6";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={
        isCard
          ? "flex min-h-screen w-full flex-col items-center justify-center bg-[#F7F4F1] px-4 py-6 max-[767px]:px-3 max-[767px]:py-3"
          : "flex min-h-screen w-full flex-col bg-[#F7F4F1]"
      }
    >
      <div
        className={
          isCard
            ? "flex w-full max-w-[1060px] flex-col overflow-hidden rounded-2xl border border-[#E6E2DD] bg-[#FBF9F7] shadow-[0_8px_30px_rgba(43,45,51,0.06)]"
            : "flex w-full flex-1 flex-col"
        }
      >
        {/* Header */}
        <header
          className={`flex items-center justify-between py-4 max-[767px]:px-5 ${EDGE_PADDING}`}
        >
          <Link href="/" className="flex shrink-0" aria-label="Brandbite home">
            <Image src="/brandbite-logo.svg" alt="Brandbite" width={118} height={24} priority />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-[#2B2D33] transition-colors hover:text-[#FF6426]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <path
                d="M13 8H3M7 4 3 8l4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to home
          </Link>
        </header>

        {/* Body */}
        <div
          className={`flex flex-row items-stretch max-[1023px]:flex-col ${isCard ? "" : "flex-1"}`}
        >
          {/* Desktop: lavender BB panel */}
          <aside className="relative w-[52%] shrink-0 overflow-hidden bg-[#E7DEFC] max-[1023px]:hidden">
            <Image
              src="/home/auth-panel.webp"
              alt="Good creative. Great to have you. BB the unicorn working on a laptop."
              fill
              priority
              sizes="(min-width: 1024px) 52vw, 0px"
              className="object-contain object-bottom"
            />
          </aside>

          {/* Mobile / tablet: banner above the form */}
          <div
            className={`hidden pt-1 max-[1023px]:block ${isCard ? "px-5" : "px-6 max-[767px]:px-5"}`}
          >
            <Image
              src="/home/auth-banner.webp"
              alt="More bite. Less briefing drama. BB the unicorn working on a laptop."
              width={1400}
              height={732}
              priority
              sizes="(max-width: 1023px) 100vw, 0px"
              className="h-auto w-full rounded-xl"
            />
          </div>

          {/* Form slot */}
          <section
            className={`flex flex-1 flex-col justify-center px-14 max-[1179px]:px-8 max-[1023px]:justify-start max-[1023px]:px-5 max-[1023px]:py-6 ${
              isCard ? "py-10" : "py-12"
            }`}
          >
            <div className="mx-auto w-full max-w-[360px] max-[1023px]:max-w-[460px]">
              {children}
            </div>
          </section>
        </div>

        {/* Footer — same information as the marketing HomeFooter legal row
            (© line, main links, legal links, socials), minus logo + mascot. */}
        <footer
          className={`flex items-center justify-between gap-6 border-t border-[#E6E2DD] py-3 text-xs leading-5 font-medium text-[#5E616E] max-[1023px]:flex-col max-[1023px]:gap-2 max-[1023px]:text-center max-[767px]:px-5 ${EDGE_PADDING}`}
        >
          <p className="whitespace-nowrap max-[767px]:whitespace-normal">{copyrightLine()}</p>
          <nav
            aria-label="Footer"
            className="flex flex-row items-center gap-5 max-[1023px]:flex-wrap max-[1023px]:justify-center max-[767px]:gap-x-4 max-[767px]:gap-y-1"
          >
            {[...FOOTER_MAIN_LINKS, ...FOOTER_LEGAL_LINKS].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="whitespace-nowrap transition-colors hover:text-[#2B2D33]"
              >
                {link.label}
              </Link>
            ))}
            <span className="flex flex-row items-center gap-4">
              {FOOTER_SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex transition-opacity hover:opacity-70"
                >
                  <Image src={social.icon} alt={social.label} width={18} height={18} />
                </a>
              ))}
            </span>
          </nav>
        </footer>
      </div>
    </div>
  );
}

/** Title + subtitle block used on every auth screen. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h1
        className={`${AUTH_DISPLAY_FONT} text-[28px] leading-[1.15] font-extrabold tracking-tight text-[#2B2D33] max-[1023px]:text-[34px]`}
      >
        {title}
      </h1>
      <p className="mt-2 text-base leading-6 text-[#5E616E]">{subtitle}</p>
    </div>
  );
}

/** Shared styles for the auth form controls. */
export const AUTH_INPUT_CLASS =
  "h-11 w-full rounded-xl border border-[#D7D8DD] bg-white px-4 text-[15px] text-[#2B2D33] outline-none placeholder:text-[#9A9CA5] focus:border-[#FF6426] focus:ring-1 focus:ring-[#FF6426]";
export const AUTH_LABEL_CLASS = "mb-1.5 block text-sm font-bold text-[#2B2D33]";
export const AUTH_PRIMARY_BUTTON_CLASS =
  "flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-[#FF6426] text-base font-bold text-white transition-colors hover:bg-[#E8561C] disabled:cursor-not-allowed disabled:opacity-60";
export const AUTH_SECONDARY_BUTTON_CLASS =
  "flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-[#D7D8DD] bg-white text-sm font-bold text-[#2B2D33] transition-colors hover:border-[#FF6426] disabled:cursor-not-allowed disabled:opacity-60";
export const AUTH_LINK_CLASS =
  "font-semibold text-[#FF6426] underline underline-offset-2 hover:text-[#E8561C]";
export const AUTH_ERROR_CLASS =
  "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700";
