// -----------------------------------------------------------------------------
// @file: components/marketing/subscribe-band.tsx
// @purpose: Purple "Get fresh ideas in your inbox." newsletter band from the
//           Figma blog frames. There is no dedicated newsletter backend yet,
//           so submissions are stored via /api/contact (topic "Newsletter
//           signup") — they land in the /admin/contact inbox and email the
//           site owners, so no signup is lost.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-07-26
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SubscribeBand() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a correct email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Newsletter signup",
          email: email.trim(),
          topic: "Newsletter signup",
          message: `Please add ${email.trim()} to the blog newsletter list.`,
        }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="relative flex h-[309px] w-full flex-row items-center justify-between bg-[#B696FF] px-[70px] max-[1023px]:px-8 max-[767px]:h-auto max-[767px]:flex-col max-[767px]:items-center max-[767px]:gap-10 max-[767px]:px-5 max-[767px]:pt-10">
      <div className="flex w-[500px] flex-col items-start gap-6 max-[1023px]:w-[420px] max-[767px]:w-full max-[767px]:max-w-[500px]">
        <h2 className="flex w-full flex-col gap-[5px] font-[family-name:var(--font-inter)] text-4xl leading-9 font-extrabold">
          <span className="text-white">Get fresh ideas</span>
          <span className="text-[#2B2D33]">in your inbox.</span>
        </h2>
        <p className="w-full text-sm leading-5 text-[#2B2D33]">
          No spam. Just the good stuff. Once a week.
        </p>
        {done ? (
          <p className="text-base leading-6 font-bold text-white">
            You&rsquo;re in! Fresh ideas are on their way. 🎉
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-2">
            <div className="flex w-full flex-row items-center gap-6 max-[767px]:flex-col max-[767px]:items-stretch max-[767px]:gap-3">
              <input
                type="email"
                aria-label="Email address"
                placeholder="jane@yourbrand.com"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-px flex-1 rounded-xl border-[0.5px] border-[#D7D8DD] bg-[#F7F4F1] p-5 text-base leading-5 text-[#2B2D33] placeholder:text-[#B8BAC2] focus:outline-2 focus:outline-[#FF6426]"
              />
              <button
                type="submit"
                disabled={submitting}
                className="font-brand flex shrink-0 cursor-pointer flex-row items-center justify-center gap-2.5 rounded-[10px] border-none bg-[#2B2D33] p-5 text-xl leading-none font-bold text-white transition-colors hover:bg-[#FF6426] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Subscribe"}
                <Image src="/home/ico-send.svg" alt="" width={24} height={24} />
              </button>
            </div>
            {error && (
              <p role="alert" className="text-sm leading-5 font-bold text-[#DD0000]">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
      <Image
        src="/home/paper-plane.png"
        alt=""
        width={235}
        height={80}
        className="absolute top-[84px] left-[600px] h-20 w-[235px] object-cover max-[1179px]:hidden"
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
