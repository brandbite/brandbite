// -----------------------------------------------------------------------------
// @file: app/meetings/[token]/page.tsx
// @purpose: A visitor's private link to reschedule or cancel their meeting. The URL
//           is a credential: not indexed, not sent to analytics, and it sends no
//           referrer.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";
import { MeetingManage } from "@/components/marketing/meeting-booking";

export const metadata: Metadata = {
  title: "Your meeting",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ManageMeetingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main id="main-content" className="mx-auto w-full max-w-[1140px] overflow-hidden">
        <HomeHeader />
        <section className="px-14 py-12 max-[1179px]:px-8 max-[767px]:px-5 max-[767px]:py-8">
          <div className="rounded-2xl border border-[#E3E0DC] bg-white p-8 max-[767px]:p-5">
            <MeetingManage token={token} />
          </div>
        </section>
        <HomeFooter />
        <div className="h-5" />
      </main>
    </div>
  );
}
