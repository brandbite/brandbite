// -----------------------------------------------------------------------------
// @file: app/meet/page.tsx
// @purpose: Public page for booking a 30-minute call with Brandbite.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";
import { MeetingBooking } from "@/components/marketing/meeting-booking";

export const metadata: Metadata = {
  title: "Meet Brandbite",
  description:
    "Book a free 30-minute video call to talk through your brand and see how Brandbite works.",
};

export default function MeetPage() {
  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main id="main-content" className="mx-auto w-full max-w-[1140px] overflow-hidden">
        <HomeHeader />
        <section className="px-14 pt-12 pb-8 max-[1179px]:px-8 max-[767px]:px-5 max-[767px]:pt-8">
          <h1 className="text-5xl leading-[56px] font-bold text-[#2B2D33] max-[767px]:text-[32px] max-[767px]:leading-10">
            Meet <span className="text-[#FF6426]">Brandbite.</span>
          </h1>
          <p className="mt-3 max-w-[640px] text-base leading-6 text-[#5E616E]">
            A free 30-minute video call with Olca to talk through your brand and how Brandbite can
            help. Pick a time that suits you.
          </p>
        </section>
        <section className="px-14 pb-12 max-[1179px]:px-8 max-[767px]:px-5">
          <div className="rounded-2xl border border-[#E3E0DC] bg-white p-8 max-[767px]:p-5">
            <MeetingBooking />
          </div>
        </section>
        <HomeFooter />
        <div className="h-5" />
      </main>
    </div>
  );
}
