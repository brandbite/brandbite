// -----------------------------------------------------------------------------
// @file: lib/support/guides/admin.ts
// @purpose: Support guides for the admin dashboard (/admin/**). Written from
//           the page and API code (Nov 2026). Keep in sync with ADMIN_NAV and
//           the pages they describe — when an admin page changes, update its
//           guide in the same PR. Guides for ownerOnly pages set
//           `ownerOnly: true` so SITE_ADMINs don't see them.
//
//           Known gaps the guides describe honestly or warn about (tracked
//           for fixing — update the guide when each is fixed):
//           - Board / Tickets load only the 50 most recent tickets.
//           - The Tickets list "payout" is jobType.creativePayoutTokens, not
//             the payout actually credited (see the payouts guide).
//           - Bulk "Set status" writes raw statuses (no refunds/notifications/
//             audit); bulk Done pays the creative.
//           - Landing editor and 6 of 7 Pages entries affect nothing public.
//           - Meta title/description are only used by Blog posts.
//           - Plan assignment doesn't touch Stripe.
//           - Owner-only controls are visible to SITE_ADMIN (server refuses).
// -----------------------------------------------------------------------------

import type { SupportGuide } from "../types";

export const ADMIN_GUIDES: SupportGuide[] = [
  // ---------------------------------------------------------------------------
  // Getting started
  // ---------------------------------------------------------------------------
  {
    slug: "getting-around",
    title: "Getting around the admin",
    summary: "How the admin is organised, how to jump to any page, and where help lives.",
    category: "Getting started",
    routes: ["/admin/support"],
    keywords: ["navigation", "sidebar", "menu", "start", "help", "command palette", "shortcut"],
    related: ["roles-and-safeguards", "dashboard"],
    sections: [
      {
        heading: "The sidebar",
        blocks: [
          {
            type: "p",
            text: "Admin pages are grouped into **Workspace**, **Catalog**, **Finance**, **People**, **Content** and **System**. Click a group name to fold or unfold it; your choice is remembered. The group you're in always stays open.",
          },
          {
            type: "p",
            text: "**Support** and **Settings** are pinned at the bottom, above your account menu. The **Withdrawals** item shows how many requests are waiting.",
          },
          {
            type: "tip",
            text: "Some pages — Talent applications, Audit Log and Two-factor — are only for the site owner and don't appear for site admins.",
          },
        ],
      },
      {
        heading: "The top bar",
        blocks: [
          {
            type: "list",
            items: [
              { term: "Breadcrumb", text: "shows which section and page you're on." },
              {
                term: "Search workspace",
                text: "jumps to any admin page by name, including pages without a sidebar entry (Tickets, Completed jobs, Consultation settings, Plan assignment). Press **Ctrl K** (**⌘K** on a Mac) from anywhere. It searches page names, not data.",
              },
              {
                term: "Help",
                text: "opens the Support guide for the page you're on.",
              },
              { term: "Bell", text: "your notifications." },
            ],
          },
        ],
      },
      {
        heading: "Unsaved changes",
        blocks: [
          {
            type: "p",
            text: "Editors warn you with **Discard unsaved changes?** before you leave with changes you haven't saved — when you click a link, use the search, sign out, reload or close the tab.",
          },
          {
            type: "warning",
            text: "The browser's own Back and Forward buttons aren't covered. Save before using them.",
          },
        ],
      },
    ],
  },
  {
    slug: "roles-and-safeguards",
    title: "Admin roles, confirmations and security checks",
    summary:
      "What site owners and site admins can do, typed confirmation phrases, and two-factor checks for money actions.",
    category: "Getting started",
    routes: [],
    keywords: [
      "owner",
      "site admin",
      "permissions",
      "mfa",
      "security check",
      "confirm",
      "phrase",
      "approve",
      "paid",
      "grant",
      "debit",
      "promote",
      "delete",
    ],
    related: ["two-factor", "audit-log", "users"],
    sections: [
      {
        heading: "Site owner and site admin",
        blocks: [
          {
            type: "p",
            text: "Both roles can see every admin page except Talent applications, Audit Log and Two-factor. Only the **site owner** can:",
          },
          {
            type: "list",
            items: [
              "approve withdrawals and mark them paid,",
              "grant or revoke company tokens and override ticket pricing,",
              "create and edit plans and assign them to companies,",
              "create, edit and delete payout rules,",
              "change AI tool prices and rate limits,",
              "change consultation settings and connect Google Calendar,",
              "give anyone an admin role, change a site owner's role, or delete a user,",
              "manage talent applications, and delete feedback and contact messages.",
            ],
          },
          {
            type: "p",
            text: "Pages with owner-only actions show a **Site owner only** note to site admins. Some owner-only buttons are still visible to site admins; using them returns an error.",
          },
        ],
      },
      {
        heading: "Typed confirmations",
        blocks: [
          {
            type: "p",
            text: "Actions that move money or change privileges ask you to type a word first (capitals don't matter):",
          },
          {
            type: "list",
            items: [
              { term: "APPROVE", text: "approve a withdrawal." },
              { term: "PAID", text: "mark a withdrawal as paid." },
              { term: "GRANT / DEBIT", text: "add or remove company tokens." },
              { term: "PROMOTE", text: "give or take away an admin role." },
              { term: "DELETE", text: "delete a user account." },
            ],
          },
        ],
      },
      {
        heading: "Security checks",
        blocks: [
          {
            type: "p",
            text: "The same actions can also ask for a **Security check**: a 6-digit code from your authenticator app (if you set one up under Two-factor) or one emailed to you. Emailed codes last 10 minutes.",
          },
          {
            type: "tip",
            text: "After one successful check, money actions don't ask again for **30 minutes**.",
          },
          {
            type: "p",
            text: "Every protected action is recorded in the Audit Log, and site owners get an email receipt.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Workspace
  // ---------------------------------------------------------------------------
  {
    slug: "dashboard",
    title: "Dashboard",
    summary:
      "Platform totals, what needs attention, workflow, token economy and the withdrawal queue.",
    category: "Workspace",
    routes: ["/admin"],
    keywords: ["overview", "kpi", "overdue", "stale", "low balance"],
    related: ["board-and-tickets", "companies", "withdrawals"],
    sections: [
      {
        heading: "What's on the page",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Companies, Creatives, Tickets, Token balance",
                text: "headline totals. A company counts as active if it created a ticket in the last 30 days.",
              },
              {
                term: "Needs attention",
                text: "overdue tickets (past due, not Done), stale tickets (In progress with no update for over 7 days) and low-balance companies (under 5 tokens).",
              },
              {
                term: "Ticket workflow and Priority breakdown",
                text: "where tickets are and how urgent they are.",
              },
              {
                term: "Token economy",
                text: "credits, debits, net flow, average revisions per completed ticket and total paid out.",
              },
              {
                term: "Withdrawal queue",
                text: "how many requests are pending, with a button to review them.",
              },
            ],
          },
          {
            type: "tip",
            text: "The overdue and stale links open the Board without a filter. Use the Board's **Overdue** toggle to narrow it down.",
          },
        ],
      },
    ],
  },
  {
    slug: "companies",
    title: "Companies, token adjustments and auto-assign",
    summary:
      "Find clients, check balances and plans, add or remove tokens, and switch auto-assign.",
    category: "Workspace",
    routes: ["/admin/companies"],
    keywords: [
      "clients",
      "balance",
      "grant",
      "revoke",
      "adjust tokens",
      "auto-assign",
      "low balance",
    ],
    related: ["plans", "plan-assignment", "ledger"],
    sections: [
      {
        heading: "Finding a company",
        blocks: [
          {
            type: "p",
            text: "Search by name or slug and filter by plan or balance. **Show low balance only** lists companies under 5 tokens. Select a row to see its plan, activity and assignment setting.",
          },
        ],
      },
      {
        heading: "Adding or removing tokens",
        blocks: [
          {
            type: "steps",
            items: [
              "Select the company and click **Adjust tokens**.",
              "Choose **+ Grant tokens** or **− Revoke tokens** and enter the amount. You can't revoke below zero.",
              "Write a reason (at least 3 characters). It's shown on the token ledger.",
              "Type **GRANT** or **DEBIT** to confirm, submit, and complete the security check if asked.",
            ],
          },
          {
            type: "p",
            text: "Site owner only. The change is recorded on the ledger as an admin adjustment and in the Audit Log.",
          },
        ],
      },
      {
        heading: "Auto-assign",
        blocks: [
          {
            type: "p",
            text: "**Turn on auto-assign** makes new requests from this company go to a matching creative automatically. If the company already has unassigned requests in Backlog, you can choose **Just enable** or **Enable & assign** to assign them now.",
          },
          {
            type: "p",
            text: "**Turn off auto-assign** takes effect immediately; new requests then wait for you to assign them on the Tickets page.",
          },
        ],
      },
    ],
  },
  {
    slug: "board-and-tickets",
    title: "Board and Tickets",
    summary: "See every request, assign creatives, override pricing and make bulk changes.",
    category: "Workspace",
    routes: ["/admin/board", "/admin/tickets"],
    keywords: [
      "kanban",
      "assign",
      "reassign",
      "creative",
      "pricing",
      "override",
      "bulk",
      "status",
      "priority",
      "re-run auto-assign",
    ],
    related: ["ticket-detail", "payouts", "companies"],
    sections: [
      {
        heading: "The Board",
        blocks: [
          {
            type: "p",
            text: "A read-only view of requests in **Backlog**, **In progress**, **In review** and **Done**. Filter by company, creative (including **Unassigned**) and priority, toggle **Overdue**, or search. Click a card to open its detail page.",
          },
          {
            type: "p",
            text: "**Re-run auto-assign** tries to assign every unassigned Backlog request across all companies that have auto-assign on. It runs straight away, without a confirmation.",
          },
          {
            type: "warning",
            text: "The Board and the Tickets table show the **50 most recent** requests.",
          },
        ],
      },
      {
        heading: "Assigning a creative",
        blocks: [
          {
            type: "steps",
            items: [
              "Switch to **Table** (or open Tickets) and select a request.",
              "On the **Assignment** tab, pick a creative under **Assigned creative**. It saves immediately.",
            ],
          },
        ],
      },
      {
        heading: "Overriding pricing (site owner)",
        blocks: [
          {
            type: "p",
            text: "On the **Pricing** tab you can set a custom **Ticket cost** and **Creative payout**. Leave a field empty to use the job type's default, then click **Apply pricing**.",
          },
          {
            type: "warning",
            text: "Changing the ticket cost charges or refunds the company the difference **immediately**. A custom creative payout replaces the normal rate-based payout when the job is approved.",
          },
        ],
      },
      {
        heading: "Bulk changes",
        blocks: [
          {
            type: "p",
            text: "Tick several rows to reassign them, change their status or change their priority at once (up to 100).",
          },
          {
            type: "warning",
            text: "Bulk **Set status → Done** completes the jobs and pays the creatives, with no confirmation. Other bulk status changes skip the usual rules: no refunds, charges or notifications. Prefer letting customers and creatives move requests themselves.",
          },
        ],
      },
    ],
  },
  {
    slug: "ticket-detail",
    title: "Ticket detail",
    summary: "Everything about one request: brief, versions, comments, pricing and history.",
    category: "Workspace",
    routes: ["/admin/tickets/[ticketId]"],
    keywords: ["ticket", "brief", "revisions", "comments", "assignment history"],
    related: ["board-and-tickets"],
    sections: [
      {
        heading: "What's on the page",
        blocks: [
          {
            type: "list",
            items: [
              { term: "Brief", text: "the customer's description and attachments." },
              { term: "Revisions", text: "every version the creative sent, with feedback." },
              { term: "Comments", text: "the conversation on the request." },
              {
                term: "Ticket details",
                text: "customer, creative, token cost (with any overrides) and job type.",
              },
              {
                term: "Activity",
                text: "assignment history and admin actions on this request.",
              },
            ],
          },
          {
            type: "p",
            text: "This page is read-only. Change the assignment or pricing from the **Tickets** table.",
          },
        ],
      },
    ],
  },
  {
    slug: "consultations",
    title: "Consultations",
    summary: "Schedule consultation calls, mark them completed, or cancel and refund.",
    category: "Workspace",
    routes: ["/admin/consultations"],
    keywords: ["call", "meeting", "schedule", "reschedule", "refund", "cancel", "video link"],
    related: ["consultation-settings"],
    sections: [
      {
        heading: "Scheduling a request",
        blocks: [
          {
            type: "steps",
            items: [
              "Select a **Pending** request. The **Request** tab shows what they want to discuss and the times they offered.",
              "Click **Use this** on a preferred time, or **Schedule**.",
              "Set the date and time (in your browser's time zone) and paste the **Video link**.",
              "Optionally add internal notes (not shown to the customer) and click **Confirm schedule**.",
            ],
          },
          {
            type: "warning",
            text: "Scheduling here doesn't create a calendar event or send an email. Send the customer the time and link yourself.",
          },
        ],
      },
      {
        heading: "After the call",
        blocks: [
          {
            type: "list",
            items: [
              "**Mark completed** once the call has happened.",
              "**Reschedule** to change the time or link of a scheduled call.",
              "**Cancel & refund** cancels the booking and returns its tokens to the company. This can't be undone.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "consultation-settings",
    title: "Consultation settings and Google Calendar",
    summary:
      "Price, duration, availability, and connecting Google Calendar for automatic scheduling.",
    category: "Workspace",
    routes: ["/admin/consultations/settings"],
    keywords: [
      "price",
      "availability",
      "working hours",
      "google calendar",
      "reconnect",
      "broken",
      "meet",
    ],
    related: ["consultations"],
    sections: [
      {
        heading: "General, pricing and availability",
        blocks: [
          {
            type: "list",
            items: [
              { term: "Bookings enabled", text: "turn customer bookings on or off." },
              {
                term: "Token cost",
                text: "charged when a customer submits a request; changes apply to new bookings only.",
              },
              { term: "Duration", text: "length of each call." },
              {
                term: "Working days and hours, timezone",
                text: "which slots customers can pick.",
              },
              {
                term: "Minimum notice and booking window",
                text: "how soon and how far ahead customers can book.",
              },
            ],
          },
          {
            type: "p",
            text: "Click **Save settings**. Site owner only.",
          },
        ],
      },
      {
        heading: "Google Calendar",
        blocks: [
          {
            type: "p",
            text: "With Google Calendar connected, a customer who picks a free slot is booked straight away with a Google Meet link, and busy times are greyed out for customers. Without it, every request waits for you to schedule it by hand.",
          },
          {
            type: "steps",
            items: [
              "On the **Calendar** tab, click **Connect Google Calendar** and approve access with the team Google account.",
              "You're returned here with **Google Calendar connected**.",
            ],
          },
        ],
      },
      {
        heading: "Fixing a broken connection",
        blocks: [
          {
            type: "p",
            text: "If Google stops accepting the connection (for example after a password change), a red **Google Calendar connection is broken** banner appears on every admin page and automatic bookings stop.",
          },
          {
            type: "steps",
            items: [
              "Open **Calendar** in Consultation settings.",
              "Click **Disconnect** and confirm.",
              "Click **Connect Google Calendar** again with the same Google account.",
            ],
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Catalog
  // ---------------------------------------------------------------------------
  {
    slug: "plans",
    title: "Plans",
    summary:
      "Subscription plans and one-time top-up packs: tokens, price, Stripe link and pricing card.",
    category: "Catalog",
    routes: ["/admin/plans"],
    keywords: ["subscription", "top-up", "stripe", "price", "monthly tokens", "pricing card"],
    related: ["plan-assignment", "companies"],
    sections: [
      {
        heading: "Creating or editing a plan",
        blocks: [
          {
            type: "steps",
            items: [
              "Click **+ New plan**, or select a plan.",
              "**Plan details**: name, **Monthly token allowance**, and whether it's **Available for assignment**.",
              "**Billing & Stripe**: price, **Recurring subscription** (off = a one-time top-up pack), and the Stripe product and price IDs.",
              "**Pricing card**: tagline, feature bullets, button text and display order for the public pricing page.",
              "Click **Create plan** or **Save changes**. Site owner only.",
            ],
          },
        ],
      },
      {
        heading: "What the fields do",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Monthly tokens",
                text: "added to the company's balance when they first subscribe and at every renewal. Top-up packs add them once.",
              },
              {
                term: "Stripe price ID",
                text: "what customers are actually charged. Without it, checkout for the plan fails.",
              },
              {
                term: "Price",
                text: "the amount shown on the site. Keep it in step with the Stripe price.",
              },
              {
                term: "Available for assignment",
                text: "inactive plans can't be bought or assigned. Only active recurring plans appear on the public pricing page.",
              },
            ],
          },
          {
            type: "p",
            text: "Plans can't be deleted; make a plan inactive instead.",
          },
        ],
      },
    ],
  },
  {
    slug: "plan-assignment",
    title: "Plan assignment",
    summary: "Link a company to a plan without going through checkout.",
    category: "Catalog",
    routes: ["/admin/plan-assignment"],
    keywords: ["assign plan", "change plan", "company plan"],
    related: ["plans", "companies"],
    sections: [
      {
        heading: "Assigning a plan",
        blocks: [
          {
            type: "steps",
            items: [
              "Select a company and pick a plan under **New plan (to assign)**. Only active plans are offered.",
              "Check the preview: the company's balance stays the same.",
              "Click **Apply plan change**. Site owner only.",
            ],
          },
          {
            type: "warning",
            text: "This only changes which plan the company is linked to. It doesn't change their Stripe subscription or what they're charged — for paying customers, change plans through Stripe instead, or the two will disagree.",
          },
        ],
      },
    ],
  },
  {
    slug: "job-types",
    title: "Job types",
    summary:
      "The services customers can request: pricing by estimated hours, categories, quantities and AI prompts.",
    category: "Catalog",
    routes: ["/admin/job-types"],
    keywords: [
      "services",
      "catalog",
      "estimated hours",
      "token cost",
      "per unit",
      "quantity",
      "ai prompt",
    ],
    related: ["job-type-categories", "payouts"],
    sections: [
      {
        heading: "Creating or editing a job type",
        blocks: [
          {
            type: "steps",
            items: [
              "Click **+ New job type**, or select one.",
              "**Details**: name, category, description, and **Active** (inactive job types are hidden from customers).",
              "**Pricing**: set **Estimated hours**. One estimated hour costs the customer one token.",
              "Turn on **Per-unit pricing** for jobs ordered in quantities, and set the quantity label and default.",
              "Optionally add an **AI prompt template**, used for AI image generation on this job type.",
              "Click **Create job type** or **Save job type**.",
            ],
          },
        ],
      },
      {
        heading: "How pricing works",
        blocks: [
          {
            type: "list",
            items: [
              "Customer cost = estimated hours × quantity, charged when the request is created.",
              "The creative is paid a percentage of that cost when the job is approved — see **How creative payouts work**.",
            ],
          },
          {
            type: "warning",
            text: "Changing the estimated hours also changes what creatives are paid on open jobs of that type, because payouts use the cost at approval time.",
          },
        ],
      },
    ],
  },
  {
    slug: "job-type-categories",
    title: "Job type categories",
    summary: "Group and order services in the catalog and the new request form.",
    category: "Catalog",
    routes: ["/admin/job-type-categories"],
    keywords: ["categories", "order", "icon", "review & link"],
    related: ["job-types"],
    sections: [
      {
        heading: "Managing categories",
        blocks: [
          {
            type: "list",
            items: [
              "**+ New category**: name, emoji icon and **Display order** (lower first).",
              "**Active** categories appear in the service catalog and the new request form.",
              "Renaming a category updates its slug automatically.",
              "**Delete category** is permanent; its job types become uncategorised.",
            ],
          },
        ],
      },
      {
        heading: "Review & link",
        blocks: [
          {
            type: "p",
            text: "If some job types only have an old text category, a banner offers **Review & link**. It links them to matching categories, creating any that are missing. It's safe to run more than once.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Finance
  // ---------------------------------------------------------------------------
  {
    slug: "payouts",
    title: "How creative payouts work",
    summary: "The base rate, payout rules, per-ticket overrides and when creatives are paid.",
    category: "Finance",
    routes: ["/admin/payout-rules"],
    keywords: [
      "payout",
      "rate",
      "percentage",
      "tier",
      "rule",
      "milestone",
      "base rate",
      "override",
    ],
    related: ["withdrawals", "job-types", "board-and-tickets"],
    sections: [
      {
        heading: "The formula",
        blocks: [
          {
            type: "p",
            text: "When a customer approves a job, the creative is paid: the job's token cost × quantity × their **payout rate**, rounded to whole tokens. If an owner set a custom creative payout on the ticket, that exact amount is paid instead.",
          },
          {
            type: "p",
            text: "Everyone starts on the **base rate of 60%**. Payouts happen once per job, at approval.",
          },
        ],
      },
      {
        heading: "Payout rules",
        blocks: [
          {
            type: "p",
            text: "Rules reward busy creatives with a higher rate. Each rule has a minimum number of completed jobs within a time window (in days) and a rate above 60%, up to 100%.",
          },
          {
            type: "steps",
            items: [
              "Click **New rule**, give it a name and an optional description (creatives see it).",
              "Set **Min. completed tickets**, **Time window** and **Payout rate**, and switch **Rule active** on.",
              "Click **Create rule**. Site owner only.",
            ],
          },
          {
            type: "list",
            items: [
              "The highest rate a creative qualifies for applies; rates don't add up.",
              "Changes affect future approvals only.",
              "Deleting a rule is permanent. To pause one, switch it off instead.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "withdrawals",
    title: "Withdrawals",
    summary: "Approve creative payout requests, record payment, or reject them.",
    category: "Finance",
    routes: ["/admin/withdrawals"],
    keywords: ["withdraw", "payout", "approve", "paid", "reject", "co-approval", "auto payout"],
    related: ["roles-and-safeguards", "payouts", "settings"],
    sections: [
      {
        heading: "Two steps: approve, then pay",
        blocks: [
          {
            type: "steps",
            items: [
              "Select a **Pending** request and click **Approve request**. Type **APPROVE** and pass the security check. No tokens move yet.",
              "Pay the creative outside the dashboard.",
              "Select the request again and click **Mark as paid**. Type **PAID** and pass the security check. The tokens are now taken from the creative's balance.",
            ],
          },
          {
            type: "p",
            text: "Approving and marking paid are site owner only. The creative is notified at each step.",
          },
          {
            type: "warning",
            text: "Marking paid can't be undone. It's refused if the creative no longer has enough tokens.",
          },
        ],
      },
      {
        heading: "Rejecting",
        blocks: [
          {
            type: "p",
            text: "**Reject request** on a Pending request closes it and releases the held tokens back to the creative. Site owners and site admins can reject. A rejected request can't be approved later.",
          },
        ],
      },
      {
        heading: "Large withdrawals",
        blocks: [
          {
            type: "p",
            text: "Requests of **50,000 tokens or more** need two different site owners to approve. The first approval is recorded and the other owners are emailed. If there's only one site owner, one approval is enough.",
          },
        ],
      },
      {
        heading: "Automatic weekly requests",
        blocks: [
          {
            type: "p",
            text: "If **Auto-create weekly payout requests** is on in Settings, every Monday a Pending request is created for each creative at or above the threshold. You still approve and pay them here.",
          },
        ],
      },
    ],
  },
  {
    slug: "ledger",
    title: "Token ledger and analytics",
    summary: "Trace token movements across companies and creatives, and see per-company totals.",
    category: "Finance",
    routes: ["/admin/ledger", "/admin/token-analytics"],
    keywords: ["ledger", "movements", "credits", "debits", "analytics", "net flow"],
    related: ["companies", "completed-jobs"],
    sections: [
      {
        heading: "Token ledger",
        blocks: [
          {
            type: "p",
            text: "A read-only list of token movements — plan credits, top-ups, job charges, refunds, payouts and withdrawals — for companies and creatives. Search by company, ticket, reason or note, filter by company and direction, and select a row for the balance before and after, references and metadata.",
          },
          {
            type: "p",
            text: "It shows the 200 most recent movements, and the cards at the top total those 200.",
          },
        ],
      },
      {
        heading: "Token analytics",
        blocks: [
          {
            type: "p",
            text: "All-time credit and debit totals per company, sorted by net flow. Net flow isn't a live balance — see Companies for current balances.",
          },
        ],
      },
    ],
  },
  {
    slug: "completed-jobs",
    title: "Completed jobs",
    summary: "Check that finished work has a matching creative payout on the ledger.",
    category: "Finance",
    routes: ["/admin/completed-jobs"],
    keywords: ["done", "completed", "payout check", "missing ledger"],
    related: ["ledger", "payouts"],
    sections: [
      {
        heading: "Using the page",
        blocks: [
          {
            type: "p",
            text: "Open it from the Board's **View completed jobs** link or the search. It lists the 100 most recent Done requests and whether each has a creative payout entry on the ledger.",
          },
          {
            type: "p",
            text: "If the banner says some jobs have **no matching ledger entry**, click **Show these only** and open each ticket to investigate. Jobs without a job type are never paid, so they show no entry.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // People
  // ---------------------------------------------------------------------------
  {
    slug: "users",
    title: "Users",
    summary: "Find people, change platform roles, manage creative settings and delete accounts.",
    category: "People",
    routes: ["/admin/users"],
    keywords: [
      "users",
      "role",
      "promote",
      "creative settings",
      "revision notes",
      "cap",
      "delete user",
    ],
    related: ["roles-and-safeguards", "creatives"],
    sections: [
      {
        heading: "Changing a role",
        blocks: [
          {
            type: "steps",
            items: [
              "Search for the person and select them.",
              "Choose a new **Platform role** and click **Apply role**.",
            ],
          },
          {
            type: "p",
            text: "Making someone a site admin or site owner, or changing a site owner's role, is site owner only and needs **PROMOTE** plus a security check. You can't change your own role.",
          },
        ],
      },
      {
        heading: "Creative settings",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Revision notes",
                text: "lets the creative add a note to the customer when sending a version.",
              },
              {
                term: "Open task cap",
                text: "the most open jobs (1–40) the creative can hold before auto-assign skips them.",
              },
              { term: "Working hours", text: "a note for the team; it doesn't affect assignment." },
            ],
          },
        ],
      },
      {
        heading: "Deleting a user",
        blocks: [
          {
            type: "warning",
            text: "Site owner only. **Delete user** needs **DELETE** and a security check. The person's sign-in is removed and their details anonymised; their tickets and ledger history stay. It can't be undone, and site owners can't be deleted (change their role first).",
          },
          {
            type: "p",
            text: "**Show deleted** lists deleted accounts read-only. Select a user and click **Open user profile** for their full history.",
          },
        ],
      },
    ],
  },
  {
    slug: "creatives",
    title: "Creatives and time tracking",
    summary:
      "Compare creative delivery, workload, ratings and earnings, and logged hours against estimates.",
    category: "People",
    routes: ["/admin/creative-analytics", "/admin/time-tracking"],
    keywords: [
      "performance",
      "workload",
      "load score",
      "ratings",
      "time",
      "hours",
      "estimate",
      "overrun",
    ],
    related: ["users", "job-types"],
    sections: [
      {
        heading: "Creatives",
        blocks: [
          {
            type: "p",
            text: "Compare creatives by completed jobs, completion rate, revisions, turnaround, load, earnings and customer rating. Select one for their current work, workload against their cap, and tokens earned. Ratings are visible to admins only.",
          },
          {
            type: "p",
            text: "**Load score** adds up priority × token cost over the creative's active jobs; **Relative load** compares it with the busiest creative.",
          },
        ],
      },
      {
        heading: "Time tracking",
        blocks: [
          {
            type: "p",
            text: "Requests where creatives logged time, with logged hours against the job type's estimate. Sort by **Overruns first** to find jobs that took longer than estimated — a sign the estimate (and so the price) may need adjusting.",
          },
        ],
      },
    ],
  },
  {
    slug: "talent-applications",
    title: "Talent applications",
    summary: "Move applicants from the public form through interview to a creative account.",
    category: "People",
    routes: ["/admin/talent-applications"],
    keywords: ["talent", "applicants", "hiring", "interview", "onboard", "recruit"],
    ownerOnly: true,
    related: ["settings", "consultation-settings"],
    sections: [
      {
        heading: "The hiring steps",
        blocks: [
          {
            type: "steps",
            items: [
              "**Accept & offer 3 slots**: enter three future 30-minute interview times (within 60 days) and an optional note. The candidate gets a booking link valid for 7 days.",
              "When they propose a time, **Confirm this time & book interview** creates a Google Calendar event with a Meet link. Google Calendar must be connected.",
              "After the call, choose **Yes, interview held** or **No-show — reschedule**.",
              "**Hire & capture terms**: working hours, approved categories and task cap. No account is created yet.",
              "**Onboard now** creates the creative account with those skills and emails a sign-in link.",
            ],
          },
          {
            type: "p",
            text: "**Decline** (before the interview) or **Decline after interview** closes the application and emails the candidate, with an optional reason.",
          },
          {
            type: "tip",
            text: "Turn the public form on or off with **Talent applications open** in Settings.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Content
  // ---------------------------------------------------------------------------
  {
    slug: "content-overview",
    title: "Where content appears on the site",
    summary: "Which Content page controls which part of the public website.",
    category: "Content",
    routes: [],
    keywords: ["cms", "content", "website", "public", "landing", "site chrome"],
    related: ["blog-news-showcase", "docs", "faq"],
    sections: [
      {
        heading: "Page by page",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "FAQ",
                text: "/faq, plus the FAQ pages in the customer and creative dashboards.",
              },
              { term: "Blog", text: "/blog and each post." },
              { term: "News", text: "/news and each article." },
              { term: "Showcase", text: "/showcase and each work." },
              { term: "Docs", text: "the help centre at /documentation." },
              { term: "Palette Ideas", text: "/colors/color-palette-ideas." },
              { term: "Color Meanings", text: "/colors/color-meanings and each colour." },
              {
                term: "Site chrome",
                text: "the header and footer links on the older pages: /documentation, /news, /showcase and /accessibility.",
              },
              {
                term: "Pages",
                text: "only **Accessibility** is shown on the site (at /accessibility). About, Contact, Privacy and Terms are fixed pages that don't use these entries.",
              },
              {
                term: "Landing page",
                text: "not connected to anything: the homepage is a fixed design. Saving here changes nothing visitors see.",
              },
            ],
          },
        ],
      },
      {
        heading: "Things that work the same everywhere",
        blocks: [
          {
            type: "list",
            items: [
              "Leave the slug blank to generate it from the title. Changing a slug changes the public address, and the old address stops working.",
              "Deleting is permanent. To take something down but keep it, set it to Draft or hide it.",
              "Changes go live as soon as you save.",
            ],
          },
          {
            type: "warning",
            text: "In the text editor's **Add link**, type full addresses starting with https://. Short internal links like /pricing don't work there yet.",
          },
        ],
      },
    ],
  },
  {
    slug: "faq",
    title: "FAQ",
    summary:
      "Add, edit, hide, order and delete the questions on the public and dashboard FAQ pages.",
    category: "Content",
    routes: ["/admin/faq"],
    keywords: ["faq", "questions", "answers", "category", "order", "hide"],
    related: ["content-overview"],
    sections: [
      {
        heading: "Managing questions",
        blocks: [
          {
            type: "steps",
            items: [
              "Click **+ New FAQ**, or select a question.",
              "Pick or type a **Category**, write the **Question** and the **Answer** (plain text; line breaks are kept).",
              "Leave **Visible to visitors** on to publish it, or off to keep it hidden.",
              "Click **Create FAQ** or **Save FAQ**.",
            ],
          },
          {
            type: "list",
            items: [
              "**Move up / Move down** reorders a question within its category and saves straight away.",
              "Creatives only see the General, Creative Process and Platform & Tools categories.",
              "**Delete FAQ** is permanent; hide a question to keep it.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "blog-news-showcase",
    title: "Blog, News and Showcase",
    summary: "Write, publish and manage blog posts, news articles and portfolio works.",
    category: "Content",
    routes: ["/admin/blog", "/admin/news", "/admin/showcase"],
    keywords: [
      "blog",
      "news",
      "showcase",
      "portfolio",
      "post",
      "article",
      "publish",
      "draft",
      "seo",
    ],
    related: ["content-overview"],
    sections: [
      {
        heading: "Writing and publishing",
        blocks: [
          {
            type: "steps",
            items: [
              "Click **New post**, **New article** or **New work**.",
              "Fill in the title, an optional slug, and the summary details (excerpt, author, category or client).",
              "Write the body, and add the hero image and thumbnail.",
              "Turn on **Published** to make it live, or leave it as a draft.",
              "Save. Published items appear on the site straight away; **View on site** opens them.",
            ],
          },
          {
            type: "list",
            items: [
              "The publish date is set the first time you publish and kept if you unpublish and republish. Blog and News are listed newest first by that date.",
              "Showcase works are listed by **Sort order** (lower first).",
              "**Meta title** and **Meta description** are used for blog posts. News articles don't use them yet.",
              "Tags are saved but not shown on the site yet.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "docs",
    title: "Docs (help centre)",
    summary: "Categories and articles for the public help centre at /documentation.",
    category: "Content",
    routes: ["/admin/docs"],
    keywords: ["documentation", "help centre", "articles", "categories", "audience"],
    related: ["content-overview"],
    sections: [
      {
        heading: "Categories",
        blocks: [
          {
            type: "list",
            items: [
              "Each category has a title, description, emoji icon, **Audience** (General, For Creatives or For Customers) and **Display order**.",
              "Audience only decides which tab a category appears under; all published content is public.",
              "Every category is shown, even with no published articles.",
              "A category can only be deleted once it has no articles.",
            ],
          },
        ],
      },
      {
        heading: "Articles",
        blocks: [
          {
            type: "steps",
            items: [
              "Click **New article** (or **+ New article in this category**).",
              "Write the title, excerpt and body.",
              "Under **Settings**, choose the category and optionally a slug and sort order.",
              "Under **SEO & publish**, turn on **Published** and save. Saving closes the editor.",
            ],
          },
          {
            type: "p",
            text: "Articles live at /documentation/{category}/{article}.",
          },
        ],
      },
    ],
  },
  {
    slug: "color-content",
    title: "Palette ideas and colour meanings",
    summary: "The curated palettes and colour encyclopedia on the /colors tools.",
    category: "Content",
    routes: ["/admin/palette-ideas", "/admin/color-meanings"],
    keywords: ["palette", "colors", "colour", "hex", "meanings", "encyclopedia"],
    related: ["content-overview"],
    sections: [
      {
        heading: "Palette ideas",
        blocks: [
          {
            type: "p",
            text: "Each palette has a title, summary, tags and up to 12 colours (hex values like #1D3557). Set **Status** to Published and a **Sort order** to show it in the gallery, lowest first. The editor clears after each save.",
          },
        ],
      },
      {
        heading: "Colour meanings",
        blocks: [
          {
            type: "p",
            text: "Each colour has a name, hex value, summary, a **Meaning & psychology** text, associations and sample palettes (one per line, comma-separated hex values). Published colours get their own page at /colors/color-meanings/{slug}.",
          },
        ],
      },
    ],
  },
  {
    slug: "site-and-pages",
    title: "Site chrome, Pages and the Landing editor",
    summary:
      "Header and footer links on the older pages, single pages, and the legacy landing editor.",
    category: "Content",
    routes: ["/admin/site", "/admin/pages", "/admin/landing"],
    keywords: ["header", "footer", "navigation", "legal", "pages", "accessibility", "landing"],
    related: ["content-overview"],
    sections: [
      {
        heading: "Site chrome",
        blocks: [
          {
            type: "p",
            text: "Edit the navigation links (up to 10) and the footer columns and legal links shown on /documentation, /news, /showcase and /accessibility. The homepage and the other redesigned pages have their own fixed header and footer. Site owner only.",
          },
        ],
      },
      {
        heading: "Pages",
        blocks: [
          {
            type: "p",
            text: "Edit a page's title, subtitle, hero image and body. Only **Accessibility** is shown on the site today; the other entries are kept for reference.",
          },
        ],
      },
      {
        heading: "Landing page",
        blocks: [
          {
            type: "warning",
            text: "The Landing editor is a legacy tool. The homepage is a fixed design, so nothing saved here appears on the site.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // System
  // ---------------------------------------------------------------------------
  {
    slug: "settings",
    title: "Settings",
    summary:
      "Platform-wide switches: withdrawals, auto-payouts, talent form, owner emails and features.",
    category: "System",
    routes: ["/admin/settings"],
    keywords: [
      "settings",
      "minimum withdrawal",
      "auto payout",
      "threshold",
      "talent",
      "emails",
      "tags",
      "ai tickets",
    ],
    related: ["withdrawals", "talent-applications", "ai-settings"],
    sections: [
      {
        heading: "The settings",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Minimum withdrawal (tokens)",
                text: "the smallest withdrawal a creative can request (default 20).",
              },
              {
                term: "Auto-create weekly payout requests",
                text: "every Monday, creates a Pending withdrawal for each creative at or above the threshold (default on).",
              },
              {
                term: "Auto-payout threshold (tokens)",
                text: "the balance that triggers an automatic request (default 100).",
              },
              {
                term: "Talent applications open",
                text: "turns the public /talent application form on or off.",
              },
              {
                term: "Email site owners on system events",
                text: "one switch for every owner email: feedback, new tickets and companies, payments, talent applications, withdrawal requests, contact messages and Google Calendar alerts.",
              },
              {
                term: "Ticket tags",
                text: "shows or hides tags for customers (off by default; existing tags are kept).",
              },
              {
                term: "AI ticket mode",
                text: 'controls the "Work with AI" option on new requests. Leave it **Off** — it isn\'t ready for customers yet.',
              },
            ],
          },
          {
            type: "p",
            text: "Each setting has its own **Save** button and takes effect immediately.",
          },
        ],
      },
    ],
  },
  {
    slug: "ai-settings",
    title: "AI settings",
    summary: "Turn AI tools on or off, and set their token cost and hourly limits.",
    category: "System",
    routes: ["/admin/ai-settings"],
    keywords: [
      "ai",
      "tools",
      "token cost",
      "rate limit",
      "image generation",
      "copy",
      "background removal",
      "upscale",
    ],
    related: ["settings"],
    sections: [
      {
        heading: "Managing tools",
        blocks: [
          {
            type: "list",
            items: [
              "The **Availability** switch turns a tool on or off for customers and saves immediately.",
              "**Token cost** is charged per use; **Rate limit / hour** caps how often each company can use the tool in a rolling hour.",
              "Edit costs and limits, then click **Save changes**. Site owner only.",
            ],
          },
          {
            type: "p",
            text: "The cards at the top show how often the tools were used and how many tokens they consumed. Failed generations are refunded to the customer automatically.",
          },
        ],
      },
    ],
  },
  {
    slug: "inboxes",
    title: "Feedback and contact inboxes",
    summary: "Triage in-app feedback and messages from the public contact form.",
    category: "System",
    routes: ["/admin/feedback", "/admin/contact"],
    keywords: ["feedback", "bugs", "feature requests", "contact", "messages", "inbox", "reply"],
    related: ["settings"],
    sections: [
      {
        heading: "Feedback",
        blocks: [
          {
            type: "p",
            text: "Reports from the feedback button in the dashboards. The page opens on **New**. Select a report to read it with the page and browser it came from, set its **Status** (New, Triaged, Planned, Done, Won't do — saves immediately), and keep **Internal notes** the submitter never sees.",
          },
        ],
      },
      {
        heading: "Contact inbox",
        blocks: [
          {
            type: "p",
            text: "Messages from the public /contact form. Opening a message doesn't change its status. Use **Reply by email** to answer from your mail app, then **Mark as read** or **Archive**.",
          },
        ],
      },
      {
        heading: "Deleting",
        blocks: [
          {
            type: "p",
            text: "Site owners can delete spam permanently from the **Danger zone**. For real reports and messages, use **Won't do** or **Archive** instead.",
          },
          {
            type: "p",
            text: "Each inbox shows the 100 most recent entries.",
          },
        ],
      },
    ],
  },
  {
    slug: "audit-log",
    title: "Audit log",
    summary: "The read-only record of privileged admin actions.",
    category: "System",
    routes: ["/admin/audit-log"],
    keywords: ["audit", "log", "history", "forensic", "who did what"],
    ownerOnly: true,
    related: ["roles-and-safeguards"],
    sections: [
      {
        heading: "Using the log",
        blocks: [
          {
            type: "p",
            text: "Every money and privilege action is recorded with who did it, what, when, the outcome (Success, Blocked or Error) and the target: withdrawals, token adjustments, plan and payout rule changes, pricing overrides, admin role changes, user deletions, AI and consultation pricing, Google Calendar changes and auto-assign changes.",
          },
          {
            type: "p",
            text: "Filter by action and outcome, and select a row for the full details. Entries can never be changed or deleted.",
          },
        ],
      },
    ],
  },
  {
    slug: "two-factor",
    title: "Two-factor for money actions",
    summary: "Use an authenticator app instead of emailed codes for security checks.",
    category: "System",
    routes: ["/admin/settings/mfa"],
    keywords: ["two-factor", "mfa", "authenticator", "totp", "security check"],
    ownerOnly: true,
    related: ["roles-and-safeguards", "profile"],
    sections: [
      {
        heading: "Setting it up",
        blocks: [
          {
            type: "steps",
            items: [
              "Scan the QR code with an authenticator app (or use **Can't scan the code?** to type the secret).",
              "Enter the 6-digit code and click **Turn on two-factor**.",
            ],
          },
          {
            type: "p",
            text: "Security checks for money actions then ask for a code from the app instead of emailing one. **Disable authenticator app** switches back to emailed codes.",
          },
          {
            type: "tip",
            text: "This is separate from the sign-in two-factor on your Profile.",
          },
        ],
      },
    ],
  },
  {
    slug: "profile",
    title: "Your admin profile",
    summary: "Name, avatar, email, timezone, notifications, sign-in two-factor and sessions.",
    category: "System",
    routes: ["/admin/profile"],
    keywords: [
      "profile",
      "avatar",
      "email",
      "timezone",
      "notifications",
      "2fa",
      "sessions",
      "password",
    ],
    related: ["two-factor"],
    sections: [
      {
        heading: "The tabs",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Personal details",
                text: "name, avatar (PNG, JPEG, WebP or GIF up to 2 MB), email (confirmed by a link to the new address) and timezone.",
              },
              {
                term: "Notifications",
                text: "in-app and email switches per event. Owner system emails are controlled in Settings instead.",
              },
              {
                term: "Security & sessions",
                text: "sign-in two-factor (with one-time backup codes) and the browsers you're signed in on.",
              },
            ],
          },
          {
            type: "p",
            text: "To change your password, sign out and use **Forgot password?** on the sign-in page.",
          },
        ],
      },
    ],
  },
];
