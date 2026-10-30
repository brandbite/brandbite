// -----------------------------------------------------------------------------
// @file: components/marketing/home-footer.tsx
// @purpose: Marketing footer for the redesigned homepage + coming-soon page
//           (and every other Figma-redesigned marketing page). Top row:
//           logo, text links, socials. Bottom row: legal line — © notice,
//           registered address and contact email from lib/brand.ts.
// @version: v1.2.0
// @status: active
// @lastUpdate: 2026-10-30
// -----------------------------------------------------------------------------

import Image from "next/image";
import Link from "next/link";
import { COMPANY_ADDRESS, CONTACT_EMAIL, copyrightLine } from "@/lib/brand";

const FOOTER_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Contact", href: "/contact" },
];

export function HomeFooter({ variant = "home" }: { variant?: "home" | "coming-soon" }) {
  const isComingSoon = variant === "coming-soon";

  return (
    <footer className={`flex w-full flex-col ${isComingSoon ? "bg-white" : ""}`}>
      <div
        className={`flex w-full flex-row items-center justify-between max-[767px]:h-auto max-[767px]:flex-col max-[767px]:gap-5 max-[767px]:px-5 max-[767px]:pt-6 max-[767px]:pb-3 ${
          isComingSoon ? "px-[100px] py-5" : "h-[63px] px-[100px] pt-[27px]"
        }`}
      >
        <Link href="/" className="flex shrink-0" aria-label="Brandbite home">
          <Image
            src="/brandbite-logo.svg"
            alt="Brandbite"
            width={isComingSoon ? 118 : 145}
            height={isComingSoon ? 24 : 30}
          />
        </Link>
        <div className="flex shrink-0 flex-row items-center justify-center gap-[50px] max-[767px]:flex-wrap max-[767px]:justify-center max-[767px]:gap-6">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-base leading-none whitespace-nowrap text-[#1F2024] transition-colors hover:text-[#FF6426]"
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
            <Image src="/home/instagram.svg" alt="Instagram" width={24} height={24} />
          </a>
          <a
            href="https://www.linkedin.com/company/brandbitestudio/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex transition-opacity hover:opacity-70"
          >
            <Image src="/home/linkedin.svg" alt="LinkedIn" width={24} height={24} />
          </a>
        </div>
      </div>

      {/* Legal line — © notice + registered address + contact email */}
      <div
        className={`flex w-full flex-row items-center justify-between gap-6 px-[100px] text-xs leading-5 text-[#6B6E76] max-[767px]:flex-col max-[767px]:gap-1.5 max-[767px]:px-5 max-[767px]:text-center ${
          isComingSoon ? "pb-5" : "pt-4"
        }`}
      >
        <p className="shrink-0">{copyrightLine()}</p>
        <p className="flex flex-col items-end gap-0.5 text-right max-[767px]:items-center max-[767px]:text-center">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-[#1F2024] transition-colors hover:text-[#FF6426]"
          >
            {CONTACT_EMAIL}
          </a>
          <span>{COMPANY_ADDRESS}</span>
        </p>
      </div>
    </footer>
  );
}
