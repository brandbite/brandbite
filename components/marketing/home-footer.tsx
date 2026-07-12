// -----------------------------------------------------------------------------
// @file: components/marketing/home-footer.tsx
// @purpose: Marketing footer for the redesigned homepage + coming-soon page.
//           Text links point at /coming-soon until those pages are
//           redesigned; socials go to the real profiles.
// @version: v1.1.0
// @status: active
// @lastUpdate: 2026-07-12
// -----------------------------------------------------------------------------

import Image from "next/image";
import Link from "next/link";

const FOOTER_LINKS = [
  { label: "Terms", href: "/coming-soon" },
  { label: "Privacy", href: "/coming-soon" },
  { label: "Contact", href: "/coming-soon" },
];

export function HomeFooter({ variant = "home" }: { variant?: "home" | "coming-soon" }) {
  const isComingSoon = variant === "coming-soon";

  return (
    <footer
      className={`flex w-full flex-row items-center justify-between max-[767px]:h-auto max-[767px]:flex-col max-[767px]:gap-5 max-[767px]:px-5 max-[767px]:pt-6 max-[767px]:pb-3 ${
        isComingSoon ? "bg-white px-[100px] py-5" : "h-[63px] px-[100px] pt-[27px]"
      }`}
    >
      <Link href="/" className="flex shrink-0" aria-label="Brandbite home">
        <Image
          src="/home/logo.svg"
          alt="Brandbite"
          width={isComingSoon ? 118 : 145}
          height={isComingSoon ? 29 : 36}
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
    </footer>
  );
}
