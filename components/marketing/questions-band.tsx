// -----------------------------------------------------------------------------
// @file: components/marketing/questions-band.tsx
// @purpose: Purple "Still have questions?" CTA band (laptop BB + paper plane
//           + clarity note) from the Figma FAQ frame. Shared by /faq and
//           /terms, which use the identical band in the designs.
// -----------------------------------------------------------------------------

import Image from "next/image";

const displayFont = "font-[family-name:var(--font-inter)]";

export function QuestionsBand() {
  return (
    <section className="relative flex h-[309px] w-full flex-row items-center justify-between bg-[#B696FF] px-[70px] max-[1023px]:px-8 max-[767px]:h-auto max-[767px]:flex-col max-[767px]:items-center max-[767px]:gap-10 max-[767px]:px-5 max-[767px]:pt-10">
      <div className="flex w-[400px] flex-col items-start gap-6 max-[767px]:w-full max-[767px]:max-w-[400px]">
        <h2
          className={`flex w-full flex-col gap-[5px] ${displayFont} text-4xl leading-9 font-extrabold`}
        >
          <span className="text-[#2B2D33]">Still have</span>
          <span className="text-white">questions?</span>
        </h2>
        <p className="w-full text-sm leading-5 text-[#2B2D33]">
          We&rsquo;re here to help. If you need more clarity, our team is always just a message
          away.
        </p>
        <a
          href="mailto:hello@brandbite.studio"
          className="flex flex-row items-center gap-[9px] transition-opacity hover:opacity-85"
        >
          <span className="text-xl leading-8 font-bold whitespace-nowrap text-white">
            Chat with the team
          </span>
          <Image src="/home/arrow-chat.svg" alt="" width={24} height={24} />
        </a>
      </div>
      <Image
        src="/home/paper-plane.png"
        alt=""
        width={235}
        height={80}
        className="absolute top-[204px] left-[297px] h-20 w-[235px] object-cover max-[1023px]:hidden"
      />
      <div className="relative h-[309px] w-[350px] shrink-0 max-[767px]:order-3">
        <div className="h-full w-full bg-[url('/home/unicorn-wave.webp')] [background-size:119.857%_135.761%] [background-position:50%_18.552%] bg-no-repeat" />
      </div>
      <Image
        src="/home/faq-note.webp"
        alt="Sticky note: We like clarity. You'll like the experience."
        width={210}
        height={140}
        className="h-[140px] w-[210px] shrink-0 object-cover max-[1023px]:hidden max-[767px]:static max-[767px]:order-2 max-[767px]:block"
      />
    </section>
  );
}
