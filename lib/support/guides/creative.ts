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
    summary: "What the sidebar and top bar are for, and where to find help.",
    category: "Getting started",
    routes: ["/creative/support"],
    keywords: [
      "navigation",
      "sidebar",
      "menu",
      "start",
      "help",
      "search",
      "top bar",
      "account menu",
      "sign out",
      "theme",
    ],
    related: ["how-work-works", "getting-assigned"],
    sections: [
      {
        heading: "The sidebar",
        blocks: [
          {
            type: "p",
            text: "Everything in your dashboard is reached from the sidebar on the left. It is grouped into three sections:",
          },
          {
            type: "list",
            items: [
              {
                term: "Workspace",
                text: "your day-to-day work: **Overview**, the **Board** with the jobs assigned to you, your **Portfolio** of completed jobs, and **Color Studio**. Color Studio opens our public color tools; use **Go to dashboard** at the top of the page to come back.",
              },
              {
                term: "Earnings",
                text: "your **Balance** of earned tokens, and **Withdrawals** for requesting payouts.",
              },
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
        heading: "The top bar",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Search workspace",
                text: "jumps to any page in your dashboard. Click it, or press **Ctrl K** (**⌘K** on a Mac).",
              },
              {
                term: "Help",
                text: "opens the Support guide for the page you are on, or this Support home if the page has no guide yet.",
              },
              {
                term: "Bell",
                text: "your notifications. The number shows how many are unread.",
              },
              {
                term: "Account menu",
                text: "click your avatar for **Profile**, **Settings**, **Theme** (light, dark or system) and **Sign out**. The same menu is at the bottom of the sidebar.",
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
            text: "On the Support page you can search these guides or browse them by topic. If that doesn't help, use the **feedback** button in the bottom-right corner of any page and pick **I'm not sure how this works**. Our team reads every message and the page you were on is attached automatically.",
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
                term: "Backlog",
                text: "the job has been assigned to you and is waiting to be started.",
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
              "A job is assigned to you and appears in **Backlog**. You get a **New ticket assigned** notification.",
              "Read the brief, then drag it to **In progress**, or click **Start work** on the job page.",
              "When a version is ready, send it with **Upload work** on the Board or **Send for review** on the job page. The job moves to **In review**.",
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
              "have fewer open jobs (Backlog, In progress and In review) than their **Concurrent task cap**, if they set one.",
            ],
          },
          {
            type: "p",
            text: "Among those, the creative with the lightest current workload gets the job. Ties go to the creative with the better customer ratings. If nobody qualifies, our team assigns the job by hand.",
          },
          {
            type: "p",
            text: "There's no accept or decline step: assigned jobs appear on your Board in **Backlog**.",
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
                text: "the tokens you've earned and your last activity. **View balance** opens Balance.",
              },
              {
                term: "Active jobs",
                text: "how many jobs are in Backlog, In progress and In review. **Open board** goes to the Board.",
              },
              {
                term: "Available to request",
                text: "tokens you can withdraw now, with what's held and requested. **Request payout** opens Withdrawals.",
              },
              {
                term: "Current payout rate",
                text: "your current payout percentage, your tier, and how close you are to the next one. **View tiers** opens Settings.",
              },
              {
                term: "Workflow and Priority breakdown",
                text: "all your jobs by status and by priority.",
              },
              {
                term: "Your next jobs",
                text: "up to five unfinished jobs with due dates, soonest first. Filter by status, or click a title to open it.",
              },
              {
                term: "Load score",
                text: "how heavy your open jobs are, weighted by priority and token cost.",
              },
              {
                term: "Recent withdrawals",
                text: "your last three payout requests and their status.",
              },
            ],
          },
          {
            type: "tip",
            text: "If you haven't picked any skills yet, the page starts with a **Welcome to brandbite!** checklist. Select your skills first so jobs can be assigned to you.",
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
            text: "Your jobs are shown in **Backlog**, **In progress**, **In review** and **Done**. Each card shows the ticket code, the priority, the title, the customer, a short description, the version number, the payout and the due date.",
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
              "**Backlog → In progress** to start a job.",
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
                term: "All projects",
                text: "pick a project in this dropdown to show only its jobs.",
              },
              {
                term: "Kanban / Table",
                text: "switches to **My jobs**, a sortable list of all your jobs.",
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
            text: "Click **Select**, then click cards (or **Select all** in a column). Depending on what you picked, the bar at the bottom lets you **Start working** on them or **Move to Backlog**. Press **Esc** or **Cancel** to stop selecting.",
          },
        ],
      },
      {
        heading: "The job window",
        blocks: [
          {
            type: "p",
            text: "Click a card or **Open job** to open it. The tabs show the **Current version**, the **Brief & files**, all **Versions** with the customer's feedback, and **Comments**. The job's details and dates are on the side. **Upload work** (In progress) and **Pull back to In progress** (In review) are at the bottom.",
          },
          {
            type: "tip",
            text: "The brand guide and time tracking are on the full job page. Use **Open full page** in the job window.",
          },
        ],
      },
    ],
  },
  {
    slug: "deliver-work",
    title: "Sending work for review",
    summary:
      "Upload your files and send a version to the customer, from the Board or the job page.",
    category: "Work",
    routes: [],
    keywords: ["upload", "deliver", "submit", "version", "revision", "files", "review", "send"],
    related: ["handle-feedback", "board"],
    sections: [
      {
        heading: "From the Board",
        blocks: [
          {
            type: "steps",
            items: [
              "Open a job that's **In progress** and click **Upload work**, or drag its card to **In review**.",
              "Drag your files onto the box, or click **Browse files**.",
              "Click **Upload & send for review**. Keep the window open until the upload finishes.",
            ],
          },
        ],
      },
      {
        heading: "From the job page",
        blocks: [
          {
            type: "steps",
            items: [
              "Open a job that's **In progress**. **Upload new version** is on the **Delivery & feedback** tab.",
              "Add at least one file by dragging it onto the box or clicking **Browse files**.",
              "Click **Send for review**.",
            ],
          },
          {
            type: "p",
            text: "Either way, the job moves to **In review**, a new version is added, and the customer is notified.",
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
            text: "While the job is **In review**, click **Pull back to In progress** on the job page or in the Board's job window, or drag it back on the Board. You can then send a new version.",
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
            text: "When the customer asks for changes, the job goes back to **In progress** and its card shows **Changes requested** with their feedback. The full feedback is shown with the version when you open the job.",
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
              "When you're ready, send your next version with **Upload work** on the Board or **Send for review** on the job page.",
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
    summary: "Delivery, brief, brand guide, time tracking and comments for one job.",
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
              {
                term: "Delivery & feedback",
                text: "every version you've sent, newest first, with the customer's feedback and pin notes. With two or more versions, **Compare versions** shows them side by side.",
              },
              {
                term: "Brief & files",
                text: "what the customer asked for, their reference files and, when they've set it for the project, the **Brand guide**.",
              },
              { term: "Time tracking", text: "your time entries for this job." },
              { term: "Comments", text: "your conversation with the customer." },
              {
                term: "Activity",
                text: "what happened on this job and when, newest first. Older jobs may show only part of their history.",
              },
              {
                term: "Job summary",
                text: "the project, job type, payout, people and dates, always on the side.",
              },
            ],
          },
        ],
      },
      {
        heading: "Moving the job",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Start work",
                text: "at the top of the page while the job is in Backlog. It moves the job to **In progress**.",
              },
              {
                term: "Upload new version",
                text: "on the **Delivery & feedback** tab while the job is In progress. **Send for review** needs at least one file (up to 10).",
              },
              {
                term: "Pull back to In progress",
                text: "at the top of the page while the job is In review.",
              },
            ],
          },
        ],
      },
      {
        heading: "Time tracking",
        blocks: [
          {
            type: "list",
            items: [
              "**Start timer** and **Stop timer** are at the top of the page, with your logged time and the estimate.",
              "Only one timer runs at a time. Starting one on another job stops this one.",
              "On the **Time tracking** tab, **Delete** removes an entry after you confirm. This can't be undone.",
            ],
          },
        ],
      },
      {
        heading: "Comments",
        blocks: [
          {
            type: "p",
            text: "Use the **Comments** tab to talk to the customer and the brandbite team (up to 2000 characters). Comments can't be edited or deleted.",
          },
        ],
      },
    ],
  },
  {
    slug: "tickets-table",
    title: "The jobs table",
    summary: "A sortable list of all your jobs with status and project filters and search.",
    category: "Work",
    routes: ["/creative/tickets"],
    keywords: ["table", "list", "my jobs", "my tickets", "sort", "filter", "search"],
    related: ["board", "ticket-details"],
    sections: [
      {
        heading: "Using the table",
        blocks: [
          {
            type: "p",
            text: "Switch to **Table** on the Board to open **My jobs**. The cards at the top count your jobs per status: click one to filter by it.",
          },
          {
            type: "list",
            items: [
              "Search by job, project or customer, and filter by **Project**.",
              "Sort by Status, Priority or Due. Due dates are red when overdue and amber within three days.",
              "Click a row or **Open job** to open the job page.",
            ],
          },
          {
            type: "p",
            text: "The status dropdown offers only the moves you can make from the job's current status, including moving a job from In progress back to Backlog. To send a version for review, open the job so your files go with it.",
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
            text: "Everyone starts on the **Base rate** of 60%.",
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
            text: "See your rate and progress in **Settings → Payout tiers** and on the **Current payout rate** card on Overview.",
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
                term: "Token balance",
                text: "everything you've earned minus what's been paid out to you.",
              },
              { term: "Total credits", text: "tokens you've earned." },
              { term: "Total debits", text: "tokens paid out through withdrawals." },
            ],
          },
          {
            type: "p",
            text: "Tokens in withdrawal requests that haven't been paid yet are still included in **Token balance**. **Available to request** on the Withdrawals page shows how much you can request right now.",
          },
        ],
      },
      {
        heading: "Recent token activity",
        blocks: [
          {
            type: "p",
            text: "The table shows your 50 most recent movements with their date, amount, reason, notes and balance afterwards. Use **All / Credits / Debits** or **Search activity** to narrow it. The reasons you'll see:",
          },
          {
            type: "list",
            items: [
              { term: "Job payment", text: "your payout for an approved job." },
              { term: "Withdrawal paid", text: "a withdrawal was paid out to you." },
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
              "You can request up to **Available to request**: your balance, minus anything already held by Pending or Approved requests.",
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
                text: "paid out. The tokens are now taken from your balance (**Withdrawal paid**).",
              },
              { term: "Rejected", text: "not approved. The held tokens are released." },
            ],
          },
          {
            type: "p",
            text: "You get a notification (and an email) when a request is approved, rejected or paid. You can turn these off under **Withdrawal updates** in **Settings → Notifications** or your Profile. For questions about a payout, use the feedback button.",
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
              "Each job shows the first image from its final version, with **+N more** when there are others. Non-image files show **No preview**.",
              "Search by title, company, project or category, filter by category, and switch between **Grid** and **List**.",
              "Click a job to open it.",
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
        heading: "The tabs",
        blocks: [
          {
            type: "list",
            items: [
              { term: "Personal details", text: "your name, avatar, email and timezone." },
              { term: "Workload", text: "your working hours and open-job cap." },
              { term: "Notifications", text: "what you're notified about, in-app and by email." },
              { term: "Security", text: "two-factor authentication." },
              { term: "Sessions", text: "the browsers you're signed in on." },
              { term: "Account management", text: "**Delete my account**. See **Settings**." },
            ],
          },
          {
            type: "p",
            text: "Until you've added your name, working hours and skills, the **Setup checklist** beside the tabs shows what's left.",
          },
        ],
      },
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
              "Click **Set up two-factor**, enter your current password and click **Continue**.",
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
      "Skills, availability, payout tiers, notification preferences and deleting your account.",
    category: "Account",
    routes: ["/creative/settings"],
    keywords: ["availability", "pause", "skills", "job types", "payout tiers", "delete account"],
    related: ["getting-assigned", "earnings", "profile"],
    sections: [
      {
        heading: "Skills & expertise",
        blocks: [
          {
            type: "p",
            text: "Tick the job types you can handle. Use the search, the category filter and **Selected only** to find them. Each change saves right away. You're only auto-assigned jobs that match your skills.",
          },
        ],
      },
      {
        heading: "Availability",
        blocks: [
          {
            type: "p",
            text: "On the **Availability** tab, pause new assignments for **1 hour**, **7 days** or **Until I resume**, then click **Pause working**. Your current jobs aren't affected. Click **Continue working** to come back: it's also at the top of the other tabs while you're paused.",
          },
        ],
      },
      {
        heading: "Payout tiers",
        blocks: [
          {
            type: "p",
            text: "Shows your current rate, the base rate, every tier with what it needs, and your progress. Tiers you qualify for are marked **Active**.",
          },
        ],
      },
      {
        heading: "Notifications",
        blocks: [
          {
            type: "p",
            text: "Turn each notification type on or off for **In-app** and **Email**. Changes save instantly, and they're the same choices as under your **Profile**.",
          },
        ],
      },
      {
        heading: "Deleting your account",
        blocks: [
          {
            type: "warning",
            text: "**Delete my account**, on the **Account management** tab, is permanent. Type your email to confirm. You can't delete while you still have open jobs or a withdrawal that hasn't been paid, so finish those first (or ask us to reassign a job). Withdraw any remaining balance before you go: there's no way back afterwards.",
          },
        ],
      },
    ],
  },
];
