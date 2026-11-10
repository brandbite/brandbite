-- FAQ: no prices in public answers; pricing questions go to the 30-minute
-- call at /meet (the FAQ turns "brandbite.studio/meet" into a link).
-- Wording: every role now says "request" (not ticket/job) and "service"
-- (not job type). Rows an admin has since edited are left alone: each
-- wording update only applies while the answer is still the shipped text.

UPDATE "Faq"
SET "answer" = $$Every team needs a different amount of creative work, so we shape the plan around yours. Book a free 30-minute call at brandbite.studio/meet and we'll walk you through the options and what they cost.$$,
    "updatedAt" = NOW()
WHERE "id" = 'faq_seed_pri_01';

UPDATE "Faq"
SET "answer" = REPLACE("answer", 'just create a ticket with your brief', 'just create a request with your brief'),
    "updatedAt" = NOW()
WHERE "id" = 'faq_seed_pro_03' AND "answer" LIKE '%just create a ticket with your brief%';

UPDATE "Faq" SET
  "question" = $$How do I get requests?$$,
  "answer" = $$Requests are assigned to you and appear on your Board in Backlog. There's no accept or decline step. Auto-assign considers creatives who have the request's service ticked in Settings → Skills & expertise, aren't paused and are under their task cap. The lightest current workload wins, then better customer ratings. If nobody qualifies, our team assigns the request.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_creative_01'
  AND "answer" = $$Jobs are assigned to you and appear on your Board in Backlog. There's no accept or decline step. Auto-assign considers creatives who have the job type ticked in Settings → Skills & expertise, aren't paused and are under their task cap. The lightest current workload wins, then better customer ratings. If nobody qualifies, our team assigns the job.$$;

UPDATE "Faq" SET
  "question" = $$Why am I not getting any requests?$$,
  "answer" = $$Check that you've ticked your services under Skills & expertise, because with none ticked you won't be matched. Also check that you aren't paused and haven't reached your Concurrent task cap.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_creative_02'
  AND "answer" = $$Check that you've ticked your job types under Skills & expertise, because with none ticked you won't be matched. Also check that you aren't paused and haven't reached your Concurrent task cap.$$;

UPDATE "Faq" SET
  "answer" = $$Yes. In Settings → Availability, pause for 1 hour, 7 days or until you resume. You won't get new requests while paused, and the requests you already have stay with you.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_creative_03'
  AND "answer" = $$Yes. In Settings → Availability, pause for 1 hour, 7 days or until you resume. You won't get new jobs while paused, and the jobs you already have stay with you.$$;

UPDATE "Faq" SET
  "question" = $$How does a request move from start to finish?$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_creative_04' AND "question" = $$How does a job move from start to finish?$$;

UPDATE "Faq" SET
  "answer" = $$The request returns to In progress with their feedback, and any pin notes show on your images. Mark each pin as resolved once you've handled it, then send a new version. You don't have to resolve every pin first.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_creative_06'
  AND "answer" = $$The job returns to In progress with their feedback, and any pin notes show on your images. Mark each pin as resolved once you've handled it, then send a new version. You don't have to resolve every pin first.$$;

UPDATE "Faq" SET
  "answer" = $$Yes. While the request is In review, click Pull back to In progress, then send a new version.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_creative_07'
  AND "answer" = $$Yes. While the job is In review, click Pull back to In progress, then send a new version.$$;

UPDATE "Faq" SET
  "answer" = $$Your payout is added to your balance as soon as the customer approves the request and it moves to Done. You're paid once per request.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_creative_08'
  AND "answer" = $$Your payout is added to your balance as soon as the customer approves the job and it moves to Done. You're paid once per job.$$;

UPDATE "Faq" SET
  "question" = $$How much do I earn on a request?$$,
  "answer" = $$A percentage of what the customer paid: the request's token cost, times its quantity, times your payout rate. Everyone starts at the 60% Base rate. Sometimes our team sets a fixed payout for a request instead.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_creative_09'
  AND "answer" = $$A percentage of what the customer paid: the job's token cost, times its quantity, times your payout rate. Everyone starts at the 60% Base rate. Sometimes our team sets a fixed payout for a job instead.$$;

UPDATE "Faq" SET
  "answer" = $$Complete more requests. Each payout tier needs a number of completed requests within a time window, and the highest tier you qualify for applies. See your progress in Settings → Payout tiers.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_creative_10'
  AND "answer" = $$Complete more jobs. Each payout tier needs a number of completed jobs within a time window, and the highest tier you qualify for applies. See your progress in Settings → Payout tiers.$$;

UPDATE "Faq" SET
  "answer" = $$Only you and the brandbite team, until you share one with the customer on a linked request. The customer can look through a shared board but can't change it, and you can stop sharing at any time.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_creative_12'
  AND "answer" = $$Only you and the brandbite team, until you share one with the customer on a linked job. The customer can look through a shared board but can't change it, and you can stop sharing at any time.$$;

-- Payout tier descriptions ("Complete 50 tickets in 90 days…").
UPDATE "PayoutRule"
SET "description" = REGEXP_REPLACE("description", '\m(\d+) tickets in\M', '\1 requests in', 'g'),
    "updatedAt" = NOW()
WHERE "description" ~ '\m\d+ tickets in\M';
