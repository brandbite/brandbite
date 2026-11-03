// -----------------------------------------------------------------------------
// @file: lib/support/guides/creative.ts
// @purpose: Support guides for the creative (designer) dashboard
//           (/creative/**). Written from the page code (Nov 2026). Keep in
//           sync with CREATIVE_NAV and the pages they describe — when a
//           creative page changes, update its guide in the same PR.
//
//           Rules described here are enforced server-side
//           (lib/tickets/creative-transitions.ts, computeCreativePayout in
//           lib/token-engine.ts) — keep the guide and those in step.
// -----------------------------------------------------------------------------

import type { SupportGuide } from "../types";

export const CREATIVE_GUIDES: SupportGuide[] = [
  // ---------------------------------------------------------------------------
  // Getting started
  // ---------------------------------------------------------------------------
  {
    slug: "getting-around",
    title: "Getting around your dashboard",
    summary: "What each part of the sidebar is for and where to find help.",
    category: "Getting started",
    routes: ["/creative/support"],
    keywords: ["navigation", "sidebar", "menu", "start", "help"],
    related: ["how-work-works", "getting-assigned"],
    sections: [
      {
        heading: "The sidebar",
        blocks: [
          {
            type: "p",
            text: "Everything in your dashboard is reached from the sidebar on the left:",
          },
          {
            type: "list",
            items: [
              { term: "Overview", text: "a summary of your work, earnings and deadlines." },
              { term: "Board", text: "the jobs assigned to you, by status." },
              { term: "Portfolio", text: "every job you've completed, collected automatically." },
              { term: "Balance", text: "the tokens you've earned and how they moved." },
              { term: "Withdrawals", text: "requesting payouts from your balance." },
              {
                term: "Account",
                text: "your **Profile**, **Settings**, the **FAQ** and this **Support** section.",
              },
            ],
          },
          {
            type: "tip",
            text: "On a small screen the sidebar is tucked away behind the menu button at the top. On desktop you can shrink it to icons with the collapse button at the bottom.",
          },
        ],
      },
      {
        heading: "The bottom of the sidebar",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Bell",
                text: "your notifications. The number shows how many are unread.",
              },
              {
                term: "Help",
                text: "opens the Support guide for the page you are on, or this Support home if the page has no guide yet.",
              },
              { term: "Sign out", text: "ends your session on this device." },
              {
                term: "Theme",
                text: "switches the dashboard between light, dark and system.",
              },
            ],
          },
        ],
      },
      {
        heading: "Still stuck?",
        blocks: [
          {
            type: "p",
            text: "Use the **feedback** button in the bottom-right corner of any page and pick **I'm not sure how this works**. Our team reads every message and the page you were on is attached automatically.",
          },
        ],
      },
    ],
  },
  {
    slug: "how-work-works",
    title: "How a job works",
    summary:
      "From assignment to approval: the four statuses, who moves a job, and when you're paid.",
    category: "Getting started",
    routes: [],
    keywords: ["status", "workflow", "lifecycle", "ticket", "backlog", "approval", "done"],
    related: ["deliver-work", "handle-feedback", "earnings"],
    sections: [
      {
        heading: "The four statuses",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "To do",
                text: "the job has been assigned to you and is waiting to be started. The Overview page calls this **Backlog**.",
              },
              {
                term: "In progress",
                text: "you're working on it. You move it here when you start.",
              },
              {
                term: "In review",
                text: "you've sent a version and the customer is checking it.",
              },
              {
                term: "Done",
                text: "the customer approved it. Only the customer (or our team) can mark a job Done, and Done is final.",
              },
            ],
          },
        ],
      },
      {
        heading: "A typical job",
        blocks: [
          {
            type: "steps",
            items: [
              "A job is assigned to you and appears in **To do**. You get a **New ticket assigned** notification.",
              "Read the brief, then drag it to **In progress** to start.",
              "When a version is ready, use **Upload work** to send it. The job moves to **In review**.",
              "The customer either asks for changes, which sends the job back to **In progress** with their feedback, or approves it.",
              "When they approve, the job moves to **Done** and your payout is added to your balance straight away.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "getting-assigned",
    title: "How jobs are assigned to you",
    summary: "Skills, pausing, your open-job cap, and how auto-assign picks a creative.",
    category: "Getting started",
    routes: [],
    keywords: [
      "assignment",
      "auto-assign",
      "skills",
      "pause",
      "availability",
      "capacity",
      "cap",
      "workload",
      "no jobs",
    ],
    related: ["settings", "profile"],
    sections: [
      {
        heading: "How auto-assign chooses",
        blocks: [
          {
            type: "p",
            text: "When a customer creates a request, it can be assigned automatically. A creative is only considered if they:",
          },
          {
            type: "list",
            items: [
              "have the job's type ticked under **Settings → Skills & expertise**,",
              "are not paused, and",
              "have fewer open jobs (To do, In progress and In review) than their **Concurrent task cap**, if they set one.",
            ],
          },
          {
            type: "p",
            text: "Among those, the creative with the lightest current workload gets the job. Ties go to the creative with the better customer ratings. If nobody qualifies, our team assigns the job by hand.",
          },
          {
            type: "p",
            text: "There's no accept or decline step: assigned jobs appear on your Board in **To do**.",
          },
        ],
      },
      {
        heading: "Getting more of the right jobs",
        blocks: [
          {
            type: "list",
            items: [
              "Tick every job type you can do well in **Settings → Skills & expertise**. With no skills ticked, you won't be matched to jobs.",
              "Set a **Concurrent task cap** in **Profile → Workload** if you want to limit how many open jobs you hold at once.",
            ],
          },
        ],
      },
      {
        heading: "Taking a break",
        blocks: [
          {
            type: "p",
            text: "In **Settings → Availability**, choose **1 hour**, **7 days** or **Until I resume** and click **Pause working**. While paused you won't get new jobs. Jobs you already have stay with you.",
          },
          {
            type: "p",
            text: "Timed pauses end on their own. To come back early, click **Continue working** in Settings or on the banner at the top of Overview and the Board.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Work
  // ---------------------------------------------------------------------------
  {
    slug: "overview",
    title: "Overview",
    summary: "Your balance, active jobs, earnings, payout rate and deadlines at a glance.",
    category: "Work",
    routes: ["/creative"],
    keywords: ["dashboard", "home", "summary", "deadlines", "load score"],
    related: ["board", "earnings"],
    sections: [
      {
        heading: "What's on the page",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Token balance",
                text: "the tokens you've earned and your last balance change. **View balance** opens Balance.",
              },
              {
                term: "Active tickets",
                text: "how many jobs are in Backlog (To do), In progress and In review. **Open board** goes to the Board.",
              },
              {
                term: "Earnings",
                text: "tokens available to withdraw, pending and total requested. **Request payout** opens Withdrawals.",
              },
              {
                term: "Payout rate",
                text: "your current payout percentage, your tier, and how close you are to the next one. **View tiers** opens Settings.",
              },
              {
                term: "Upcoming deadlines",
                text: "up to five unfinished jobs with due dates, most urgent first. Click one to open it.",
              },
              {
                term: "Recent withdrawals",
                text: "your last three payout requests and their status.",
              },
            ],
          },
          {
            type: "tip",
            text: "If you haven't picked any skills yet, the page starts with a **Welcome to Brandbite!** checklist. Select your skills first so jobs can be assigned to you.",
          },
        ],
      },
    ],
  },
  {
    slug: "board",
    title: "Using the Board",
    summary:
      "Your assigned jobs by status: moving them, searching, filtering and selecting several at once.",
    category: "Work",
    routes: ["/creative/board"],
    keywords: [
      "kanban",
      "columns",
      "drag",
      "drop",
      "search",
      "filter",
      "select",
      "bulk",
      "shortcut",
    ],
    related: ["deliver-work", "handle-feedback", "ticket-details"],
    sections: [
      {
        heading: "The columns",
        blocks: [
          {
            type: "p",
            text: "Your jobs are shown in **To do**, **In progress**, **In review** and **Done**. Each card shows the title, description, due date, the ticket code, the version number, the priority, the payout and the customer.",
          },
          {
            type: "p",
            text: "Cards with a **Changes requested** badge show a snippet of the customer's feedback. Use the **Changes requested** toggle in the toolbar to show only those.",
          },
        ],
      },
      {
        heading: "Moving jobs",
        blocks: [
          {
            type: "list",
            items: [
              "**To do → In progress** to start a job.",
              "**In progress → In review** opens **Upload work** so you can send a version. The job only moves once you send it.",
              "**In review → In progress** to pull a version back if you need to change something before the customer reviews it.",
            ],
          },
          {
            type: "p",
            text: "Any other move shows **This move is not allowed** with the reason. Done jobs can't be moved: the customer controls Done.",
          },
          {
            type: "warning",
            text: "Each customer's plan limits how many of their jobs can be **In progress** at once. If you see **This company has reached its limit for active tickets in progress**, finish or send another of that customer's jobs first.",
          },
        ],
      },
      {
        heading: "Finding jobs",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Search board",
                text: "filters by ticket code, title, description, customer, project or job type. Press **/** to jump to it.",
              },
              {
                term: "Projects",
                text: "click a project in the left panel to show only its jobs. Click it again to clear the filter.",
              },
              {
                term: "Kanban / Table",
                text: "switches to a sortable list of all your jobs.",
              },
            ],
          },
        ],
      },
      {
        heading: "Selecting several jobs",
        blocks: [
          {
            type: "p",
            text: "Click **Select**, then click cards (or **Select all** in a column). The bar at the bottom lets you **Start working** on all of them at once. Press **Esc** or **Cancel** to stop selecting.",
          },
        ],
      },
      {
        heading: "The job window",
        blocks: [
          {
            type: "p",
            text: "Click a card to open it. You'll see the description, the brief attachments, every version you've sent with the customer's feedback, and the job's details and dates. **Upload work** (In progress) and **Pull back to In progress** (In review) are at the bottom.",
          },
          {
            type: "tip",
            text: "The brand guide, time tracking and comments are on the full job page. Open it from the Table view or from a notification.",
          },
        ],
      },
    ],
  },
  {
    slug: "deliver-work",
    title: "Sending work for review",
    summary: "Upload your files and send a version to the customer.",
    category: "Work",
    routes: [],
    keywords: ["upload", "deliver", "submit", "version", "revision", "files", "review", "send"],
    related: ["handle-feedback", "board"],
    sections: [
      {
        heading: "Step by step",
        blocks: [
          {
            type: "steps",
            items: [
              "On the Board, open a job that's **In progress** and click **Upload work**, or drag its card to **In review**.",
              "Drag your files onto the box, or browse for them.",
              "Click **Upload & send for review**. Keep the window open until the upload finishes.",
            ],
          },
          {
            type: "p",
            text: "The job moves to **In review**, a new version is added, and the customer is notified.",
          },
        ],
      },
      {
        heading: "Files",
        blocks: [
          {
            type: "list",
            items: [
              "Up to **10 files** per version, **4 MB each**.",
              "Images (PNG, JPG, WebP and other image types) and PDFs.",
            ],
          },
          {
            type: "p",
            text: "Files that are too large or aren't an image or PDF are refused as you add them, with a note saying why.",
          },
          {
            type: "p",
            text: "If our team has turned on notes for you, you can also add a **Note to your customer** explaining what changed.",
          },
        ],
      },
      {
        heading: "Changed your mind?",
        blocks: [
          {
            type: "p",
            text: "While the job is **In review**, open it on the Board and click **Pull back to In progress**, or drag it back. You can then send a new version.",
          },
        ],
      },
    ],
  },
  {
    slug: "handle-feedback",
    title: "Handling customer feedback",
    summary: "Read change requests, work through pin notes and mark them resolved.",
    category: "Work",
    routes: [],
    keywords: [
      "feedback",
      "changes requested",
      "pins",
      "notes",
      "annotations",
      "resolve",
      "revision",
    ],
    related: ["deliver-work", "how-work-works"],
    sections: [
      {
        heading: "When changes are requested",
        blocks: [
          {
            type: "p",
            text: "When the customer asks for changes, the job goes back to **In progress** and its card shows **Changes requested** with their feedback. The full feedback is under the version in the job window.",
          },
          {
            type: "p",
            text: "If they left pin notes on your images, you get a **Customer feedback received** notification.",
          },
        ],
      },
      {
        heading: "Resolving pin notes",
        blocks: [
          {
            type: "steps",
            items: [
              "Open the job and click an image in the version with notes.",
              "Each numbered pin marks a spot the customer wants changed. Its note is listed on the right under **Creative review**.",
              "When you've handled one, click **Mark as resolved**. The customer is notified.",
              "When every note is resolved, send your next version with **Upload work**.",
            ],
          },
          {
            type: "p",
            text: "Pins can be resolved while the job is **In progress**. Resolving can't be undone, and you don't have to resolve every pin before sending a new version.",
          },
        ],
      },
    ],
  },
  {
    slug: "ticket-details",
    title: "The job page",
    summary: "Brief, brand guide, files, version history, time tracking and comments for one job.",
    category: "Work",
    routes: ["/creative/tickets/[ticketId]"],
    keywords: ["brief", "brand guide", "time tracking", "timer", "comments", "compare", "versions"],
    related: ["deliver-work", "handle-feedback"],
    sections: [
      {
        heading: "What's on the page",
        blocks: [
          {
            type: "list",
            items: [
              { term: "Brief", text: "what the customer asked for." },
              {
                term: "Project & job",
                text: "the project, job type, quantity and the payout for this job.",
              },
              {
                term: "Brand guide",
                text: "the customer's logo, colours, fonts and tone of voice, when they've set them for the project.",
              },
              {
                term: "Brief attachments",
                text: "reference files from the customer.",
              },
              {
                term: "Revision history",
                text: "every version you've sent, newest first, with the customer's feedback and pin counts. With two or more versions, **Compare** shows them side by side.",
              },
            ],
          },
          {
            type: "p",
            text: "Uploading and changing status happen on the Board.",
          },
        ],
      },
      {
        heading: "Time tracking",
        blocks: [
          {
            type: "list",
            items: [
              "Click **Start timer** when you begin and **Stop** when you finish. Your logged time and the estimate are shown at the top.",
              "Only one timer runs at a time. Starting one on another job stops this one.",
              "**Delete** removes an entry after you confirm. This can't be undone.",
            ],
          },
        ],
      },
      {
        heading: "Comments",
        blocks: [
          {
            type: "p",
            text: "Use **Add a comment** to talk to the customer and the Brandbite team (up to 2000 characters). Comments can't be edited or deleted.",
          },
        ],
      },
    ],
  },
  {
    slug: "tickets-table",
    title: "The jobs table",
    summary: "A sortable list of all your jobs with status and project filters.",
    category: "Work",
    routes: ["/creative/tickets"],
    keywords: ["table", "list", "my tickets", "sort", "filter"],
    related: ["board", "ticket-details"],
    sections: [
      {
        heading: "Using the table",
        blocks: [
          {
            type: "p",
            text: "Switch to **Table** on the Board, or open **My tickets**. The cards at the top count your jobs per status.",
          },
          {
            type: "list",
            items: [
              "Filter by **Status** and **Project**.",
              "Sort by Status, Priority or Due. Due dates are red when overdue and amber within three days.",
              "Click a row to open the job page.",
            ],
          },
          {
            type: "p",
            text: "The status dropdown offers only the moves you can make from the job's current status. To send a version for review, use **Upload work** on the Board so your files go with it.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Earnings
  // ---------------------------------------------------------------------------
  {
    slug: "earnings",
    title: "How you're paid",
    summary: "When payouts happen, how they're calculated, and how payout tiers raise your rate.",
    category: "Earnings",
    routes: [],
    keywords: ["payout", "earnings", "rate", "percentage", "tier", "base rate", "tokens", "money"],
    related: ["balance", "withdrawals", "settings"],
    sections: [
      {
        heading: "When you're paid",
        blocks: [
          {
            type: "p",
            text: "Your payout is added to your balance **as soon as the customer approves** the job and it moves to Done. You're paid once per job.",
          },
        ],
      },
      {
        heading: "How much",
        blocks: [
          {
            type: "p",
            text: "Your payout is a percentage of what the customer paid for the job: the job's token cost, times its quantity, times your **payout rate**. Sometimes our team sets a fixed payout for a particular job instead.",
          },
          {
            type: "p",
            text: "Everyone starts on the **Base Rate** of 60%.",
          },
          {
            type: "p",
            text: "The payout shown on your Board cards and job pages is calculated this way at your current rate. If your rate changes before the job is approved, the amount you're paid changes with it.",
          },
        ],
      },
      {
        heading: "Payout tiers",
        blocks: [
          {
            type: "p",
            text: "Completing more jobs unlocks higher rates. Each tier needs a number of completed jobs within a time window, for example 10 jobs in 30 days. The highest tier you qualify for is used.",
          },
          {
            type: "p",
            text: "See your rate and progress in **Settings → Payout tiers** and on the **Payout rate** card on Overview.",
          },
        ],
      },
    ],
  },
  {
    slug: "balance",
    title: "Your balance",
    summary: "Your earned tokens, the token history, and exporting it.",
    category: "Earnings",
    routes: ["/creative/balance"],
    keywords: ["balance", "ledger", "history", "credits", "debits", "export", "csv"],
    related: ["earnings", "withdrawals"],
    sections: [
      {
        heading: "The cards",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Available balance",
                text: "everything you've earned minus what's been paid out to you.",
              },
              { term: "Total credits", text: "tokens you've earned." },
              { term: "Total debits", text: "tokens paid out through withdrawals." },
            ],
          },
          {
            type: "p",
            text: "Tokens in withdrawal requests that haven't been paid yet are still included in **Available balance**. The Withdrawals page shows how much you can request right now.",
          },
        ],
      },
      {
        heading: "Token activity",
        blocks: [
          {
            type: "p",
            text: "The table shows your 50 most recent movements with their date, amount and balance afterwards. The reasons you'll see:",
          },
          {
            type: "list",
            items: [
              { term: "JOB_PAYMENT", text: "your payout for an approved job." },
              { term: "WITHDRAWAL_PAID", text: "a withdrawal was paid out to you." },
            ],
          },
          {
            type: "p",
            text: "**Export CSV** downloads your activity as a spreadsheet.",
          },
        ],
      },
    ],
  },
  {
    slug: "withdrawals",
    title: "Withdrawing your earnings",
    summary: "Request a payout, what each status means, and cancelling a request.",
    category: "Earnings",
    routes: ["/creative/withdrawals"],
    keywords: [
      "withdraw",
      "payout",
      "request",
      "cash out",
      "pending",
      "approved",
      "paid",
      "rejected",
      "minimum",
    ],
    related: ["balance", "earnings"],
    sections: [
      {
        heading: "Requesting a withdrawal",
        blocks: [
          {
            type: "steps",
            items: [
              "Under **Request a withdrawal**, enter a whole number of tokens.",
              "Click **Submit withdrawal request**. It appears in your history as **Pending** and our team is notified.",
            ],
          },
          {
            type: "list",
            items: [
              "There's a **minimum** amount, shown above the field (20 tokens unless our team has changed it).",
              "You can request up to your balance, minus anything already held by Pending or Approved requests.",
            ],
          },
        ],
      },
      {
        heading: "Statuses",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Pending",
                text: "waiting for our team. The tokens are held for this request.",
              },
              {
                term: "Approved",
                text: "approved and waiting to be paid. The tokens are still held.",
              },
              {
                term: "Paid",
                text: "paid out. The tokens are now taken from your balance (**WITHDRAWAL_PAID**).",
              },
              { term: "Rejected", text: "not approved. The held tokens are released." },
            ],
          },
          {
            type: "p",
            text: "The dashboard doesn't send a notification when a status changes, so check this page. For questions about a payout, use the feedback button.",
          },
        ],
      },
      {
        heading: "Cancelling",
        blocks: [
          {
            type: "warning",
            text: "**Cancel** appears on Pending requests only. It acts immediately, with no confirmation, and the request is removed from your history.",
          },
        ],
      },
    ],
  },
  {
    slug: "portfolio",
    title: "Your portfolio",
    summary: "Every job you've completed, collected automatically from your approved work.",
    category: "Earnings",
    routes: ["/creative/portfolio"],
    keywords: ["portfolio", "completed work", "showcase", "past jobs"],
    related: ["earnings"],
    sections: [
      {
        heading: "How it works",
        blocks: [
          {
            type: "p",
            text: "Your portfolio fills itself: every job that's approved and marked Done appears here. There's nothing to add or remove by hand.",
          },
          {
            type: "list",
            items: [
              "Each card shows up to four images from the final version. Non-image files show **No preview**.",
              "Search by title, customer, project or category, or filter by category.",
              "Click a card to open the job.",
            ],
          },
          {
            type: "p",
            text: "Your portfolio is private to you.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Account
  // ---------------------------------------------------------------------------
  {
    slug: "profile",
    title: "Your profile, workload and security",
    summary:
      "Name, avatar, email, timezone, working hours, open-job cap, notifications, two-factor and devices.",
    category: "Account",
    routes: ["/creative/profile"],
    keywords: [
      "avatar",
      "name",
      "email",
      "timezone",
      "working hours",
      "cap",
      "workload",
      "two-factor",
      "2fa",
      "sessions",
      "password",
    ],
    related: ["getting-assigned", "settings"],
    sections: [
      {
        heading: "Identity and timezone",
        blocks: [
          {
            type: "list",
            items: [
              "Change your **Full name** and click **Save name**.",
              "**Upload avatar** accepts PNG, JPEG, WebP or GIF up to 2 MB.",
              "To change your email, enter the new one, click **Change email**, and open the link we send to the new address.",
              "Pick your **Timezone** and click **Save**, or use **Auto-detect**. Due dates and times are shown in it.",
            ],
          },
        ],
      },
      {
        heading: "Workload",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Working hours",
                text: 'a short note on when you usually work, for our team (for example "9–18 weekdays").',
              },
              {
                term: "Concurrent task cap",
                text: "the most open jobs (1 to 40) you want at once. Once you reach it, auto-assign skips you.",
              },
            ],
          },
          {
            type: "tip",
            text: "Click **Clear** to remove your cap.",
          },
        ],
      },
      {
        heading: "Notifications",
        blocks: [
          {
            type: "p",
            text: "Turn each notification type on or off for **In-app** and **Email**. Changes save instantly. Sign-in and security emails are always sent.",
          },
        ],
      },
      {
        heading: "Two-factor authentication",
        blocks: [
          {
            type: "steps",
            items: [
              "Enter your current password and click **Set up**.",
              "Scan the QR code with an authenticator app, or paste the secret.",
              "Enter the code and click **Confirm and enable**.",
              "Save your backup codes. They're shown **only once**.",
            ],
          },
          {
            type: "p",
            text: "With two-factor on, you need a code at every sign-in and email sign-in links can't be used. To turn it off, click **Disable** and confirm with your password.",
          },
        ],
      },
      {
        heading: "Signed-in devices and password",
        blocks: [
          {
            type: "list",
            items: [
              "**Active sessions** lists every browser you're signed in on. Sign one out, or click **Sign out everywhere else**.",
              "To change your password, sign out and use **Forgot password?** on the sign-in page.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "settings",
    title: "Settings",
    summary:
      "Availability, skills, payout tiers, notification preferences and deleting your account.",
    category: "Account",
    routes: ["/creative/settings"],
    keywords: ["availability", "pause", "skills", "job types", "payout tiers", "delete account"],
    related: ["getting-assigned", "earnings", "profile"],
    sections: [
      {
        heading: "Availability",
        blocks: [
          {
            type: "p",
            text: "Pause new assignments for **1 hour**, **7 days** or **Until I resume**, then click **Pause working**. Your current jobs aren't affected. Click **Continue working** to come back.",
          },
        ],
      },
      {
        heading: "Skills & expertise",
        blocks: [
          {
            type: "p",
            text: "Tick the job types you can handle. Each change saves right away. You're only auto-assigned jobs that match your skills.",
          },
        ],
      },
      {
        heading: "Payout tiers",
        blocks: [
          {
            type: "p",
            text: "Shows your current rate, every tier with what it needs, and your progress. Tiers you qualify for are marked **Active**.",
          },
        ],
      },
      {
        heading: "Notification preferences",
        blocks: [
          {
            type: "p",
            text: "Turn in-app notifications on or off for customer feedback, new assignments, status changes and completed jobs. For email notifications, use your **Profile**.",
          },
        ],
      },
      {
        heading: "Deleting your account",
        blocks: [
          {
            type: "warning",
            text: "**Delete my account** is permanent. Type your email to confirm. You can't delete while you still have open jobs or a withdrawal that hasn't been paid, so finish those first (or ask us to reassign a job). Withdraw any remaining balance before you go: there's no way back afterwards.",
          },
        ],
      },
    ],
  },
];
