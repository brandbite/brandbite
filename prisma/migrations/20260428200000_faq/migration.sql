-- CreateTable: central FAQ store, shared across /faq, /customer/faq,
-- /creative/faq, and the landing-page FAQ block.
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Faq_category_position_idx" ON "Faq"("category", "position");
CREATE INDEX "Faq_isActive_idx" ON "Faq"("isActive");

-- Seed: lift the previously-hardcoded FAQs from lib/faq-data.ts into the
-- table. Position runs from 0 within each category in the same order the
-- old constant declared them, so the public /faq page renders identically
-- after this migration runs.
--
-- Idempotent guard: only insert when the table is empty so re-running the
-- migration on a populated DB doesn't duplicate seeds.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Faq" LIMIT 1) THEN
    INSERT INTO "Faq" ("id", "question", "answer", "category", "position", "isActive", "createdAt", "updatedAt") VALUES
    -- General
    ('faq_seed_gen_01', 'What is Brandbite?', 'Brandbite is a creative-as-a-service platform that gives you access to unlimited design and creative requests for a flat monthly subscription. Think of it as having an entire creative team on demand — without the overhead of hiring in-house or managing freelancers.', 'General', 0, true, NOW(), NOW()),
    ('faq_seed_gen_02', 'Who is Brandbite for?', 'Brandbite is built for startups, marketing teams, agencies, e-commerce brands, and anyone who needs a steady stream of high-quality creative work. Whether you''re a solo founder or a growing team, we scale with you.', 'General', 1, true, NOW(), NOW()),
    ('faq_seed_gen_03', 'How is Brandbite different from hiring a designer or agency?', 'Traditional agencies charge per project with long timelines and unpredictable costs. Freelancers can be unreliable. Brandbite offers a flat monthly rate, no contracts, unlimited requests, and fast turnaround — so you get consistent quality without the hassle.', 'General', 2, true, NOW(), NOW()),
    ('faq_seed_gen_04', 'What types of creative work can I request?', 'Almost anything visual! Brand identity, social media graphics, web design, packaging, pitch decks, presentations, email templates, motion graphics, illustrations, ad creatives, and more. If you can brief it, we can design it.', 'General', 3, true, NOW(), NOW()),
    ('faq_seed_gen_05', 'Do I own the work you create?', 'Yes, 100%. Every deliverable we create is yours to keep and use however you like — even if you cancel your subscription. Full ownership, no strings attached.', 'General', 4, true, NOW(), NOW()),

    -- Pricing & Billing
    ('faq_seed_pri_01', 'How much does Brandbite cost?', 'Plans start at $495/month with our Starter tier. We also offer Brand ($995/mo) and Scale ($1,995/mo) plans for teams that need more capacity and faster turnaround. Annual billing saves you 20%.', 'Pricing & Billing', 0, true, NOW(), NOW()),
    ('faq_seed_pri_02', 'Can I cancel anytime?', 'Yes. You can pause or cancel your subscription at any time — no long-term contracts, no cancellation fees. Your work and assets remain yours even after cancellation.', 'Pricing & Billing', 1, true, NOW(), NOW()),
    ('faq_seed_pri_03', 'Is there a free trial?', 'We don''t offer a traditional free trial, but you can start with any plan knowing you can pause or cancel anytime. There''s zero risk — if you''re not happy within the first week, we''ll refund your subscription.', 'Pricing & Billing', 2, true, NOW(), NOW()),
    ('faq_seed_pri_04', 'What payment methods do you accept?', 'We accept all major credit and debit cards (Visa, Mastercard, American Express) processed securely through Stripe. Invoicing is available for annual enterprise plans.', 'Pricing & Billing', 3, true, NOW(), NOW()),
    ('faq_seed_pri_05', 'What happens when I pause my subscription?', 'When you pause, billing stops immediately. Any work in progress is saved and waiting for you when you come back. You can resume anytime and pick up right where you left off.', 'Pricing & Billing', 4, true, NOW(), NOW()),

    -- Creative Process
    ('faq_seed_pro_01', 'How fast will I get my creatives?', 'Most requests are completed within 24–48 hours. Larger projects like brand identity guides or motion videos may take 3–5 business days depending on complexity. Priority plans get even faster turnaround.', 'Creative Process', 0, true, NOW(), NOW()),
    ('faq_seed_pro_02', 'What if I don''t like the creative?', 'No worries! Every plan includes unlimited revisions. We''ll keep iterating until you''re 100% happy with the result. Your satisfaction is our top priority.', 'Creative Process', 1, true, NOW(), NOW()),
    ('faq_seed_pro_03', 'How do I submit a creative request?', 'Through the Brandbite platform — just create a ticket with your brief, upload any references or brand assets, and we''ll get started. It''s as simple as filling out a short form.', 'Creative Process', 2, true, NOW(), NOW()),
    ('faq_seed_pro_04', 'Can I have multiple requests at once?', 'It depends on your plan. Starter allows 1 active request at a time, Brand allows 2 simultaneously, and Scale gives you unlimited active requests. All plans include an unlimited request queue.', 'Creative Process', 3, true, NOW(), NOW()),
    ('faq_seed_pro_05', 'What file formats do you deliver?', 'We deliver in whatever format you need — PNG, JPG, SVG, PDF, Figma files, After Effects projects, and more. Just let us know your preferred format when submitting your request.', 'Creative Process', 4, true, NOW(), NOW()),

    -- Platform & Tools
    ('faq_seed_pla_01', 'How does the Brandbite platform work?', 'It''s simple: submit a request through your dashboard, track its progress in real time, review the deliverables, provide feedback, and download your final files. Everything happens in one place.', 'Platform & Tools', 0, true, NOW(), NOW()),
    ('faq_seed_pla_02', 'Can I collaborate with my team?', 'Absolutely. Multi-seat plans let your team share projects, brand assets, and feedback in one workspace. Everyone stays aligned without endless email threads.', 'Platform & Tools', 1, true, NOW(), NOW()),
    ('faq_seed_pla_03', 'Do you integrate with other tools?', 'Yes! We offer Slack integration for real-time project updates and notifications. Our built-in brand asset library stores all your logos, fonts, and guidelines in one place for easy access.', 'Platform & Tools', 2, true, NOW(), NOW()),
    ('faq_seed_pla_04', 'Is my data secure?', 'Security is a top priority. We use enterprise-grade encryption for all data in transit and at rest, and our files are stored on Cloudflare''s global network. SOC 2 compliance is currently in progress.', 'Platform & Tools', 3, true, NOW(), NOW()),

    -- Agencies & Teams
    ('faq_seed_age_01', 'Do you work with agencies?', 'Absolutely. Many agencies use Brandbite as their white-label creative arm. We offer agency-friendly plans with multi-seat access and dedicated account managers so you can scale client work effortlessly.', 'Agencies & Teams', 0, true, NOW(), NOW()),
    ('faq_seed_age_02', 'Can I add team members?', 'Yes. The Brand plan includes up to 5 seats, and the Scale plan offers unlimited seats. Additional seats can be added to any plan — just reach out to our team.', 'Agencies & Teams', 1, true, NOW(), NOW()),
    ('faq_seed_age_03', 'Do you offer custom enterprise plans?', 'Yes. For larger organisations with specific needs, we offer tailored enterprise plans with custom SLAs, dedicated designers, and priority support. Contact us at hello@brandbite.co to discuss.', 'Agencies & Teams', 2, true, NOW(), NOW());
  END IF;
END
$$;
