// -----------------------------------------------------------------------------
// @file: components/marketing/ready-band.tsx
// @purpose: Purple "Ready to feed your brand better creative?" CTA band from
//           the Figma Color Tools design — laptop BB + pause-note + plane.
//           Used on the /colors hub and every color tool page.
// -----------------------------------------------------------------------------

import Image from "next/image";
import Link from "next/link";

export function ReadyBand() {
  return (
    <section className="relative flex h-[309px] w-full flex-row items-center justify-center gap-10 bg-[#B696FF] max-[1023px]:gap-6 max-[767px]:h-auto max-[767px]:flex-col max-[767px]:items-center max-[767px]:gap-10 max-[767px]:pt-10">
      <div className="flex w-[400px] flex-col items-start gap-6 max-[767px]:w-full max-[767px]:max-w-[400px] max-[767px]:px-[30px] max-[767px]:pt-5">
        <h2 className="flex flex-col gap-[5px] font-[family-name:var(--font-inter)] text-4xl leading-9 font-extrabold">
          <span className="whitespace-nowrap text-[#2B2D33] max-[767px]:whitespace-normal">
            Ready to feed your brand
          </span>
          <span className="text-white">better creative?</span>
        </h2>
        <p className="w-full text-sm leading-5 text-[#2B2D33]">
          Send your first request and let Brandbite turn it into something worth shipping.
        </p>
        <Link
          href="/coming-soon"
          className="flex flex-row items-center gap-[9px] transition-opacity hover:opacity-85"
        >
          <span className="text-xl leading-8 font-bold whitespace-nowrap text-white">
            Get Started
          </span>
          <Image src="/home/arrow-chat.svg" alt="" width={24} height={24} />
        </Link>
      </div>
      <div className="relative h-[309px] w-[350px] shrink-0 max-[767px]:order-3">
        <div className="h-full w-full bg-[url('/home/unicorn-wave.webp')] [background-size:119.857%_135.761%] [background-position:50%_18.552%] bg-no-repeat" />
      </div>
      <Image
        src="/home/ready-note.png"
        alt="Sticky note: pause or cancel anytime — your work and assets stay yours."
        width={203}
        height={120}
        className="h-[120px] w-[203px] shrink-0 object-cover max-[1023px]:hidden max-[767px]:order-2 max-[767px]:block"
      />
      <Image
        src="/home/paper-plane.png"
        alt=""
        width={235}
        height={80}
        className="absolute top-[184px] left-[276px] h-20 w-[235px] object-cover max-[1023px]:hidden"
      />
    </section>
  );
}
