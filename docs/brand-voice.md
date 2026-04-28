# Brandbite Brand Voice

Single source of truth for how Brandbite writes, both in product copy
and in marketing copy. Email templates, the landing page, transactional
notifications, error messages, and any new UI string should follow
these rules.

## Hard rules

These are non-negotiable. Apply on every commit that touches
user-facing copy.

### 1. No em-dashes or en-dashes anywhere in user-facing text

Em-dashes (`—`) and en-dashes (`–`) read as overly formal and are a
hallmark of LLM-generated prose. They make our copy sound like a
press release instead of a real human writing to another human.

**Where this applies:**

- Email templates (the strings inside JSX, rendered HTML)
- Marketing landing pages and all routes under `/app/(marketing)`
- In-app UI labels, modals, tooltips, error messages
- Email subject lines and preview text

**Replacements by intent:**

| Original (banned)                                       | Rewrite                                                 |
| ------------------------------------------------------- | ------------------------------------------------------- |
| `it isn't a marketplace — it's a small team`            | `It isn't a marketplace. It's a small team.`            |
| `24–48 hour turnaround`                                 | `24 to 48 hour turnaround` (or `~1 day`)                |
| `Logo, landing page, ad set — whatever's on your plate` | `Logo, landing page, ad set. Whatever's on your plate.` |
| `1–2 business days`                                     | `1 to 2 business days`                                  |
| `— The Brandbite team` (sign-off)                       | `The Brandbite team` (no leading dash)                  |

When the original sentence relies on the dash to introduce a clause,
prefer breaking into two sentences. When it's a numeric range, use
"to" or rephrase as an upper bound ("within 2 days").

**What is NOT banned:**

- Hyphens in compound modifiers (`real-time`, `top-tier`,
  `pre-launch`). These are hyphens, not dashes, and they're standard
  English.
- Dashes inside URLs, slugs, code identifiers, file names.
- Dashes in code comments (developers see those, not customers).
- Date separators in ISO formats (`2026-04-25`).

### 2. No banned-phrase clichés

Avoid these worn-out SaaS-speak words and phrases. Rewrite into something
specific and concrete:

- "unlock" / "unleash" / "empower"
- "journey" (as a metaphor)
- "leverage" (as a verb)
- "game-changer" / "revolutionary" / "best-in-class"
- "we're so excited"
- "get ready to..."
- "supercharge" / "turbocharge"
- "next-level" / "cutting-edge"

If the line still works without the cliché, the cliché was filler.

### 3. Sparing emoji

Emojis are allowed but must earn their place. Use them when the
emotion or meaning genuinely benefits.

| Email type                                                        | Emoji policy                                       |
| ----------------------------------------------------------------- | -------------------------------------------------- |
| Welcome / first onboarding                                        | One celebratory emoji at the headline (`🎉`) is OK |
| Revision delivered                                                | One personality emoji (`🎨`) is OK                 |
| Password reset, verify email, MFA, BLOCKED alert, payment receipt | None. Stays formal.                                |
| Marketing landing copy                                            | None or very rare. Don't decorate with emoji.      |

### 4. Address the reader directly

- Use "you" and "your", not "users" or "customers"
- Use "we" for Brandbite, not "Brandbite" in third person
- Use "your designer" / "your team", not "the designer assigned to your project"

### 5. Active voice, short sentences

- Bad: "Your design will be delivered within 24 hours by our team."
- Good: "Your designer ships the file in about a day."

Aim for an average sentence length under ~16 words. If a sentence
runs longer, ask whether it should be two sentences.

## Soft rules (style preferences)

- "Hi {name}," is the default greeting. "Hey" works for casual
  product-event emails. Never "Dear" or "Greetings".
- Sign off with the founder name when the message is a trust /
  relationship moment (welcome, escalation reply). Sign off with "The
  Brandbite team" for routine transactional messages.
- "Designer" and "creative" are interchangeable but be consistent
  inside a single email.
- Numbers under 10 spelled out in body copy ("three steps") unless
  used with a unit ("3 hours").
- Currency: `$495/mo`, not `$495 / month` or `$495 per month`.
- Dates: `April 25, 2026` in customer-facing copy; ISO `2026-04-25`
  in tables and admin UI.

## How to update this doc

When you encounter a copy decision worth standardising, add it here in
a new PR alongside the change. Don't accumulate "we should write a
brand voice doc someday" — write the rule once when it comes up.
