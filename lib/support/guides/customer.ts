// -----------------------------------------------------------------------------
// @file: lib/support/guides/customer.ts
// @purpose: Support guides for the customer dashboard (/customer/**).
//           Written from the page code (Nov 2026). Keep in sync with
//           CUSTOMER_NAV and the pages they describe — when a customer page
//           changes, update its guide in the same PR.
//
//           Deliberately NOT documented (flagged off — update the guide when
//           that changes): Tags (TAGS_ENABLED, off by default) and "Work with
//           AI" tickets (AI_TICKETS_MODE).
// -----------------------------------------------------------------------------

import type { SupportGuide } from "../types";

export const CUSTOMER_GUIDES: SupportGuide[] = [
  // ---------------------------------------------------------------------------
  // Getting started
  // ---------------------------------------------------------------------------
  {
    slug: "getting-around",
    title: "Getting around your dashboard",
    summary: "What the sidebar and top bar are for, and where to find help.",
    category: "Getting started",
    routes: ["/customer/support"],
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
    related: ["how-requests-work", "roles-and-permissions"],
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
                text: "your day-to-day work: **Overview**, the **Board** with all your requests, **Moodboards**, **AI Tools** and **Color Studio**. Color Studio opens our public color tools; use **Go to dashboard** at the top of the page to come back.",
              },
              {
                term: "Billing",
                text: "the **Services** you can request, your **Tokens** balance and history, and **Consultation** bookings.",
              },
              {
                term: "Account",
                text: "your **Profile**, your company's **Members**, **Settings**, the **FAQ** and this **Support** section.",
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
    slug: "how-requests-work",
    title: "How requests and tokens work",
    summary: "The life of a request from Backlog to Done, and when tokens are spent or refunded.",
    category: "Getting started",
    routes: [],
    keywords: ["status", "workflow", "lifecycle", "ticket", "cost", "charge", "refund", "backlog"],
    related: ["create-request", "review-and-approve", "tokens"],
    sections: [
      {
        heading: "The four statuses",
        blocks: [
          {
            type: "p",
            text: "Every request moves through four statuses. You see them as the four columns of your Board:",
          },
          {
            type: "list",
            items: [
              {
                term: "Backlog",
                text: "your request is waiting for a creative. While it is here you can still edit it, add brief files, or cancel it for a full refund.",
              },
              {
                term: "In progress",
                text: "a creative has picked it up and is working on it. Only the creative moves it on from here.",
              },
              {
                term: "In review",
                text: "the creative has sent a version for you to check. This is where you either approve it or ask for changes.",
              },
              {
                term: "Done",
                text: "you approved the work. Done is final. If something is off later, create a new request.",
              },
            ],
          },
        ],
      },
      {
        heading: "When tokens are spent",
        blocks: [
          {
            type: "list",
            items: [
              "Tokens are deducted **when you create the request**: the service's token cost, multiplied by the quantity if the service has one.",
              "Approving a request costs nothing extra. It releases payment to your creative.",
              "Asking for changes is free. You can send work back as many times as you need.",
              "If you change the service of a request while it is still in **Backlog**, the difference is charged or refunded automatically.",
            ],
          },
        ],
      },
      {
        heading: "Getting tokens back",
        blocks: [
          {
            type: "p",
            text: "A request can be cancelled for a **full refund** while it is in **Backlog** and no creative has been assigned yet. Only company Owners and Project managers can cancel. Once a creative has started, cancelling is no longer possible from the dashboard, so contact us through the feedback button instead.",
          },
        ],
      },
    ],
  },
  {
    slug: "roles-and-permissions",
    title: "Company roles and what they can do",
    summary:
      "Owner, Project manager, Member and Billing manager, and what each role is allowed to do.",
    category: "Getting started",
    routes: [],
    keywords: [
      "owner",
      "pm",
      "project manager",
      "member",
      "billing",
      "permission",
      "access",
      "role",
    ],
    related: ["members", "settings"],
    sections: [
      {
        heading: "The four roles",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Owner",
                text: "can do everything, including billing and managing other Owners. Every company always has at least one Owner.",
              },
              {
                term: "Project manager",
                text: "runs the work: creates and approves requests, manages projects and members, books consultations. Cannot change the plan or buy tokens, and cannot change or remove Owners.",
              },
              {
                term: "Member",
                text: "creates requests, edits them while in Backlog, asks for changes and works on moodboards. Cannot approve requests as Done, cancel them, or manage projects.",
              },
              {
                term: "Billing manager",
                text: "looks after the plan and token purchases. Can see the board, requests and token history, but cannot create, edit or move requests.",
              },
            ],
          },
          {
            type: "tip",
            text: 'Your own role is shown on the **Overview** page ("You are browsing as …") and in **Settings → Workspace access** under **Company role**.',
          },
        ],
      },
      {
        heading: "Who can do what",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Create and edit requests, ask for changes",
                text: "Owner, Project manager, Member.",
              },
              {
                term: "Approve a request as Done",
                text: "Owner, Project manager.",
              },
              {
                term: "Cancel a request for a refund",
                text: "Owner, Project manager (only in Backlog, before a creative is assigned).",
              },
              {
                term: "Create, rename and delete projects; edit a project's brand guide",
                text: "Owner, Project manager.",
              },
              {
                term: "Invite people, change roles, remove members",
                text: "Owner, Project manager. Only Owners can make someone an Owner or change another Owner.",
              },
              {
                term: "Edit company name and website",
                text: "Owner, Project manager.",
              },
              {
                term: "Book a consultation",
                text: "Owner, Project manager.",
              },
              {
                term: "Change plan, buy token top-ups",
                text: "Owner, Billing manager.",
              },
              {
                term: "View the board, requests and token history",
                text: "everyone.",
              },
            ],
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Workspace
  // ---------------------------------------------------------------------------
  {
    slug: "overview",
    title: "Overview",
    summary: "Your balance, open work, upcoming deadlines and plan at a glance.",
    category: "Workspace",
    routes: ["/customer"],
    keywords: ["dashboard", "home", "summary", "deadlines", "due"],
    related: ["board", "tokens"],
    sections: [
      {
        heading: "What's on the page",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Token balance",
                text: "tokens available right now. **View ledger** opens the Tokens page.",
              },
              {
                term: "Open requests",
                text: "how many requests aren't Done yet. **Open board** takes you to the Board.",
              },
              {
                term: "Completed",
                text: "requests marked Done and your completion rate.",
              },
              {
                term: "Token activity and Workflow",
                text: "your credits and debits, and how many requests are in each status.",
              },
              {
                term: "Needs your review",
                text: "appears when work is In review. **Review request** opens the first one.",
              },
              {
                term: "Keep your source files in your own storage",
                text: "appears until your company connects Google Drive or Dropbox, so source files land in your own storage instead of being deleted from brandbite 90 days after a request is done. Owners and Project managers can connect from it; **Not now** hides it for 30 days. If a connection breaks, it asks you to reconnect.",
              },
              {
                term: "Upcoming requests",
                text: "the five most urgent open requests that have a due date. Overdue ones are red. Click a title to open it.",
              },
              {
                term: "Company and Plan",
                text: "your member, project and request counts, and your plan's monthly tokens and price. If you can change the plan, **Manage plan** goes to Settings.",
              },
            ],
          },
          {
            type: "p",
            text: "Owners, Project managers and Members also see a **+ New request** button at the top.",
          },
        ],
      },
    ],
  },
  {
    slug: "board",
    title: "Using the Board",
    summary: "See every request by status, filter them, search, and approve work by dragging.",
    category: "Workspace",
    routes: ["/customer/board"],
    keywords: ["kanban", "columns", "drag", "drop", "search", "filter", "share", "shortcut"],
    related: ["review-and-approve", "projects", "requests-table"],
    sections: [
      {
        heading: "The columns",
        blocks: [
          {
            type: "p",
            text: "The Board shows all your requests in four columns: **Backlog**, **In progress**, **In review** and **Done**. Inside each column, cards are sorted by priority (Urgent first), then oldest first. You can't reorder cards by hand.",
          },
          { type: "figure", caption: "Your Board with its four columns" },
          {
            type: "p",
            text: "Each card shows the request code, the priority, the title, a short description, a thumbnail, the due date (red when overdue) and a green **Assigned** badge once a creative has picked it up.",
          },
        ],
      },
      {
        heading: "Finding requests",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Search requests",
                text: "filters cards by request code, title or description. Press **/** anywhere on the Board to jump to the search box.",
              },
              {
                term: "All projects",
                text: "pick a project in this dropdown to show only its requests. The **…** button beside it holds the project actions: see **Projects and brand guides**.",
              },
              {
                term: "All priorities",
                text: "shows only one priority.",
              },
              {
                term: "Filter",
                text: "opens more options, such as **Assignment** (assigned or unassigned). **Clear filters** removes everything you've set.",
              },
              {
                term: "Share",
                text: "copies the Board's link to your clipboard.",
              },
              {
                term: "Kanban / List",
                text: "switches between the Board and **My requests**, a sortable list of all requests.",
              },
            ],
          },
        ],
      },
      {
        heading: "Opening a request",
        blocks: [
          {
            type: "p",
            text: "Click a card to open it in a large window with **Current version**, **Brief & files**, **Versions** and **Comments** tabs. There you can look at every version the creative sent, add pin notes on images, download files and, while it is In review, approve it or request a revision. **Open full page** takes you to the request page. When work is waiting, **Needs your review** at the top of the Board has a **Review request** button.",
          },
        ],
      },
      {
        heading: "Approving by drag and drop",
        blocks: [
          {
            type: "p",
            text: "Only cards in **In review** can be dragged. Columns you can drop into light up with **Drop here**:",
          },
          {
            type: "list",
            items: [
              "Drop on **Done** to approve. A window asks you to confirm.",
              "Drop on **In progress** to request a revision. A window asks for a message for your creative.",
            ],
          },
          {
            type: "p",
            text: "Any other move shows **This move is not allowed** with the reason. New requests can only be picked up by a creative, and Done is final.",
          },
        ],
      },
      {
        heading: "Creating from the Board",
        blocks: [
          {
            type: "p",
            text: "Use **New request** at the top of the Board. The form is the same as on the new request page and the request lands in **Backlog**.",
          },
        ],
      },
    ],
  },
  {
    slug: "create-request",
    title: "Creating a request",
    summary:
      "Every field on the new request form, what it costs, and attaching files and moodboards.",
    category: "Workspace",
    routes: ["/customer/tickets/new"],
    keywords: [
      "new ticket",
      "brief",
      "job type",
      "service",
      "attachments",
      "upload",
      "due date",
      "priority",
      "fill with ai",
    ],
    related: ["how-requests-work", "services", "moodboards"],
    sections: [
      {
        heading: "Step by step",
        blocks: [
          {
            type: "steps",
            items: [
              "Click **+ New request** on Overview or **My requests**, **New request** on the Board, or **Create request** on a service in **Services**.",
              "Write a **Title**. This is the line your creative sees on the board.",
              "Describe what you need in the **Brief**: links, context and requirements.",
              "Pick a **Service** with **Choose a service…**. Search or browse by category, click a service, then press **Select**.",
              "Optionally set **Priority**, **Due date**, **Project**, attach files or a moodboard.",
              "Check the **Cost summary**, then click **Create request**.",
            ],
          },
          { type: "figure", caption: "The new request form" },
        ],
      },
      {
        heading: "Saving a draft",
        blocks: [
          {
            type: "p",
            text: "Once you start writing, your request saves itself as a draft every few seconds, along with its files. You can also click **Save as draft**. A draft costs no tokens and nobody works on it until you create the request.",
          },
          {
            type: "p",
            text: "Open **Drafts** next to **New request** to carry on with one or delete it. Others in your company don't see your drafts. The brandbite team can. A draft stays until you create the request or delete it yourself.",
          },
          {
            type: "p",
            text: "If your balance is too low, **top up your balance** saves your draft first. The billing page then offers **Continue your request** to bring you back to it.",
          },
        ],
      },
      {
        heading: "The fields",
        blocks: [
          {
            type: "list",
            items: [
              { term: "Title", text: "required." },
              {
                term: "Brief",
                text: "optional, with basic formatting. The more context, the fewer rounds of changes.",
              },
              {
                term: "Brief attachments",
                text: "up to **8 files**, **4 MB each**: images, PDF, DOC, DOCX or TXT. They upload right after the request is created.",
              },
              {
                term: "Priority",
                text: "Low, Medium (default), High or Urgent. Higher priority requests are more likely to be picked up first.",
              },
              {
                term: "Due date",
                text: "optional, from today up to two years ahead.",
              },
              {
                term: "Project",
                text: "optional. Groups related requests and lets you filter the Board.",
              },
              {
                term: "Service",
                text: "required. Sets the token cost. Some services also have a **quantity** (1 to 10), which multiplies the cost.",
              },
              {
                term: "Attach moodboard",
                text: "optional. Appears once your company has a moodboard, and shares it with your creative.",
              },
            ],
          },
        ],
      },
      {
        heading: "Cost and balance",
        blocks: [
          {
            type: "p",
            text: "**Cost summary** shows your **Current balance**, the **Cost** and what's **Remaining after**. The cost is deducted as soon as you click **Create request**.",
          },
          {
            type: "p",
            text: "If your balance is too low, the button is disabled and you are pointed to Settings to top up. Only Owners and Billing managers can buy tokens.",
          },
        ],
      },
      {
        heading: "Fill with AI",
        blocks: [
          {
            type: "p",
            text: "**✨ Fill with AI** above the brief lets you paste a rough description (at least 10 characters). It fills in the title, brief, service and priority for you to check and adjust before submitting.",
          },
          {
            type: "warning",
            text: "Fill with AI uses tokens from your balance (1 token by default).",
          },
        ],
      },
    ],
  },
  {
    slug: "review-and-approve",
    title: "Reviewing work, asking for changes and approving",
    summary:
      "Check a version, leave pin notes, send it back with feedback, or approve and download the final files.",
    category: "Workspace",
    routes: ["/customer/tickets/[ticketId]"],
    keywords: [
      "review",
      "revision",
      "feedback",
      "changes",
      "pin",
      "annotation",
      "approve",
      "done",
      "download",
      "rating",
      "compare",
      "comment",
      "edit",
      "cancel",
    ],
    related: ["how-requests-work", "board"],
    sections: [
      {
        heading: "When work is ready",
        blocks: [
          {
            type: "p",
            text: "When your creative sends a version, the request moves to **In review** and the person who created it gets a notification. Open it from the Board, **My requests**, the notification or the email.",
          },
          {
            type: "p",
            text: "Every version is kept. **Current version** shows the newest and the **Versions** tab lists them all. With two or more versions, **Compare versions** on the full request page shows them side by side.",
          },
        ],
      },
      {
        heading: "Pin notes on images",
        blocks: [
          {
            type: "steps",
            items: [
              "Open the request and click an image in the current version.",
              "Click anywhere on the image to drop a numbered pin, and write what should change there.",
              "Add as many pins as you need. Use the arrow keys to move between images.",
              "Click **Send all notes**. The request goes back to **In progress** with your notes.",
            ],
          },
          { type: "figure", caption: "A pinned note on a design" },
          {
            type: "tip",
            text: "Your creative marks each pin as resolved as they work through it, and you are notified.",
          },
        ],
      },
      {
        heading: "Asking for changes",
        blocks: [
          {
            type: "steps",
            items: [
              "While the request is **In review**, click **Request revision**, or drag the card to **In progress** on the Board.",
              "Write a message for your creative. It's required.",
              "Click **Send back to creative**. The request moves back to **In progress**.",
            ],
          },
          {
            type: "p",
            text: "Asking for changes is free and there is no limit on rounds.",
          },
        ],
      },
      {
        heading: "Approving",
        blocks: [
          {
            type: "steps",
            items: [
              "Click **Approve & complete**, or drag the card to **Done** on the Board.",
              "Check the final files in the window. You can download them from here.",
              "Confirm in the window. Your creative is paid for the request and it moves to **Done**.",
              "Rate the request on Quality, Communication and Speed, or **Skip**. Notes in the rating are for our team, not shared with the creative.",
            ],
          },
          {
            type: "warning",
            text: "Done is final. If you need more changes afterwards, create a new request. Only Owners and Project managers can approve.",
          },
        ],
      },
      {
        heading: "Downloading files",
        blocks: [
          {
            type: "list",
            items: [
              "Every image and file in the viewer has its own **Download** button.",
              "**Download all** zips every file in a version or brief (shown when there are two or more files).",
              "On a Done request, the Board window has **Download final work**.",
            ],
          },
        ],
      },
      {
        heading: "Source files",
        blocks: [
          {
            type: "p",
            text: "Layered and print-ready files (PSD, AI, INDD, video projects and more) are under **Source files** on the request page.",
          },
          {
            type: "list",
            items: [
              {
                term: "Google Drive connected",
                text: "they go straight into your Drive, in **brandbite › project › request**, and stay yours for good. **Open in Drive** opens one.",
              },
              {
                term: "Dropbox connected",
                text: "files up to 150 MB go straight into **Apps › brandbite › project › request** in your Dropbox. **Open in Dropbox** opens one. Bigger files are kept on brandbite (below).",
              },
              {
                term: "Neither connected",
                text: "they're kept on brandbite for **90 days after the request is done**, then deleted. **Download** saves one; each file shows the date it's kept until.",
              },
              "We remind you by email and in the bell 14 days and 3 days before files are deleted.",
              "Connect Google Drive or Dropbox under **Settings › Integrations** so new source files land in your own storage. When both are connected, Google Drive is used.",
            ],
          },
        ],
      },
      {
        heading: "Editing, cancelling and comments",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Edit request",
                text: "change the title, brief, priority, project, service or due date while the request is in **Backlog**.",
              },
              {
                term: "Add files",
                text: "add brief attachments on the **Brief & files** tab while the request is in **Backlog**.",
              },
              {
                term: "Cancel & refund",
                text: "Owners and Project managers can cancel a request in **Backlog** that no creative has picked up yet. The full token cost is returned. This can't be undone.",
              },
              {
                term: "Comments",
                text: "on the **Comments** tab you can leave comments for your team and the creative. Comments can't be edited or deleted.",
              },
              {
                term: "Activity",
                text: "on the full request page, the **Activity** tab lists what happened and when, newest first. Older requests may show only part of their history.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "requests-table",
    title: "The requests table",
    summary: "A sortable, filterable list of every request, with paging.",
    category: "Workspace",
    routes: ["/customer/tickets"],
    keywords: [
      "table",
      "list",
      "my requests",
      "my tickets",
      "sort",
      "filter",
      "search",
      "pagination",
    ],
    related: ["board", "review-and-approve"],
    sections: [
      {
        heading: "Using the table",
        blocks: [
          {
            type: "p",
            text: "Switch to **List** at the top of the Board to open **My requests**. It lists every request, 50 per page.",
          },
          {
            type: "list",
            items: [
              {
                term: "Search",
                text: "matches the title, project name or service. To find a request by its code, use the Board's search.",
              },
              {
                term: "Filters",
                text: "the **Status** chips at the top, plus **Project** and **Priority** dropdowns.",
              },
              {
                term: "Sorting",
                text: "click the Status, Priority, Created or Due column headers. The newest requests are first by default.",
              },
              {
                term: "Due dates",
                text: "red when overdue, amber when due within three days.",
              },
            ],
          },
          {
            type: "p",
            text: "Click a row to open the request page.",
          },
        ],
      },
    ],
  },
  {
    slug: "projects",
    title: "Projects and brand guides",
    summary: "Group requests into projects and give creatives your brand details once per project.",
    category: "Workspace",
    routes: [],
    keywords: ["project", "brand guide", "logo", "colors", "fonts", "tone", "rename", "delete"],
    related: ["board", "create-request"],
    sections: [
      {
        heading: "Creating and using projects",
        blocks: [
          {
            type: "steps",
            items: [
              "On the Board, click the **…** button next to the project filter and choose **New project**.",
              "Enter a **Project name** (at least two characters) and click **Create project**. A short code is generated from the name.",
              "Pick the project when you create a request, then choose it in the Board's project filter to see only its requests.",
            ],
          },
          {
            type: "p",
            text: "Only Owners and Project managers can create, rename or delete projects, so only they see the **…** button.",
          },
        ],
      },
      {
        heading: "Brand guide",
        blocks: [
          {
            type: "p",
            text: "Choose the project in the Board's project filter, open the **…** menu and choose **Brand guide**. Fill it once, click **Save brand guide**, and it is shown to creatives on every request in that project:",
          },
          {
            type: "list",
            items: [
              { term: "Logo URL", text: "a link to your logo." },
              { term: "Brand colors", text: "hex values separated by commas." },
              { term: "Fonts", text: "the typefaces you use." },
              {
                term: "Voice / tone notes",
                text: "how your brand sounds (up to 2000 characters).",
              },
            ],
          },
        ],
      },
      {
        heading: "Renaming and deleting",
        blocks: [
          {
            type: "p",
            text: "With the project chosen in the filter, use **Rename** or **Delete project** in the same **…** menu.",
          },
          {
            type: "warning",
            text: "Deleting a project can't be undone. Its requests are not deleted. They move to **No project**.",
          },
        ],
      },
    ],
  },
  {
    slug: "moodboards",
    title: "Moodboards",
    summary:
      "Collect notes, images, colours, links, files, checklists and videos on a canvas and share them with creatives.",
    category: "Workspace",
    routes: ["/customer/moodboards"],
    keywords: [
      "inspiration",
      "canvas",
      "references",
      "screenshot",
      "drag and drop",
      "align",
      "section",
      "frame",
      "download",
      "export",
      "pdf",
      "note",
      "image",
      "color",
      "link",
      "video",
      "draw",
      "arrow",
    ],
    related: ["create-request"],
    sections: [
      {
        heading: "Creating a moodboard",
        blocks: [
          {
            type: "p",
            text: "Click **+ New Moodboard**. A board called **Untitled Moodboard** opens straight away. Click the title at the top to rename it.",
          },
          {
            type: "p",
            text: "Every moodboard is visible to everyone in your company. Owners, Project managers and Members can edit them.",
          },
          {
            type: "p",
            text: "The Moodboards page shows a preview of each board. Use **Search moodboards** and the sort menu to find one, then click it to open it.",
          },
        ],
      },
      {
        heading: "Adding items",
        blocks: [
          {
            type: "p",
            text: "Everything is in the toolbar at the bottom of the canvas. Drag an item out of it and drop it where you want, or click it and then click the canvas. Notes, shapes and text are ready to type on straight away.",
          },
          {
            type: "p",
            text: "You can also drag images and files from your computer onto the board, or paste a screenshot with **Ctrl/⌘ + V**. Images become pictures and everything else becomes a file, up to 10 at a time and 4 MB each.",
          },
          { type: "figure", caption: "A moodboard with images and notes" },
          {
            type: "p",
            text: "On a phone the board fills the screen. Tap an item in the toolbar and then tap the canvas. The **+** button holds images, colors, checklists, links, files and videos.",
          },
          {
            type: "list",
            items: [
              { term: "Sticky note", text: "a colored note. Pick the color when it's selected." },
              { term: "Shape", text: "a square, circle or diamond you can type on." },
              { term: "Text", text: "free text with no box around it." },
              {
                term: "Section",
                text: "a named area that groups what's inside it. Drag it by its name to move everything in it.",
              },
              { term: "Image", text: "upload an image from your device (4 MB max)." },
              { term: "Color", text: "a color swatch. Click it twice to change the hex code." },
              { term: "Checklist", text: "a list with as many items as you like." },
              {
                term: "Link",
                text: "paste a URL. Its title and description are filled in for you.",
              },
              { term: "File", text: "upload any file (4 MB max)." },
              { term: "Video", text: "paste a YouTube, Vimeo or Loom link." },
            ],
          },
          {
            type: "p",
            text: "The **Marker** opens its own options above the toolbar: marker, highlighter and eraser, with colors and sizes.",
          },
          {
            type: "p",
            text: "To connect two items, select one and drag a dot on its edge onto the other. The **Arrow** tool does the same: click the first item, then the second.",
          },
        ],
      },
      {
        heading: "Moving around",
        blocks: [
          {
            type: "list",
            items: [
              "Click an item to select it. Click it again or press **Enter** to edit it. Double-clicking does both.",
              "Drag an item from anywhere on it to move it. With an item selected, drag a corner to resize it or use the arrow keys to nudge it.",
              "While you move or resize something, it lines up with the edges and centres of nearby items and an orange guide shows where. Hold **Ctrl** (**⌘** on a Mac) to move it freely.",
              "To put something on top of or behind the rest, select it and use **Bring to front** or **Send to back** in its toolbar, or press **]** or **[**.",
              "**More → Download as PNG** or **Download as PDF** saves the whole board as a picture. Videos show as empty boxes in the download.",
              "Scroll, use the **Hand** tool, or hold **Space** and drag to move around. On a phone, drag with one finger. The canvas has no edges.",
              "Drag across the empty canvas to select several objects, or **Shift**-click them. Then move, duplicate or delete them together. On a phone, press and hold an item to start picking several, then tap others to add or remove them. Tap the empty canvas to stop.",
              "**Ctrl/⌘ + G** groups the selected items so a click picks them all and they move together; **Ctrl/⌘ + Shift + G** ungroups them. Double-click a grouped item to edit it on its own. **Lock** in the toolbar (**Ctrl/⌘ + Shift + L**) keeps an item from being moved, resized or deleted, handy for a background picture; dragging across it selects what's on top of it.",
              "**Ctrl/⌘ + Z** undoes and **Ctrl/⌘ + Shift + Z** redoes, or use the buttons at the top right. **Ctrl/⌘ + C**, **X**, **V** and **D** copy, cut, paste and duplicate.",
              "**Ctrl** + scroll (**⌘** + scroll on a Mac) or pinch to zoom, or use the zoom buttons, including **Fit to content**.",
            ],
          },
          {
            type: "p",
            text: "Shortcuts: **V** Select, **H** Hand, **S** Sticky note, **R** Shape, **T** Text, **L** Arrow, **M** Marker, **E** Eraser, **Shift** + **1** fit to content, **Ctrl** + **0** back to 100%.",
          },
        ],
      },
      {
        heading: "Comments",
        blocks: [
          {
            type: "p",
            text: "Select an item and click **Comment** in its toolbar, or open **Comments** at the top of the board. Comments stay on that item, and anyone who can see the board can reply.",
          },
          {
            type: "p",
            text: "Items with open comments show a number in their corner; click it to read them. **Resolve** closes a thread once it's sorted, and a reply opens it again. Tick **Show resolved** to see closed threads.",
          },
          {
            type: "p",
            text: "The person who made the board, and everyone else in a thread, is notified about new comments. You can delete your own comments.",
          },
        ],
      },
      {
        heading: "Deleting",
        blocks: [
          {
            type: "p",
            text: "Select a card, arrow or drawing and press **Delete**, or use its delete button. The Eraser removes drawings as you touch them.",
          },
          {
            type: "p",
            text: "After deleting a card or drawing, **Undo** appears for a few seconds, and **Ctrl** + **Z** (**⌘** + **Z** on a Mac) does the same. Only the last one can be brought back. Deleted arrows can't.",
          },
          {
            type: "p",
            text: "**More** → **Delete moodboard** removes the whole moodboard and its uploaded files after you confirm. Only the person who created it, an Owner or a Project manager can do this.",
          },
        ],
      },
      {
        heading: "Sharing with your creative",
        blocks: [
          {
            type: "p",
            text: "When you create a request, choose the moodboard under **Attach moodboard**. Your creative can then open it from the request, but can't change it. A moodboard can be attached to one request.",
          },
          {
            type: "p",
            text: "Creatives can also share their own moodboards with you, and you're notified when they do. These appear on the request and in your Moodboards list as **From your creative**, and you can look through them but not change them.",
          },
        ],
      },
    ],
  },
  {
    slug: "ai-tools",
    title: "AI Tools",
    summary:
      "Generate images and copy, remove backgrounds, upscale images and get design suggestions — paid in tokens.",
    category: "Workspace",
    routes: ["/customer/ai-tools"],
    keywords: [
      "ai",
      "image generation",
      "copy",
      "background removal",
      "upscale",
      "design suggestions",
      "dall-e",
    ],
    related: ["tokens"],
    sections: [
      {
        heading: "How it works",
        blocks: [
          {
            type: "steps",
            items: [
              "Click **Open tool** on a tool card.",
              "Fill in the fields and press the tool's button.",
              "Tokens are taken from your company balance when you press it. If the tool fails, they are refunded automatically.",
            ],
          },
          {
            type: "warning",
            text: "Everyone in your company can use AI Tools, and every use is paid from the shared company balance.",
          },
        ],
      },
      {
        heading: "The tools",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Image Generation",
                text: "describe an image and choose a style (Vivid or Natural) and size (square, portrait or landscape). 2 tokens by default.",
              },
              {
                term: "Copy Generation",
                text: "taglines, headlines, social posts, email subjects or ad copy in a tone you choose, 1 to 5 variations. 1 token by default.",
              },
              {
                term: "Background Removal",
                text: "paste an image URL and download the result as a PNG. 1 token by default.",
              },
              {
                term: "Design Suggestions",
                text: "describe your project for colour, font and layout ideas. 1 token by default.",
              },
              {
                term: "Image Upscaling",
                text: "paste an image URL and enlarge it 2× or 4×, optionally enhancing faces. 2 tokens by default.",
              },
            ],
          },
          {
            type: "p",
            text: "Background Removal and Image Upscaling work from a link to the image, not a file upload.",
          },
        ],
      },
      {
        heading: "Results and limits",
        blocks: [
          {
            type: "list",
            items: [
              "**Download** results straight away. They are not saved to your requests or files.",
              "**Recent Generations** lists your uses with their status and token cost. Filter by tool or status, and use the page buttons to see older ones.",
              "Each tool can be used a limited number of times per hour per company. If you hit the limit, wait a little and try again.",
            ],
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Billing
  // ---------------------------------------------------------------------------
  {
    slug: "services",
    title: "Services",
    summary: "Browse everything you can request and what each service costs in tokens.",
    category: "Billing",
    routes: ["/customer/services"],
    keywords: ["catalog", "job types", "price", "cost", "categories"],
    related: ["create-request", "tokens"],
    sections: [
      {
        heading: "Browsing the catalog",
        blocks: [
          {
            type: "p",
            text: "Services lists everything you can request. Choose a category to see its services, or use **Search all services** to look through all of them.",
          },
          {
            type: "p",
            text: "Each row shows the cost in tokens and, where set, the estimated effort, which isn't a delivery time. Click a row to see its details and your company balance in the panel.",
          },
        ],
      },
      {
        heading: "Requesting a service",
        blocks: [
          {
            type: "p",
            text: "Select a service and click **Create request** in its panel. The new request form opens with that service already selected. Nothing is charged until you create the request.",
          },
        ],
      },
    ],
  },
  {
    slug: "tokens",
    title: "Tokens and your token history",
    summary: "Your balance, where tokens came from and where they went.",
    category: "Billing",
    routes: ["/customer/tokens"],
    keywords: ["balance", "ledger", "credits", "debits", "history", "usage"],
    related: ["plans-and-top-ups", "how-requests-work"],
    sections: [
      {
        heading: "Your balance",
        blocks: [
          {
            type: "list",
            items: [
              { term: "Current balance", text: "what you can spend right now." },
              {
                term: "All-time credits",
                text: "every token added by plan renewals, top-ups and adjustments.",
              },
              {
                term: "All-time debits",
                text: "every token used by requests, AI tools and consultations.",
              },
            ],
          },
          { type: "figure", caption: "Your token balance" },
          {
            type: "p",
            text: "This page is for viewing only. Plans and top-ups are in **Settings**.",
          },
        ],
      },
      {
        heading: "The token ledger",
        blocks: [
          {
            type: "p",
            text: "The ledger shows all your movements, newest first, with the date, amount and reason. Use **All / Credits / Debits**, **Search ledger** or the **From** and **To** dates to narrow it, and click a row for the request code and your balance before and after. **Export CSV** downloads every movement that matches your filters, not only the page on screen. Common reasons:",
          },
          {
            type: "list",
            items: [
              { term: "Request created", text: "a request was created." },
              { term: "Refund", text: "a request was cancelled." },
              {
                term: "AI generation / AI refund",
                text: "an AI tool was used, or refunded after a failure.",
              },
              {
                term: "Consultation booking / Consultation refund",
                text: "a consultation was booked, or cancelled by our team.",
              },
              { term: "Token top-up", text: "you bought a top-up." },
              {
                term: "Subscription initial credit / Subscription renewal",
                text: "tokens from your plan.",
              },
              { term: "Adjustment", text: "a manual change by our team." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "plans-and-top-ups",
    title: "Plans, upgrades and top-ups",
    summary: "Change your subscription plan or buy extra tokens.",
    category: "Billing",
    routes: [],
    keywords: [
      "subscription",
      "plan",
      "upgrade",
      "downgrade",
      "top-up",
      "topup",
      "buy tokens",
      "stripe",
      "billing",
      "payment",
    ],
    related: ["tokens", "settings"],
    sections: [
      {
        heading: "Who can manage billing",
        blocks: [
          {
            type: "p",
            text: "Only **Owners** and **Billing managers** can start a subscription, change the plan or buy tokens. Everyone else sees the plan in **Settings → Plan & billing** with a **Limited access** note.",
          },
        ],
      },
      {
        heading: "Starting a subscription",
        blocks: [
          {
            type: "p",
            text: "If your company doesn't have a subscription yet, click **Start subscription** in **Settings → Plan & billing** and pay through Stripe. Your plan's monthly tokens are added as soon as the payment succeeds.",
          },
          {
            type: "p",
            text: "Once you're subscribed, the button goes away. Use **Switch to a different plan** to change plans. For invoices, your payment method or cancelling, contact us at the email shown there.",
          },
        ],
      },
      {
        heading: "Changing your plan",
        blocks: [
          {
            type: "steps",
            items: [
              "Go to **Settings → Plan & billing** and find **Switch to a different plan**.",
              "Each plan is marked **Upgrade** or **Downgrade** with its monthly tokens and price. Click **Preview change**.",
              "Check the preview of your next Stripe invoice, including the prorated amount.",
              "Click **Confirm switch**.",
            ],
          },
          {
            type: "p",
            text: "Stripe charges or credits the prorated difference. The new plan's monthly tokens are added when your subscription renews.",
          },
        ],
      },
      {
        heading: "Buying a top-up",
        blocks: [
          {
            type: "steps",
            items: [
              "In **Settings → Plan & billing**, find **Need more tokens now?**.",
              "Click **Buy tokens** on a pack. You are taken to Stripe to pay.",
              "The tokens are added to your balance as soon as the payment succeeds.",
            ],
          },
          {
            type: "p",
            text: "A top-up is a one-time payment and doesn't change your plan.",
          },
        ],
      },
    ],
  },
  {
    slug: "consultation",
    title: "Booking a consultation",
    summary: "Book a video call with the brandbite team, what it costs and how scheduling works.",
    category: "Billing",
    routes: ["/customer/consultation"],
    keywords: ["call", "meeting", "video", "book", "schedule", "meet"],
    related: ["tokens"],
    sections: [
      {
        heading: "Booking",
        blocks: [
          {
            type: "steps",
            items: [
              "Describe what you want to discuss (at least 10 characters). The **Quick start** buttons add starter text.",
              "Optionally pick a preferred date and a 30-minute time slot (**Suggest a time** picks one for you), and check the timezone.",
              "Click **Submit request**. The cost shown on the button is deducted straight away.",
            ],
          },
          {
            type: "p",
            text: "Only Owners and Project managers can book. Others see a note asking a teammate with one of those roles to book.",
          },
        ],
      },
      {
        heading: "Times and scheduling",
        blocks: [
          {
            type: "list",
            items: [
              "Bookings need at least 24 hours' notice and can be up to 30 days ahead, during the team's working days and hours shown under the time picker. Times that are already booked may be greyed out.",
              "When we schedule your call you get an email with the time (in your timezone) and the video link. Sometimes a slot you picked is confirmed straight away.",
              "Your requests are listed under **Your consultations**, on the **Upcoming** and **All** tabs, with their status: Awaiting scheduling, Scheduled, Completed or Canceled. You can search them or filter by status. Scheduled calls have a **Join call** link.",
            ],
          },
        ],
      },
      {
        heading: "Cancelling or rescheduling",
        blocks: [
          {
            type: "p",
            text: "There's no cancel button in the dashboard. Write to us at hello@brandbite.studio or use the feedback button. When we cancel a booking, its tokens are refunded in full and you get an email confirming it.",
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
    title: "Your profile and security",
    summary:
      "Name, avatar, email, timezone, notifications, two-factor authentication and signed-in devices.",
    category: "Account",
    routes: ["/customer/profile"],
    keywords: [
      "avatar",
      "name",
      "email",
      "timezone",
      "two-factor",
      "2fa",
      "mfa",
      "authenticator",
      "backup codes",
      "sessions",
      "devices",
      "password",
    ],
    related: ["notifications", "settings"],
    sections: [
      {
        heading: "The tabs",
        blocks: [
          {
            type: "list",
            items: [
              { term: "Personal details", text: "your name, avatar, email and timezone." },
              { term: "Notifications", text: "what you're notified about, in-app and by email." },
              { term: "Security", text: "two-factor authentication." },
              { term: "Sessions", text: "the browsers you're signed in on." },
              {
                term: "Account management",
                text: "a link to leave your workspace, and **Delete my account**. See **Settings**.",
              },
            ],
          },
        ],
      },
      {
        heading: "Name and avatar",
        blocks: [
          {
            type: "list",
            items: [
              "Your name appears on requests, comments and emails. Change it under **Full name** and click **Save name**.",
              "**Upload avatar** accepts PNG, JPEG, WebP or GIF up to 2 MB. Square images look best.",
            ],
          },
        ],
      },
      {
        heading: "Changing your email",
        blocks: [
          {
            type: "steps",
            items: [
              "Type the new address under **Email** and click **Change email**.",
              "Open the confirmation link we send to the **new** address.",
            ],
          },
          {
            type: "p",
            text: "Until you open the link, you keep signing in with your current email.",
          },
        ],
      },
      {
        heading: "Timezone",
        blocks: [
          {
            type: "p",
            text: "Due dates and notification times are shown in your timezone. Pick it and click **Save**, or use **Auto-detect**. If it isn't set, UTC is used.",
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
              "Scan the QR code with an authenticator app, or paste the secret manually.",
              "Enter the code from the app and click **Confirm and enable**.",
              "Save the backup codes somewhere safe. They are shown **only once** and each works once.",
            ],
          },
          {
            type: "p",
            text: "With two-factor on, you'll be asked for a code each time you sign in, and email sign-in links can't be used. To turn it off, click **Disable** and confirm with your password.",
          },
        ],
      },
      {
        heading: "Signed-in devices",
        blocks: [
          {
            type: "p",
            text: "**Active sessions** lists every browser you're signed in on. Click **Sign out** next to one, or **Sign out everywhere else** to end all other sessions.",
          },
        ],
      },
      {
        heading: "Password",
        blocks: [
          {
            type: "p",
            text: "To change your password, sign out and use **Forgot password?** on the sign-in page.",
          },
        ],
      },
    ],
  },
  {
    slug: "notifications",
    title: "Notifications",
    summary: "What you're notified about, and turning in-app and email notifications on or off.",
    category: "Account",
    routes: [],
    keywords: ["bell", "email", "alerts", "unread", "preferences", "mark as read"],
    related: ["profile", "settings"],
    sections: [
      {
        heading: "What you're notified about",
        blocks: [
          {
            type: "p",
            text: "Notifications go to the person who **created** the request:",
          },
          {
            type: "list",
            items: [
              "a creative submitted a new version,",
              "the request's status changed,",
              "a creative resolved one of your pin notes,",
              "the request was completed.",
            ],
          },
          {
            type: "p",
            text: "You're also told when your creative shares a moodboard on one of your requests, and when someone comments on a moodboard you made or replies in a comment thread you're in.",
          },
        ],
      },
      {
        heading: "The bell",
        blocks: [
          {
            type: "p",
            text: "Click the bell in the top bar to see your latest 20 notifications. Unread ones are bold. Click one to open its request, or **Mark all as read**.",
          },
        ],
      },
      {
        heading: "Choosing what you get",
        blocks: [
          {
            type: "p",
            text: "In **Settings → Notifications** (or the **Notifications** tab of your **Profile**), switch each type on or off for **In-app** and **Email**. Changes save instantly and apply to future notifications. Sign-in and security emails are always sent.",
          },
        ],
      },
    ],
  },
  {
    slug: "members",
    title: "Members and invitations",
    summary: "Invite teammates, change roles, and remove people from your company.",
    category: "Account",
    routes: ["/customer/members"],
    keywords: ["invite", "team", "teammate", "role", "remove", "pending", "owner"],
    related: ["roles-and-permissions", "settings"],
    sections: [
      {
        heading: "Who can manage members",
        blocks: [
          {
            type: "p",
            text: "Only **Owners** and **Project managers** can open this page. Members and Billing managers see an access message instead.",
          },
        ],
      },
      {
        heading: "Inviting someone",
        blocks: [
          {
            type: "steps",
            items: [
              "Under **Invite member**, enter their email address.",
              "Choose a role: **Member**, **Project manager** or **Billing**.",
              "Click **Send invite**. They get an email with an **Accept Invite** button.",
            ],
          },
          {
            type: "list",
            items: [
              "They must sign in with the **same email** the invite was sent to.",
              "Invites expire after **7 days**.",
              "You can't invite someone as Owner. Invite them with another role, then change it.",
            ],
          },
        ],
      },
      {
        heading: "Pending invites",
        blocks: [
          {
            type: "p",
            text: "Invites that haven't been accepted are on the **Pending invitations** tab, marked **Expired** when they have run out. There's no resend button: click **Cancel invite** and confirm, then invite the person again.",
          },
        ],
      },
      {
        heading: "Changing a role",
        blocks: [
          {
            type: "p",
            text: "Click someone's row to open their panel, pick a new role and click **Save changes**. Nothing changes until you save.",
          },
          {
            type: "list",
            items: [
              "Only Owners can make someone an Owner or change another Owner's role.",
              "Your company must always keep at least one Owner.",
            ],
          },
        ],
      },
      {
        heading: "Removing someone",
        blocks: [
          {
            type: "p",
            text: "Click their row and, in the panel, click **Remove member** and confirm. They lose access straight away. To bring them back, invite them again. The last Owner can't be removed. To remove yourself, use **Leave workspace** in Settings.",
          },
        ],
      },
    ],
  },
  {
    slug: "settings",
    title: "Settings",
    summary: "Your company details, plan, notification preferences, and leaving or deleting.",
    category: "Account",
    routes: ["/customer/settings"],
    keywords: ["company", "website", "account", "leave", "delete account", "danger zone"],
    related: ["plans-and-top-ups", "notifications", "members"],
    sections: [
      {
        heading: "Company",
        blocks: [
          {
            type: "p",
            text: "Your company's name and its member, project and request counts are at the top of every tab. Owners and Project managers can click **Edit company** to change the **Name** and **Website** on the **Company** tab.",
          },
        ],
      },
      {
        heading: "Plan & billing",
        blocks: [
          {
            type: "p",
            text: "Shows your plan, monthly tokens, price and subscription status. Owners and Billing managers can start a subscription, switch plans and buy top-ups here. See **Plans, upgrades and top-ups**.",
          },
        ],
      },
      {
        heading: "Notifications",
        blocks: [
          {
            type: "p",
            text: "Turn each notification type on or off for **In-app** and **Email**. Changes save instantly.",
          },
        ],
      },
      {
        heading: "Integrations",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Google Drive",
                text: "**Connect Google Drive** so creatives deliver source files straight into a **brandbite** folder in your Drive. brandbite only sees the folder it creates, nothing else in your Drive. Without it, source files are kept on brandbite for 90 days after a request is done.",
              },
              "Owners and Project managers connect and disconnect; everyone else sees what's connected.",
              "If a connection shows **Needs reconnecting**, click **Reconnect** so files keep arriving. Until then, new files go to brandbite storage.",
              {
                term: "Dropbox",
                text: "**Connect Dropbox** so files up to 150 MB land in **Apps › brandbite** in your Dropbox; brandbite only sees that folder. Bigger files are kept on brandbite for 90 days, or go to Google Drive if you connect it too.",
              },
              "**Disconnect** keeps the files already in your Drive or Dropbox.",
              "Slack is coming soon.",
            ],
          },
        ],
      },
      {
        heading: "Workspace access",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Your account",
                text: "click **Edit** to change your name. Your email, role and **Company role** are shown here.",
              },
              {
                term: "Company members",
                text: "Owners and Project managers can click **Manage members** to go to the Members page.",
              },
            ],
          },
        ],
      },
      {
        heading: "Leaving the company",
        blocks: [
          {
            type: "p",
            text: "**Leave workspace**, on the **Workspace access** tab, removes you from the company but keeps your account. You lose access to its projects and requests until someone invites you again.",
          },
          {
            type: "p",
            text: "If you are the only Owner, make someone else an Owner on the Members page first.",
          },
        ],
      },
      {
        heading: "Deleting your account",
        blocks: [
          {
            type: "warning",
            text: "**Delete my account**, on the **Workspace access** tab, is permanent. Type your email to confirm. You are signed out and your personal details are removed. Requests and token history stay with your company, without your name. If you're the only Owner and others are still in the company, make someone else an Owner first.",
          },
        ],
      },
    ],
  },
];
