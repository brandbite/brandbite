// -----------------------------------------------------------------------------
// @file: components/marketing/contact-form.tsx
// @purpose: Contact form for the public /contact page (2026 redesign).
//           Posts to /api/contact; Turnstile-gated when the site key is
//           configured (same pattern as the /talent form). Invalid-state
//           styling follows the Figma "input active - invalid states" frame:
//           red bold message beside the label + red input text.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-07-26
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  "w-full rounded-xl border-[0.5px] border-[#D7D8DD] bg-[#F7F4F1] p-5 text-base leading-5 text-[#2B2D33] placeholder:text-[#B8BAC2] focus:outline-2 focus:outline-[#FF6426]";
const labelClass = "py-2.5 text-base leading-5 font-bold text-[#2B2D33]";
const errorClass = "py-2.5 text-base leading-5 font-bold text-[#DD0000]";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");

  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  function validate(): boolean {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Please enter your name.";
    if (!EMAIL_RE.test(email.trim())) next.email = "Please enter a correct email address.";
    if (!message.trim()) next.message = "Please tell us a bit more.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || null,
          topic: topic.trim() || null,
          message: message.trim(),
          turnstileToken: turnstileToken ?? "",
        }),
      });
      if (res.ok) {
        setSent(true);
        return;
      }
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      setSubmitError(payload?.error ?? "Sending failed. Please try again in a moment.");
    } catch {
      setSubmitError("Sending failed. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
      // Single-use Turnstile token — refresh after every submit attempt.
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  }

  if (sent) {
    return (
      <div className="flex w-full flex-col items-center gap-5 py-10 text-center">
        <p className="font-[family-name:var(--font-inter)] text-4xl leading-9 font-extrabold text-[#2B2D33]">
          Message sent. <span className="text-[#FF6426]">Nice one!</span>
        </p>
        <p className="text-base leading-6 text-[#5E616E]">
          Thanks for reaching out — we&rsquo;ll get back to you ASAP.
        </p>
        <Image
          src="/home/contact-reply-doodle.png"
          alt="We usually reply within 1 business day."
          width={260}
          height={105}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col items-center gap-5">
      <div className="flex w-full flex-row items-start gap-5 max-[767px]:flex-col">
        <div className="flex min-w-px flex-1 flex-col items-start max-[767px]:w-full">
          <div className="flex items-center gap-2.5">
            <label htmlFor="contact-name" className={labelClass}>
              Your name
            </label>
            {errors.name && <span className={errorClass}>{errors.name}</span>}
          </div>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Jane Doe"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
            className={`${inputClass} ${errors.name ? "text-[#DD0000]" : ""}`}
          />
        </div>
        <div className="flex min-w-px flex-1 flex-col items-start max-[767px]:w-full">
          <div className="flex items-center gap-2.5">
            <label htmlFor="contact-email" className={labelClass}>
              Your email
            </label>
            {errors.email && <span className={errorClass}>{errors.email}</span>}
          </div>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="jane@yourbrand.com"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            className={`${inputClass} ${errors.email ? "text-[#DD0000]" : ""}`}
          />
        </div>
      </div>

      <div className="flex w-full flex-row items-start gap-5 max-[767px]:flex-col">
        <div className="flex min-w-px flex-1 flex-col items-start max-[767px]:w-full">
          <label htmlFor="contact-company" className={labelClass}>
            Your company (Optional)
          </label>
          <input
            id="contact-company"
            name="organization"
            type="text"
            autoComplete="organization"
            placeholder="Your Brand Inc."
            maxLength={120}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex min-w-px flex-1 flex-col items-start max-[767px]:w-full">
          <label htmlFor="contact-topic" className={labelClass}>
            What can we help you with?
          </label>
          <input
            id="contact-topic"
            name="topic"
            type="text"
            placeholder="Logo, social media, web design..."
            maxLength={200}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex w-full flex-col items-start">
        <div className="flex items-center gap-2.5">
          <label htmlFor="contact-message" className={labelClass}>
            Tell us more
          </label>
          {errors.message && <span className={errorClass}>{errors.message}</span>}
        </div>
        <textarea
          id="contact-message"
          name="message"
          placeholder="What's the project, question, or idea?"
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={!!errors.message}
          className={`${inputClass} h-[120px] resize-none max-[767px]:h-[180px] ${errors.message ? "text-[#DD0000]" : ""}`}
        />
      </div>

      {turnstileSiteKey && (
        <Turnstile
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          onSuccess={(token) => setTurnstileToken(token)}
          onError={() => setTurnstileToken(null)}
          onExpire={() => setTurnstileToken(null)}
        />
      )}

      {submitError && (
        <p role="alert" className="w-full text-center text-base leading-5 font-bold text-[#DD0000]">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || (!!turnstileSiteKey && !turnstileToken)}
        className="font-brand flex w-full cursor-pointer flex-row items-center justify-center gap-2.5 rounded-[10px] border-none bg-[#2B2D33] py-5 text-xl leading-none font-bold text-white transition-colors hover:bg-[#FF6426] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Send Message"}
        <Image src="/home/ico-send.svg" alt="" width={24} height={24} />
      </button>

      <Image
        src="/home/contact-reply-doodle.png"
        alt="We usually reply within 1 business day."
        width={260}
        height={105}
      />
    </form>
  );
}
