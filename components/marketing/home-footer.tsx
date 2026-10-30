// -----------------------------------------------------------------------------
// @file: components/marketing/home-footer.tsx
// @purpose: Marketing footer for the redesigned homepage, coming-soon page and
//           every other Figma-redesigned marketing page. Implements Figma
//           node 15:92 ("Footer"): BB mascot + logo and the About/Contact/
//           social row on top, then a hairline and the legal row — © notice
//           (lib/brand.ts) on the left, policy links on the right.
//           Horizontal padding is 56px (px-14) to line up with HomeHeader
//           rather than the 100px inset drawn in Figma, so logo + hairline
//           share the header's left/right edges.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-10-30
// -----------------------------------------------------------------------------

import Image from "next/image";
import Link from "next/link";
import { copyrightLine } from "@/lib/brand";

const MAIN_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
];

// "Cookie Preferences" points at the cookie policy for now — there is no
// consent-preference centre in the app yet. Swap the href once one exists.
const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Cookie Notice", href: "/cookies" },
  { label: "Cookie Preferences", href: "/cookies" },
  { label: "Terms of Use", href: "/terms" },
];

export function HomeFooter({ variant = "home" }: { variant?: "home" | "coming-soon" }) {
  const isComingSoon = variant === "coming-soon";

  return (
    // Bottom padding is left to the page-level <div className="h-5" /> spacer
    // that follows every <HomeFooter /> call site.
    <footer
      className={`flex w-full flex-col gap-2.5 px-14 pt-5 max-[1179px]:px-8 max-[767px]:px-5 ${
        isComingSoon ? "bg-white" : ""
      }`}
    >
      {/* Top row — mascot + logo, main links, socials */}
      <div className="flex w-full flex-row items-center justify-between max-[767px]:flex-col max-[767px]:gap-5">
        <Link href="/" className="flex shrink-0 flex-row items-center" aria-label="Brandbite home">
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
          <Image src="/brandbite-logo.svg" alt="Brandbite" width={210} height={44} />
        </Link>

        <nav
          aria-label="Footer"
          className="flex shrink-0 flex-row items-center gap-[50px] max-[929px]:gap-8 max-[767px]:flex-wrap max-[767px]:justify-center max-[767px]:gap-6"
        >
          {MAIN_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-base leading-none font-medium whitespace-nowrap text-[#2B2D33] transition-colors hover:text-[#FF6426]"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://www.instagram.com/brandbitestudio/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex transition-opacity hover:opacity-70"
          >
            <Image src="/home/instagram-dark.svg" alt="Instagram" width={24} height={24} />
          </a>
          <a
            href="https://www.linkedin.com/company/brandbitestudio/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex transition-opacity hover:opacity-70"
          >
            <Image src="/home/linkedin-dark.svg" alt="LinkedIn" width={24} height={24} />
          </a>
        </nav>
      </div>

      {/* Legal row — © notice + policy links */}
      <div className="flex w-full flex-row items-center justify-between gap-6 border-t border-[#D7D8DD] pt-[25px] text-xs leading-[19.5px] font-medium text-[#5E616E] max-[767px]:flex-col max-[767px]:gap-3 max-[767px]:text-center">
        <p className="whitespace-nowrap max-[767px]:whitespace-normal">{copyrightLine()}</p>
        <div className="flex flex-row items-center gap-6 max-[767px]:flex-wrap max-[767px]:justify-center max-[767px]:gap-x-4 max-[767px]:gap-y-1">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="whitespace-nowrap transition-colors hover:text-[#2B2D33]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
