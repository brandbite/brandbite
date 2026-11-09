// -----------------------------------------------------------------------------
// @file: components/marketing/home-footer.tsx
// @purpose: Marketing footer (footer v2 design, Nov 2026): the purple Ready CTA
//           band, then BB + logo, tagline and socials beside four link
//           columns (Free tools, Resources, Company, Legal), and the © line.
//           The columns give every free tool and resource a link from every
//           marketing page, which search engines use to find and rank them.
//           Horizontal padding is 56px (px-14) to line up with HomeHeader.
// @version: v3.0.0
// @status: active
// @lastUpdate: 2026-11-09
// -----------------------------------------------------------------------------

import Image from "next/image";
import Link from "next/link";

import { copyrightLine } from "@/lib/brand";

import { ReadyBand } from "./ready-band";

/** Main navigation links — shared with the auth-page footer (AuthShell). */
export const FOOTER_MAIN_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/** Social profiles — shared with the auth-page footer (AuthShell). */
export const FOOTER_SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/brandbitestudio/",
    icon: "/home/instagram-dark.svg",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/brandbitestudio/",
    icon: "/home/linkedin-dark.svg",
  },
];

// Cookie information lives as a section inside the Privacy Policy, which also
// hosts the "Cookie settings" button for the analytics consent banner.
// /cookies permanently redirects there.
export const FOOTER_LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use", href: "/terms" },
  { label: "Cookie Notice", href: "/privacy#cookies" },
  { label: "Accessibility", href: "/accessibility" },
];

type FooterLink = { label: string; href: string; arrow?: boolean };

export const FOOTER_COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Free tools",
    links: [
      { label: "Color Studio", href: "/colors" },
      { label: "Size Guide", href: "/sizes" },
      { label: "Brief Generator", href: "/brief-generator" },
      { label: "Brand Kit", href: "/brand-kit" },
      { label: "Cost Calculator", href: "/design-cost-calculator" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Guides", href: "/guides" },
      { label: "Downloadable Templates", href: "/templates" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Meet brandbite", href: "/meet", arrow: true },
      { label: "FAQ", href: "/faq" },
    ],
  },
  { title: "Legal", links: FOOTER_LEGAL_LINKS },
];

function Socials() {
  return (
    <div className="flex flex-row items-center gap-8">
      {FOOTER_SOCIAL_LINKS.map((social) => (
        <a
          key={social.label}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={social.label}
          className="flex h-11 w-11 items-center justify-center transition-opacity hover:opacity-70"
        >
          <Image src={social.icon} alt="" width={26} height={26} />
        </a>
      ))}
    </div>
  );
}

export function HomeFooter({ variant = "home" }: { variant?: "home" | "coming-soon" }) {
  const isComingSoon = variant === "coming-soon";

  return (
    <>
      <ReadyBand />
      {/* Bottom padding is left to the page-level <div className="h-5" /> spacer
          that follows every <HomeFooter /> call site. */}
      <footer
        className={`flex w-full flex-col px-14 pt-12 max-[1179px]:px-8 max-[767px]:px-5 max-[767px]:pt-10 ${
          isComingSoon ? "bg-white" : ""
        }`}
      >
        <div className="grid grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))] gap-8 max-[1023px]:grid-cols-4 max-[767px]:grid-cols-2 max-[767px]:gap-x-6 max-[767px]:gap-y-10">
          {/* Brand: mascot + logo, tagline, socials. Full width above the
              columns on tablets; logo and socials share a row on phones. */}
          <div className="flex flex-col gap-4 max-[1023px]:col-span-4 max-[767px]:col-span-2 max-[767px]:border-b max-[767px]:border-[#D7D8DD] max-[767px]:pb-8">
            <div className="flex flex-row items-center justify-between gap-4">
              <Link
                href="/"
                className="flex shrink-0 flex-row items-center"
                aria-label="brandbite home"
              >
                {/* BB peeking over the wordmark — the 49×66 box crops a 49×84 render */}
                <span className="relative block h-[66px] w-[49px] shrink-0 overflow-hidden">
                  <Image
                    src="/home/footer-bb.webp"
                    alt=""
                    width={49}
                    height={84}
                    className="absolute top-[-6px] left-0 h-[84px] w-[49px] max-w-none"
                  />
                </span>
                <Image
                  src="/brandbite-logo.svg"
                  alt="brandbite"
                  width={170}
                  height={36}
                  className="max-[767px]:w-[140px]"
                />
              </Link>
              <div className="hidden max-[767px]:block">
                <Socials />
              </div>
            </div>
            <p className="text-base leading-6 text-[#5E616E]">Design on subscription.</p>
            <div className="-ml-2.5 max-[767px]:hidden">
              <Socials />
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-lg leading-7 font-bold text-[#2B2D33]">{column.title}</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-6 items-center gap-1.5 text-base leading-6 text-[#5E616E] transition-colors hover:text-[#FF6426]"
                    >
                      {link.label}
                      {link.arrow ? (
                        <span aria-hidden="true" className="text-[#C2410C]">
                          →
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 border-t border-[#D7D8DD] pt-6 text-sm leading-5 text-[#5E616E] max-[767px]:mt-10">
          <p>{copyrightLine()}</p>
        </div>
      </footer>
    </>
  );
}
