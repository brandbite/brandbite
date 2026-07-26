// -----------------------------------------------------------------------------
// @file: components/marketing/faq-accordion.tsx
// @purpose: Numbered single-open accordion for the public /faq page (2026
//           redesign). Content comes from the Faq table via the server page;
//           the portal FAQ surfaces keep using components/faq/faq-browser.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-07-13
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import { useState } from "react";

export type FaqAccordionItem = {
  id: string;
  question: string;
  answer: string;
};

export function FaqAccordion({ faqs }: { faqs: FaqAccordionItem[] }) {
  // First question starts open, matching the design; clicking an open row
  // closes it.
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  return (
    <div className="flex w-full flex-col items-center justify-center gap-2.5 px-[60px] max-[767px]:px-2.5">
      {faqs.map((faq, i) => {
        const open = faq.id === openId;
        return (
          <div
            key={faq.id}
            className="flex w-full flex-col items-center rounded-xl border-[0.5px] border-[#D7D8DD] bg-[#F7F4F1]"
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : faq.id)}
              className="flex w-full cursor-pointer flex-row items-center gap-2.5 border-none bg-transparent p-5 text-left"
            >
              <span className="flex size-[30px] shrink-0 flex-col items-center justify-center rounded-full bg-[#E0D2FF] text-center text-base leading-5 font-bold text-[#3600B2]">
                {i + 1}
              </span>
              <span className="text-base leading-5 font-bold text-[#2B2D33]">{faq.question}</span>
              <span className="flex min-w-px flex-1 items-end justify-end">
                <Image
                  src={open ? "/home/faq-minus.svg" : "/home/faq-plus.svg"}
                  alt=""
                  width={24}
                  height={24}
                  className="shrink-0"
                />
              </span>
            </button>
            {open && (
              <div className="flex w-full items-center justify-center rounded-b-xl bg-white px-[60px] py-5">
                <p className="min-w-px flex-1 text-base leading-6 whitespace-pre-line text-[#5E616E]">
                  {faq.answer}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
