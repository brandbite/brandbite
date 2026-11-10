-- FAQ answers that said things the product doesn't do yet. Each update only
-- applies while the answer is still the shipped text, so admin edits stay.

-- Wrong domain: brandbite.co -> brandbite.studio.
UPDATE "Faq"
SET "answer" = REPLACE("answer", 'hello@brandbite.co ', 'hello@brandbite.studio '),
    "updatedAt" = NOW()
WHERE "id" = 'faq_seed_age_03' AND "answer" LIKE '%hello@brandbite.co %';

-- "Unlimited requests for a flat monthly subscription" -> token plans.
UPDATE "Faq" SET
  "answer" = $$brandbite is a creative-as-a-service platform. Your plan gives you a monthly balance of tokens, and you spend them on any design or creative request. Every service shows its token cost up front, so you know what a request costs before you send it. Think of it as having an entire creative team on demand — without the overhead of hiring in-house or managing freelancers.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_seed_gen_01'
  AND "answer" = $$brandbite is a creative-as-a-service platform that gives you access to unlimited design and creative requests for a flat monthly subscription. Think of it as having an entire creative team on demand — without the overhead of hiring in-house or managing freelancers.$$;

UPDATE "Faq" SET
  "answer" = $$Traditional agencies charge per project with long timelines and unpredictable costs. Freelancers can be unreliable. brandbite gives you a monthly token plan with a clear token cost for every service, no contracts, and fast turnaround — so you get consistent quality and predictable spend without the hassle.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_seed_gen_03'
  AND "answer" = $$Traditional agencies charge per project with long timelines and unpredictable costs. Freelancers can be unreliable. brandbite offers a flat monthly rate, no contracts, unlimited requests, and fast turnaround — so you get consistent quality without the hassle.$$;

-- No Slack integration and no brand asset library exist.
UPDATE "Faq" SET
  "answer" = $$Not yet. Everything happens in your brandbite dashboard: you get in-app and email notifications as your requests move, and your team works together in one shared workspace. If there's a tool you'd like us to connect with, tell us at hello@brandbite.studio.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_seed_pla_03'
  AND "answer" = $$Yes! We offer Slack integration for real-time project updates and notifications. Our built-in brand asset library stores all your logos, fonts, and guidelines in one place for easy access.$$;

-- No SOC 2 audit is under way; describe what is actually in place.
UPDATE "Faq" SET
  "answer" = $$Yes. Everything you send and receive travels over an encrypted (HTTPS) connection, and your data and files are stored encrypted by our infrastructure providers, with files on Cloudflare's network. Only your team, the creative working on your request and the brandbite team can open your requests and files.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_seed_pla_04'
  AND "answer" = $$Security is a top priority. We use enterprise-grade encryption for all data in transit and at rest, and our files are stored on Cloudflare's global network. SOC 2 compliance is currently in progress.$$;
