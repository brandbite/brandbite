// -----------------------------------------------------------------------------
// @file: components/marketing/ready-band.tsx
// @purpose: Purple "Ready to feed your brand better creative?" CTA band: BB on
//           a beanbag with a laptop, a paper plane and a "pause anytime" note.
//           Part of HomeFooter (footer v2 design), so it ends every marketing
//           page. On phones the plane and note are hidden and BB sits under
//           the copy, as in the mobile design.
// -----------------------------------------------------------------------------

import Image from "next/image";
import Link from "next/link";

export function ReadyBand() {
  return (
    <section
      aria-labelledby="ready-band-heading"
      className="relative h-[309px] w-full overflow-hidden bg-[#B696FF] max-[767px]:flex max-[767px]:h-auto max-[767px]:flex-col max-[767px]:gap-6 max-[767px]:px-5 max-[767px]:pt-10"
    >
      <div className="absolute top-[60px] left-[54px] z-10 flex w-[400px] flex-col items-start gap-6 max-[1023px]:left-8 max-[767px]:static max-[767px]:w-auto">
        <h2
          id="ready-band-heading"
          className="font-[family-name:var(--font-jakarta)] text-4xl leading-9 font-extrabold text-[#2B2D33]"
        >
          Ready to feed your brand better creative?
        </h2>
        <p className="text-sm leading-5 text-[#2B2D33]/80">
          Send your first request and let brandbite turn it into something worth shipping.
        </p>
        <Link
          href="/meet"
          className="flex flex-row items-center gap-[9px] transition-opacity hover:opacity-85"
        >
          <span className="text-base leading-6 font-bold whitespace-nowrap text-white">
            Get Started
          </span>
          <Image
            src="/home/arrow-orange.svg"
            alt=""
            width={22.4}
            height={17.58}
            className="mt-0.5"
          />
        </Link>
      </div>
      <Image
        src="/home/paper-plane.png"
        alt=""
        width={230}
        height={78}
        className="absolute top-[190px] left-[276px] w-[230px] max-[1023px]:hidden"
      />
      <div className="absolute top-0 left-[45%] h-[309px] w-[350px] bg-[url('/home/unicorn-wave.webp')] [background-size:119.857%_135.761%] [background-position:50%_18.552%] bg-no-repeat max-[1023px]:right-0 max-[1023px]:left-auto max-[767px]:static max-[767px]:h-[265px] max-[767px]:w-[300px] max-[767px]:self-end" />
      <Image
        src="/home/ready-note.png"
        alt="Note: pause or cancel anytime. Your work and assets stay yours."
        width={205}
        height={121}
        className="absolute top-[82px] right-[55px] w-[205px] max-[1023px]:hidden"
      />
    </section>
  );
}
