// -----------------------------------------------------------------------------
// @file: app/newsletter-builder/page.tsx
// @purpose: Newsletter builder: the page people and search engines land on.
//           It shows the template gallery (and a customer's kept newsletters)
//           and leads into the editor at /newsletter-builder/editor. The
//           guide below is in the first HTML.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { NewsletterCollage, NewsletterHome } from "@/components/newsletter/newsletter-home";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Newsletter Builder",
  path: "/newsletter-builder",
  description:
    "Build an email newsletter by dragging blocks into place, in your brand colors, and get clean HTML to paste into Mailchimp, Klaviyo, Brevo or any email service. Free to start, no sign-up.",
};

export const metadata: Metadata = pageMetadata({
  title: "Free Drag and Drop Email Newsletter Builder",
  description: TOOL.description,
  path: TOOL.path,
});

const STEPS = [
  {
    title: "Choose a start",
    text: "Pick a template or start from scratch.",
    tone: "bg-[#FFE9DF] text-[#C2410C]",
    // A pointer.
    icon: "M5 3l14 8-6 2-2 6z",
  },
  {
    title: "Build your email",
    text: "Add your words and images. Match your brand.",
    tone: "bg-[#ECE4FF] text-[#4C1D95]",
    // Stacked layers.
    icon: "M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
  },
  {
    title: "Check & export",
    text: "Preview it, fix what the editor flags, then copy the HTML.",
    tone: "bg-[#FFE9DF] text-[#C2410C]",
    // Code brackets.
    icon: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  },
];

const TIPS = [
  "Give each issue one job. If readers should do one thing, use one button and put it where they see it without scrolling far.",
  "Write the subject line last, and keep it close to 60 characters. Use the preview text to add to it, not to repeat it.",
  "Keep images light and describe each one. Many inboxes hide pictures until the reader allows them, so the email has to make sense without them.",
  "Say why people are getting the email and make leaving easy. An unsubscribe link and your postal address are required for marketing email in most countries.",
  "Send yourself a test and read it on a phone first. Most newsletters are opened there.",
];

const FAQ = [
  {
    question: "Does brandbite send emails?",
    answer:
      "No. This tool builds the email; you send it with the email service that holds your list, such as Mailchimp, Klaviyo or Brevo. Copy the HTML and paste it into a new campaign there.",
  },
  {
    question: "What is free?",
    answer:
      "The editor, the basic blocks (heading, text, image, button, line, space), six templates and the HTML export are free. Columns, the ready-made blocks, the other templates, AI writing, image upload, newsletters kept in your account and test emails come with a brandbite plan.",
  },
  {
    question: "Why do images need a URL?",
    answer:
      "An email doesn't carry its pictures; it points to them. Each image has to sit on the web at an https address that keeps working, for example on your own website or in your email service's file library.",
  },
  {
    question: "Where are drafts saved?",
    answer:
      "Without a plan, your draft is kept in your own browser, so it is there when you return on the same device, and it isn't sent to brandbite. On a plan, your newsletters are kept in your account for everyone in your company.",
  },
];

export default function NewsletterBuilderPage() {
  return (
    <StudioShell
      label="NEWSLETTER BUILDER"
      nav={null}
      title="Emails that look like"
      accent="your brand."
      blurb="Design with blocks. Export HTML. Send with your email service."
      aside={<NewsletterCollage />}
      ctaHeading="A newsletter that looks the part."
      ctaHeadingAccent="A brand that lasts."
      ctaBlurb="Need banners, illustrations or a full email design? Send a request to brandbite and get them on one subscription."
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "BusinessApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <NewsletterHome />

      <section aria-labelledby="newsletter-how-heading">
        <h2 id="newsletter-how-heading" className="sr-only">
          How it works
        </h2>
        <ol className="grid grid-cols-3 max-[1023px]:grid-cols-1 max-[1023px]:gap-5">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className={`flex items-start gap-4 ${
                index > 0
                  ? "min-[1024px]:border-l min-[1024px]:border-[var(--cs-border)] min-[1024px]:pl-8"
                  : ""
              }`}
            >
              <span
                aria-hidden
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${step.tone}`}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={step.icon} />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-base leading-6 font-semibold">{step.title}</span>
                <span className="block text-sm leading-5 text-[var(--cs-muted)]">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 flex items-center justify-center gap-3 rounded-xl bg-[#E3F1E4] px-5 py-3 text-center text-sm leading-5 font-medium text-[#14532D]">
          <svg
            aria-hidden
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="shrink-0"
          >
            <path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5M12 8h.01" />
          </svg>
          brandbite builds your email. Send it through Mailchimp, Klaviyo, Brevo or your own
          service.
        </p>
      </section>

      <section aria-labelledby="newsletter-faq-heading">
        <h2 id="newsletter-faq-heading" className="text-[28px] leading-9 font-bold">
          FAQs
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          {FAQ.map((item) => (
            <details
              key={item.question}
              className="group rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)]"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-base leading-6 font-semibold [&::-webkit-details-marker]:hidden">
                {item.question}
                <svg
                  aria-hidden
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 transition-transform group-open:rotate-180"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <p className="max-w-[820px] px-5 pb-4 text-base leading-6 text-[var(--cs-muted)]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="newsletter-tips-heading"
        className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="newsletter-tips-heading" className="text-2xl leading-8 font-semibold">
          Tips for a newsletter people read
        </h2>
        <ul className="mt-4 flex max-w-[760px] list-disc flex-col gap-2 pl-5 text-base leading-7">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </StudioShell>
  );
}
