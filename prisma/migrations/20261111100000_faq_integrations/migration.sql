-- Google Drive (#392/#393) and Dropbox (#399) are live, so "Do you integrate
-- with other tools?" can't say "Not yet" any more. Only applies while the
-- answer is still the text shipped on 2026-11-10, so admin edits stay.
UPDATE "Faq" SET
  "answer" = $$Yes, for your source files. Connect Google Drive or Dropbox under Settings › Integrations, and the layered, print-ready files your creative delivers go straight into your own storage, in a folder for each project and request. brandbite only sees the folder it creates. Dropbox takes files up to 150 MB; bigger ones are kept on brandbite for 90 days after the request is done. Slack notifications are coming soon. Everything else happens in your brandbite dashboard, with in-app and email notifications as your requests move. If there's a tool you'd like us to connect with, tell us at hello@brandbite.studio.$$,
  "updatedAt" = NOW()
WHERE "id" = 'faq_seed_pla_03'
  AND "answer" = $$Not yet. Everything happens in your brandbite dashboard: you get in-app and email notifications as your requests move, and your team works together in one shared workspace. If there's a tool you'd like us to connect with, tell us at hello@brandbite.studio.$$;
