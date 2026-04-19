// -----------------------------------------------------------------------------
// @file: lib/faq-data.ts
// @purpose: Shared FAQ content used by both the public /faq marketing page and
//           the logged-in /customer/faq & /creative/faq dashboard pages.
// -----------------------------------------------------------------------------

export type Faq = { q: string; a: string; category: string };

export const FAQ_CATEGORIES = [
  "All",
  "General",
  "Pricing & Billing",
  "Creative Process",
  "Platform & Tools",
  "Agencies & Teams",
] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export const FAQS: Faq[] = [
  // ── General ──────────────────────────────────────────────────────────────
  {
    category: "General",
    q: "What is Brandbite?",
    a: "Brandbite is a creative-as-a-service platform that gives you access to unlimited design and creative requests for a flat monthly subscription. Think of it as having an entire creative team on demand — without the overhead of hiring in-house or managing freelancers.",
  },
  {
    category: "General",
    q: "Who is Brandbite for?",
    a: "Brandbite is built for startups, marketing teams, agencies, e-commerce brands, and anyone who needs a steady stream of high-quality creative work. Whether you're a solo founder or a growing team, we scale with you.",
  },
  {
    category: "General",
    q: "How is Brandbite different from hiring a designer or agency?",
    a: "Traditional agencies charge per project with long timelines and unpredictable costs. Freelancers can be unreliable. Brandbite offers a flat monthly rate, no contracts, unlimited requests, and fast turnaround — so you get consistent quality without the hassle.",
  },
  {
    category: "General",
    q: "What types of creative work can I request?",
    a: "Almost anything visual! Brand identity, social media graphics, web design, packaging, pitch decks, presentations, email templates, motion graphics, illustrations, ad creatives, and more. If you can brief it, we can design it.",
  },
  {
    category: "General",
    q: "Do I own the work you create?",
    a: "Yes, 100%. Every deliverable we create is yours to keep and use however you like — even if you cancel your subscription. Full ownership, no strings attached.",
  },

  // ── Pricing & Billing ────────────────────────────────────────────────────
  {
    category: "Pricing & Billing",
    q: "How much does Brandbite cost?",
    a: "Plans start at $495/month with our Starter tier. We also offer Brand ($995/mo) and Scale ($1,995/mo) plans for teams that need more capacity and faster turnaround. Annual billing saves you 20%.",
  },
  {
    category: "Pricing & Billing",
    q: "Can I cancel anytime?",
    a: "Yes. You can pause or cancel your subscription at any time — no long-term contracts, no cancellation fees. Your work and assets remain yours even after cancellation.",
  },
  {
    category: "Pricing & Billing",
    q: "Is there a free trial?",
    a: "We don't offer a traditional free trial, but you can start with any plan knowing you can pause or cancel anytime. There's zero risk — if you're not happy within the first week, we'll refund your subscription.",
  },
  {
    category: "Pricing & Billing",
    q: "What payment methods do you accept?",
    a: "We accept all major credit and debit cards (Visa, Mastercard, American Express) processed securely through Stripe. Invoicing is available for annual enterprise plans.",
  },
  {
    category: "Pricing & Billing",
    q: "What happens when I pause my subscription?",
    a: "When you pause, billing stops immediately. Any work in progress is saved and waiting for you when you come back. You can resume anytime and pick up right where you left off.",
  },

  // ── Creative Process ─────────────────────────────────────────────────────
  {
    category: "Creative Process",
    q: "How fast will I get my creatives?",
    a: "Most requests are completed within 24–48 hours. Larger projects like brand identity guides or motion videos may take 3–5 business days depending on complexity. Priority plans get even faster turnaround.",
  },
  {
    category: "Creative Process",
    q: "What if I don't like the creative?",
    a: "No worries! Every plan includes unlimited revisions. We'll keep iterating until you're 100% happy with the result. Your satisfaction is our top priority.",
  },
  {
    category: "Creative Process",
    q: "How do I submit a creative request?",
    a: "Through the Brandbite platform — just create a ticket with your brief, upload any references or brand assets, and we'll get started. It's as simple as filling out a short form.",
  },
  {
    category: "Creative Process",
    q: "Can I have multiple requests at once?",
    a: "It depends on your plan. Starter allows 1 active request at a time, Brand allows 2 simultaneously, and Scale gives you unlimited active requests. All plans include an unlimited request queue.",
  },
  {
    category: "Creative Process",
    q: "What file formats do you deliver?",
    a: "We deliver in whatever format you need — PNG, JPG, SVG, PDF, Figma files, After Effects projects, and more. Just let us know your preferred format when submitting your request.",
  },

  // ── Platform & Tools ─────────────────────────────────────────────────────
  {
    category: "Platform & Tools",
    q: "How does the Brandbite platform work?",
    a: "It's simple: submit a request through your dashboard, track its progress in real time, review the deliverables, provide feedback, and download your final files. Everything happens in one place.",
  },
  {
    category: "Platform & Tools",
    q: "Can I collaborate with my team?",
    a: "Absolutely. Multi-seat plans let your team share projects, brand assets, and feedback in one workspace. Everyone stays aligned without endless email threads.",
  },
  {
    category: "Platform & Tools",
    q: "Do you integrate with other tools?",
    a: "Yes! We offer Slack integration for real-time project updates and notifications. Our built-in brand asset library stores all your logos, fonts, and guidelines in one place for easy access.",
  },
  {
    category: "Platform & Tools",
    q: "Is my data secure?",
    a: "Security is a top priority. We use enterprise-grade encryption for all data in transit and at rest, and our files are stored on Cloudflare's global network. SOC 2 compliance is currently in progress.",
  },

  // ── Agencies & Teams ─────────────────────────────────────────────────────
  {
    category: "Agencies & Teams",
    q: "Do you work with agencies?",
    a: "Absolutely. Many agencies use Brandbite as their white-label creative arm. We offer agency-friendly plans with multi-seat access and dedicated account managers so you can scale client work effortlessly.",
  },
  {
    category: "Agencies & Teams",
    q: "Can I add team members?",
    a: "Yes. The Brand plan includes up to 5 seats, and the Scale plan offers unlimited seats. Additional seats can be added to any plan — just reach out to our team.",
  },
  {
    category: "Agencies & Teams",
    q: "Do you offer custom enterprise plans?",
    a: "Yes. For larger organisations with specific needs, we offer tailored enterprise plans with custom SLAs, dedicated designers, and priority support. Contact us at hello@brandbite.co to discuss.",
  },
];
