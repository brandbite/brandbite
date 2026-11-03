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
    summary: "What each part of the sidebar is for and where to find help.",
    category: "Getting started",
    routes: ["/customer/support"],
    keywords: ["navigation", "sidebar", "menu", "start", "help"],
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
                text: "your day-to-day work: **Overview**, the **Board** with all your requests, **Moodboards** and **AI Tools**.",
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
    slug: "how-requests-work",
    title: "How requests and tokens work",
    summary: "The life of a request from To do to Done, and when tokens are spent or refunded.",
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
            text: "Every request (also called a ticket) moves through four statuses. You see them as the four columns of your Board:",
          },
          {
            type: "list",
            items: [
              {
                term: "To do",
                text: "your request is waiting for a creative. While it is here you can still edit it, add brief files, or cancel it for a full refund. The Overview page calls this stage **Backlog**.",
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
              "If you change the service of a request while it is still in **To do**, the difference is charged or refunded automatically.",
            ],
          },
        ],
      },
      {
        heading: "Getting tokens back",
        blocks: [
          {
            type: "p",
            text: "A request can be cancelled for a **full refund** while it is in **To do** and no creative has been assigned yet. Only company Owners and Project managers can cancel. Once a creative has started, cancelling is no longer possible from the dashboard, so contact us through the feedback button instead.",
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
                text: "creates requests, edits them while in To do, asks for changes and works on moodboards. Cannot approve requests as Done, cancel them, or manage projects.",
              },
              {
                term: "Billing manager",
                text: "looks after the plan and token purchases. Can see the board, tickets and token history, but cannot create, edit or move requests.",
              },
            ],
          },
          {
            type: "tip",
            text: 'Your own role is shown on the **Overview** page ("You are browsing as …") and in **Settings** under **Company role**.',
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
                text: "Owner, Project manager (only in To do, before a creative is assigned).",
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
                term: "View the board, tickets and token history",
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
                text: "tokens available right now, with credits and debits. **View ledger** opens the Tokens page.",
              },
              {
                term: "Open tickets",
                text: "how many requests are in Backlog (To do), In progress and In review. **Open board** takes you to the Board.",
              },
              {
                term: "Completed",
                text: "requests marked Done and your completion rate.",
              },
              {
                term: "Ticket pipeline",
                text: "a chart of where your requests are. It appears once you have at least one request.",
              },
              {
                term: "Upcoming deadlines",
                text: "the five most urgent open requests that have a due date. Red means overdue, amber means due within three days. Click one to open it.",
              },
              {
                term: "Company and Plan & billing",
                text: "your company details, your plan's monthly tokens and price. **Open settings** goes to Settings.",
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
    summary:
      "See every request by status, filter by project, search, and approve work by dragging.",
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
            text: "The Board shows your requests in four columns: **To do**, **In progress**, **In review** and **Done**. Inside each column, cards are sorted by priority (Urgent first), then oldest first. You can't reorder cards by hand.",
          },
          {
            type: "p",
            text: "Each card shows the title, a short description, a thumbnail, the due date (red when overdue), the ticket code, the priority icon and a green **Assigned** badge once a creative has picked it up.",
          },
          {
            type: "warning",
            text: "The Board shows your **50 most recent** requests. If you have more, use the **Table** view to see all of them.",
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
                term: "Search board",
                text: "filters cards by ticket code, title or description. Press **/** anywhere on the Board to jump to the search box.",
              },
              {
                term: "Projects",
                text: "click a project in the left panel to show only its requests. Click it again, or **All projects**, to clear the filter.",
              },
              {
                term: "Filter",
                text: "opens a project dropdown. **Clear** removes the filter.",
              },
              {
                term: "Share",
                text: "copies the Board's link to your clipboard.",
              },
              {
                term: "Kanban / Table",
                text: "switches between the Board and a sortable list of all requests.",
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
            text: "Click a card to open it in a full-screen window. There you can read the brief, look at every version the creative sent, add pin notes on images, download files and, while it is In review, approve it or ask for changes.",
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
              "Drop on **In progress** to ask for changes. A window asks for a message for your creative.",
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
            text: "Use **+ New ticket** at the top or **+ Create** at the bottom of the To do column. The form is the same as on the New request page and the request lands in **To do**.",
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
              "Click **+ New request** on Overview, **+ New ticket** on the Board, or **Create ticket** on a service in **Services**.",
              "Write a **Title**. This is the line your creative sees on the board.",
              "Describe what you need in the **Brief**: links, context and requirements.",
              "Pick a **Job type** with **Choose a service type…**. Search or browse by category, click a service, then press **Select**.",
              "Optionally set **Priority**, **Due date**, **Project**, attach files or a moodboard.",
              "Check the **Cost** line, then click **Create ticket**.",
            ],
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
                term: "Job type",
                text: "required. Sets the token cost. Some job types also have a **quantity** (1 to 10), which multiplies the cost.",
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
            text: "Under the job type you see **Cost: N tokens** and **Remaining after: N tokens**. The cost is deducted as soon as you click **Create ticket**.",
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
            text: "**✨ Fill with AI** above the brief lets you paste a rough description (at least 10 characters). It fills in the title, brief, job type and priority for you to check and adjust before submitting.",
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
            text: "When your creative sends a version, the request moves to **In review** and the person who created it gets a notification. Open it from the Board, the Table, the notification or the email.",
          },
          {
            type: "p",
            text: "Every version is kept. The newest is marked **Current** and older ones are under **Previous versions**. With two or more versions, **Compare** shows them side by side.",
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
              "While the request is **In review**, click **Request revision** (Board) or **Request changes** (request page). You can also drag the card to **In progress**.",
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
              "Click **Mark as done**, or drag the card to **Done** on the Board.",
              "Check the final files in the window. You can download them from here.",
              "Confirm. Your creative is paid for the job and the request moves to **Done**.",
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
              "**Download all** zips every file in a version (shown when it has two or more files).",
              "On a Done request, the Board window has **Download final work**.",
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
                term: "Edit",
                text: "change the title, brief, priority, project, job type or due date while the request is in **To do**.",
              },
              {
                term: "Add files",
                text: "add brief attachments while the request is in **To do**.",
              },
              {
                term: "Cancel & refund",
                text: "Owners and Project managers can cancel a request in **To do** that no creative has picked up yet. The full token cost is returned. This can't be undone.",
              },
              {
                term: "Comments",
                text: "on the request page you can leave comments for your team and the creative. Comments can't be edited or deleted.",
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
    keywords: ["table", "list", "my tickets", "sort", "filter", "search", "pagination"],
    related: ["board", "review-and-approve"],
    sections: [
      {
        heading: "Using the table",
        blocks: [
          {
            type: "p",
            text: "Switch to **Table** at the top of the Board, or open **My tickets**. Unlike the Board, the table includes every request, 50 per page.",
          },
          {
            type: "list",
            items: [
              {
                term: "Search",
                text: "matches the title, project name or job type. To find a request by its code, use the Board's search.",
              },
              {
                term: "Filters",
                text: "Status, Project and Priority.",
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
              "On the Board, click **+** next to **Projects** in the left panel.",
              "Enter a **Project name** (at least two characters) and click **Create project**. A short code is generated from the name.",
              "Pick the project when you create a request, then click it on the Board to see only its requests.",
            ],
          },
          {
            type: "p",
            text: "Only Owners and Project managers can create, rename or delete projects.",
          },
        ],
      },
      {
        heading: "Brand guide",
        blocks: [
          {
            type: "p",
            text: "Hover a project in the Board's left panel, open the **⋯** menu and choose **Brand guide**. Fill it once and it is shown to creatives on every request in that project:",
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
            text: "Use **Rename** or **Delete project** in the same **⋯** menu.",
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
        ],
      },
      {
        heading: "Adding items",
        blocks: [
          {
            type: "p",
            text: "Use the toolbar on the left (on mobile, the **+** button). New items are placed below what's already there.",
          },
          {
            type: "list",
            items: [
              { term: "Note", text: "a title and some text." },
              { term: "Image", text: "upload an image from your device (4 MB max)." },
              { term: "Color", text: "a hex colour with an optional name, or a preset swatch." },
              {
                term: "Link",
                text: "paste a URL. Its title and description are filled in for you.",
              },
              { term: "File", text: "upload any file (4 MB max)." },
              { term: "Todo", text: "a checklist with as many items as you like." },
              { term: "Video", text: "paste a YouTube, Vimeo or Loom link." },
            ],
          },
          {
            type: "p",
            text: "On desktop you can also **Draw** freehand (right-click Draw to change the colour and size) and connect two cards with an **Arrow**: click the first card, then the second.",
          },
        ],
      },
      {
        heading: "Moving around",
        blocks: [
          {
            type: "list",
            items: [
              "Drag a card by its handle to move it. Drag the bottom-right corner to resize.",
              "Scroll to pan, or hold **Space** and drag.",
              "**Ctrl** + scroll (**⌘** + scroll on a Mac) to zoom, or use the zoom buttons, including **Fit to content**.",
            ],
          },
        ],
      },
      {
        heading: "Deleting",
        blocks: [
          {
            type: "warning",
            text: "Deleting a card (**⋮** → **Delete**), an arrow (click it) or a drawing (Eraser) happens immediately, with no undo.",
          },
          {
            type: "p",
            text: "**Delete** at the top removes the whole moodboard and its uploaded files after you confirm. Only the person who created it, an Owner or a Project manager can do this.",
          },
        ],
      },
      {
        heading: "Sharing with your creative",
        blocks: [
          {
            type: "p",
            text: "When you create a request, choose the moodboard under **Attach moodboard**. It is then listed on the request for your creative. A moodboard can be attached to one request.",
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
              "Click a tool card to open it.",
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
              "**Recent Generations** lists your last 10 uses with their cost.",
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
            text: "Services lists every type of job you can request, grouped by category. Click a category to filter. Click it again to show everything.",
          },
          {
            type: "p",
            text: "Each service shows its description, its cost in tokens and, where set, an estimated time in hours.",
          },
        ],
      },
      {
        heading: "Requesting a service",
        blocks: [
          {
            type: "p",
            text: "Click **Create ticket** on a service. The new request form opens with that service already selected. Nothing is charged until you create the request.",
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
                term: "Total credits",
                text: "tokens added by plan renewals, top-ups and adjustments.",
              },
              {
                term: "Total debits",
                text: "tokens used by requests, AI tools and consultations.",
              },
            ],
          },
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
            text: "The ledger shows your 50 most recent movements with the date, amount, reason, ticket code and your balance before and after. Use **All / Credits / Debits** to filter. Common reasons:",
          },
          {
            type: "list",
            items: [
              { term: "JOB_REQUEST_CREATED", text: "a request was created." },
              { term: "REFUND", text: "a request was cancelled." },
              {
                term: "AI_GENERATION / AI_REFUND",
                text: "an AI tool was used, or refunded after a failure.",
              },
              {
                term: "CONSULTATION_BOOKING / CONSULTATION_REFUND",
                text: "a consultation was booked, or cancelled by our team.",
              },
              { term: "TOKEN_TOPUP", text: "you bought a top-up." },
              {
                term: "SUBSCRIPTION_INITIAL_CREDIT / SUBSCRIPTION_RENEWAL",
                text: "tokens from your plan.",
              },
              { term: "ADMIN_ADJUSTMENT", text: "a manual change by our team." },
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
            text: "Only **Owners** and **Billing managers** can start a subscription, change the plan or buy tokens. Everyone else sees the plan in **Settings → Subscription plan** with a **Limited access** note.",
          },
        ],
      },
      {
        heading: "Starting a subscription",
        blocks: [
          {
            type: "p",
            text: "If your company doesn't have a subscription yet, click **Start subscription** in **Settings → Subscription plan** and pay through Stripe. Your plan's monthly tokens are added as soon as the payment succeeds.",
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
              "Go to **Settings** and find **Switch to a different plan**.",
              "Each plan is marked **Upgrade** or **Downgrade** with its monthly tokens and price. Click **Preview & switch**.",
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
              "In **Settings**, find **Need more tokens now?**.",
              "Click **Buy** on a pack. You are taken to Stripe to pay.",
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
    summary: "Book a video call with the Brandbite team, what it costs and how scheduling works.",
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
              "Optionally pick a preferred date and a 30-minute time slot, and check the timezone.",
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
              "We confirm a time by email with a video link. Sometimes a slot you picked is confirmed straight away.",
              "Your requests are listed under **Your consultations** with their status: Awaiting scheduling, Scheduled, Completed or Canceled. Scheduled calls have a **Join call** link.",
            ],
          },
        ],
      },
      {
        heading: "Cancelling or rescheduling",
        blocks: [
          {
            type: "p",
            text: "There's no cancel button in the dashboard. Reply to the scheduling email or use the feedback button. When we cancel a booking, its tokens are refunded in full.",
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
        heading: "Name and avatar",
        blocks: [
          {
            type: "list",
            items: [
              "Your name appears on requests, comments and emails. Change it and click **Save name**.",
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
              "Enter your current password and click **Set up**.",
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
        ],
      },
      {
        heading: "The bell",
        blocks: [
          {
            type: "p",
            text: "Click the bell at the bottom of the sidebar to see your latest 20 notifications. Unread ones are bold. Click one to open its request, or **Mark all as read**.",
          },
        ],
      },
      {
        heading: "Choosing what you get",
        blocks: [
          {
            type: "p",
            text: "In **Settings → Notification preferences** (or on your **Profile**), switch each type on or off for **In-app** and **Email**. Changes save instantly and apply to future notifications. Sign-in and security emails are always sent.",
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
              "Under **Invite a new member**, enter their email address.",
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
            text: "Invites that haven't been accepted are listed under **Pending invites**, marked **Expired** when they have run out. There's no resend button: click **Cancel**, then invite the person again.",
          },
        ],
      },
      {
        heading: "Changing a role",
        blocks: [
          {
            type: "p",
            text: "Pick a new role in the dropdown on someone's card. The change applies **immediately**, with no confirmation.",
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
            text: "Click **Remove** on their card and confirm. They lose access straight away. To bring them back, invite them again. The last Owner can't be removed.",
          },
        ],
      },
    ],
  },
  {
    slug: "settings",
    title: "Settings",
    summary:
      "Your account, company details, plan, notification preferences, and leaving or deleting.",
    category: "Account",
    routes: ["/customer/settings"],
    keywords: ["company", "website", "account", "leave", "delete account", "danger zone"],
    related: ["plans-and-top-ups", "notifications", "members"],
    sections: [
      {
        heading: "Account and company",
        blocks: [
          {
            type: "list",
            items: [
              {
                term: "Account",
                text: "click **Edit** to change your name. Your email, role and **Company role** are shown here.",
              },
              {
                term: "Company",
                text: "Owners and Project managers can click **Edit** to change the company **Name** and **Website**. You also see the number of members, projects and tickets.",
              },
            ],
          },
        ],
      },
      {
        heading: "Subscription plan",
        blocks: [
          {
            type: "p",
            text: "Shows your plan, monthly tokens, price and subscription status. Owners and Billing managers can start a subscription, switch plans and buy top-ups here. See **Plans, upgrades and top-ups**.",
          },
        ],
      },
      {
        heading: "Notification preferences",
        blocks: [
          {
            type: "p",
            text: "Turn each notification type on or off for **In-app** and **Email**. Changes save instantly.",
          },
        ],
      },
      {
        heading: "Leaving the company",
        blocks: [
          {
            type: "p",
            text: "**Leave workspace** removes you from the company but keeps your account. You lose access to its projects and requests until someone invites you again.",
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
            text: "**Delete my account** is permanent. Type your email to confirm. You are signed out and your personal details are removed. Requests and token history stay with your company, without your name.",
          },
        ],
      },
    ],
  },
];
