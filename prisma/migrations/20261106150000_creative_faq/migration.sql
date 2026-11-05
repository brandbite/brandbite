-- Questions for creatives. The app shows this category on /creative/faq only,
-- see lib/faq/audience.ts.
INSERT INTO "Faq" ("id", "question", "answer", "category", "position", "isActive", "createdAt", "updatedAt") VALUES
  ('faq_creative_01', 'How do I get jobs?', 'Jobs are assigned to you and appear on your Board in Backlog. There''s no accept or decline step. Auto-assign considers creatives who have the job type ticked in Settings → Skills & expertise, aren''t paused and are under their task cap. The lightest current workload wins, then better customer ratings. If nobody qualifies, our team assigns the job.', 'For creatives', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('faq_creative_02', 'Why am I not getting any jobs?', 'Check that you''ve ticked your job types under Skills & expertise, because with none ticked you won''t be matched. Also check that you aren''t paused and haven''t reached your Concurrent task cap.', 'For creatives', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('faq_creative_03', 'Can I take a break?', 'Yes. In Settings → Availability, pause for 1 hour, 7 days or until you resume. You won''t get new jobs while paused, and the jobs you already have stay with you.', 'For creatives', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('faq_creative_04', 'How does a job move from start to finish?', 'It starts in Backlog. You move it to In progress when you start, and it goes to In review when you send a version. The customer then asks for changes, which sends it back to In progress, or approves it, which moves it to Done.', 'For creatives', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('faq_creative_05', 'What files can I deliver?', 'Images and PDFs, up to 10 files per version and 4 MB each.', 'For creatives', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('faq_creative_06', 'What happens when a customer asks for changes?', 'The job returns to In progress with their feedback, and any pin notes show on your images. Mark each pin as resolved once you''ve handled it, then send a new version. You don''t have to resolve every pin first.', 'For creatives', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('faq_creative_07', 'I sent the wrong version. Can I take it back?', 'Yes. While the job is In review, click Pull back to In progress, then send a new version.', 'For creatives', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('faq_creative_08', 'When do I get paid?', 'Your payout is added to your balance as soon as the customer approves the job and it moves to Done. You''re paid once per job.', 'For creatives', 7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('faq_creative_09', 'How much do I earn on a job?', 'A percentage of what the customer paid: the job''s token cost, times its quantity, times your payout rate. Everyone starts at the 60% Base rate. Sometimes our team sets a fixed payout for a job instead.', 'For creatives', 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('faq_creative_10', 'How can I raise my payout rate?', 'Complete more jobs. Each payout tier needs a number of completed jobs within a time window, and the highest tier you qualify for applies. See your progress in Settings → Payout tiers.', 'For creatives', 9, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('faq_creative_11', 'How do I withdraw my earnings?', 'On Withdrawals, enter a whole number of tokens and submit. The minimum is shown above the field. Our team reviews the request, and you''re notified when it''s approved, rejected or paid. You can cancel while it''s still Pending.', 'For creatives', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('faq_creative_12', 'Who can see my moodboards?', 'Only you and the brandbite team, until you share one with the customer on a linked job. The customer can look through a shared board but can''t change it, and you can stop sharing at any time.', 'For creatives', 11, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('faq_creative_13', 'How is my withdrawal paid?', 'Approved withdrawals are paid out by our finance team within the timeframe agreed when you joined, typically 5–10 business days. You''re notified when it''s paid.', 'For creatives', 12, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- The brand name is lowercase in running text. The legal name stays as it is.
UPDATE "Faq"
SET
  "question" = regexp_replace("question", 'Brandbite(?! FZE)', 'brandbite', 'g'),
  "answer" = regexp_replace("answer", 'Brandbite(?! FZE)', 'brandbite', 'g'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "question" ~ 'Brandbite(?! FZE)' OR "answer" ~ 'Brandbite(?! FZE)';
