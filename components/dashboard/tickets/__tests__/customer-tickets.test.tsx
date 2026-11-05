import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CustomerTicketDetailPage from "@/app/customer/tickets/[ticketId]/page";
import NewTicketForm from "@/app/customer/tickets/new/NewTicketForm";
import CustomerTicketsPage from "@/app/customer/tickets/page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ ticketId: "t1" }),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/customer/tickets",
}));
vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock("@/components/ui/rich-text-editor", () => ({
  RichTextEditor: () => <div data-testid="editor" />,
}));

afterEach(() => vi.restoreAllMocks());

function respond(routes: [string, unknown][]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const hit = routes.find(([part]) => url.includes(part));
    return hit ? Response.json(hit[1]) : Response.json({ error: "Not mocked" }, { status: 404 });
  });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

const listTicket = (over: Record<string, unknown>) => ({
  id: "t1",
  code: "WEB-101",
  title: "Logo redesign",
  status: "TODO",
  priority: "HIGH",
  projectId: "p1",
  projectName: "Website",
  projectCode: "WEB",
  isAssigned: true,
  jobTypeName: "Logo",
  createdAt: "2026-03-06T12:00:00.000Z",
  dueDate: null,
  tags: [],
  ...over,
});

function mockList(role: string, tickets = [listTicket({})]) {
  respond([
    ["/api/customer/settings", { user: { companyRole: role } }],
    ["/api/customer/tags", { tags: [] }],
    [
      "/api/customer/board",
      { stats: { total: 6, byStatus: { TODO: 2, IN_PROGRESS: 2, IN_REVIEW: 1, DONE: 1 } } },
    ],
    [
      "/api/customer/tickets",
      {
        company: { id: "c", name: "Acme Studio", slug: "acme" },
        tickets,
        pagination: { total: tickets.length, limit: 50, offset: 0, hasMore: false },
      },
    ],
  ]);
}

describe("Customer request list", () => {
  it("links each request and shows real status counts", async () => {
    mockList("OWNER");
    render(<CustomerTicketsPage />);
    expect(await screen.findByRole("link", { name: "Logo redesign" })).toHaveAttribute(
      "href",
      "/customer/tickets/t1",
    );
    expect(await screen.findByRole("button", { name: /Backlog\s*· 2/ })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "+ New request" })).toBeInTheDocument();
  });

  it("flags overdue work but never finished work, and dashes a missing date", async () => {
    mockList("OWNER", [
      listTicket({ id: "a", title: "Late", dueDate: "2020-01-02T12:00:00.000Z" }),
      listTicket({
        id: "b",
        title: "Finished",
        status: "DONE",
        dueDate: "2020-01-02T12:00:00.000Z",
      }),
      listTicket({ id: "c", title: "Undated" }),
    ]);
    render(<CustomerTicketsPage />);
    await screen.findByRole("link", { name: "Late" });
    expect(screen.getAllByText(/Overdue/)).toHaveLength(1);
    const undated = screen.getByRole("link", { name: "Undated" }).closest("tr")!;
    expect(within(undated).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("tells billing users why they can't create requests", async () => {
    mockList("BILLING");
    render(<CustomerTicketsPage />);
    expect(await screen.findByText("Limited access")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "+ New request" })).toBeNull();
  });

  it("separates an empty account from an empty filter", async () => {
    mockList("OWNER", []);
    render(<CustomerTicketsPage />);
    expect(await screen.findByText("No requests yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Done/ }));
    expect(await screen.findByText("No requests match these filters")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

const asset = (id: string) => ({
  id,
  url: `https://x.test/${id}.png`,
  mimeType: "image/png",
  bytes: 10,
  width: 1,
  height: 1,
  originalName: `${id}.png`,
  pinCount: 0,
  openPins: 0,
  resolvedPins: 0,
});

function mockDetail(status: string, role: string) {
  respond([
    ["/api/customer/company-role", { role }],
    ["/comments", { comments: [] }],
    ["/assets", { assets: [] }],
    [
      "/revisions",
      {
        revisions: [
          {
            version: 1,
            submittedAt: "2026-02-26T12:00:00.000Z",
            feedbackAt: "2026-02-28T12:00:00.000Z",
            feedbackMessage: "Make the intro larger",
            assets: [asset("old")],
          },
          {
            version: 2,
            submittedAt: "2026-03-03T12:00:00.000Z",
            feedbackAt: null,
            feedbackMessage: null,
            assets: [asset("new")],
          },
        ],
      },
    ],
    [
      "/api/customer/tickets/t1",
      {
        ticket: {
          id: "t1",
          code: "ONB-103",
          title: "Motion explainer",
          description: "<p>The brief</p>",
          status,
          priority: "HIGH",
          dueDate: null,
          createdAt: "2026-03-06T12:00:00.000Z",
          updatedAt: "2026-04-04T12:00:00.000Z",
          companyTicketNumber: 103,
          quantity: 1,
          effectiveCost: 1,
          effectivePayout: null,
          tokenCostOverride: null,
          creativePayoutOverride: null,
          project: null,
          jobType: null,
          isAssigned: true,
          creativeMode: "DESIGNER",
          createdBy: { id: "u", name: "Acme PM", email: "pm@acme.test" },
          completedAt: null,
          completedBy: null,
          tags: [],
        },
      },
    ],
  ]);
}

describe("Customer request detail", () => {
  it("opens on the current version with approve and revision in reach", async () => {
    mockDetail("IN_REVIEW", "OWNER");
    render(<CustomerTicketDetailPage />);
    expect(await screen.findByText("Ready for your review")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /Version 2/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Current version" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: "Approve & complete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request revision" })).toBeInTheDocument();
  });

  it("collapses older versions but keeps their feedback readable", async () => {
    mockDetail("IN_REVIEW", "OWNER");
    render(<CustomerTicketDetailPage />);
    const older = await screen.findByRole("button", { name: /Version 1/ });
    expect(older).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("old.png")).toBeNull();
    expect(screen.getByText("Make the intro larger")).toBeInTheDocument();
    fireEvent.click(older);
    expect(screen.getByText("old.png")).toBeInTheDocument();
  });

  it("keeps revision notes out of the comments tab", async () => {
    mockDetail("IN_REVIEW", "OWNER");
    render(<CustomerTicketDetailPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /Comments/ }));
    expect(await screen.findByText("No comments yet")).toBeInTheDocument();
    expect(screen.queryByText("Make the intro larger")).toBeNull();
  });

  it("requires a message before sending a revision request", async () => {
    mockDetail("IN_REVIEW", "OWNER");
    render(<CustomerTicketDetailPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Request revision" }));
    fireEvent.click(screen.getByRole("button", { name: "Send back to creative" }));
    expect(await screen.findByText(/add a short message/)).toBeInTheDocument();
    const writes = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(writes).toHaveLength(0);
  });

  it("hides the decisions from roles that can't make them", async () => {
    mockDetail("IN_REVIEW", "BILLING");
    render(<CustomerTicketDetailPage />);
    expect(await screen.findByText(/Your role can view this review/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve & complete" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Request revision" })).toBeNull();
  });

  it("starts a backlog request on its brief, editable, with no review actions", async () => {
    mockDetail("TODO", "OWNER");
    render(<CustomerTicketDetailPage />);
    expect(await screen.findByRole("heading", { name: "Brief" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Current version" })).toBeNull();
    expect(await screen.findByRole("button", { name: "Edit request" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve & complete" })).toBeNull();
  });

  it("explains a failed load", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({ error: "Not found" }, { status: 404 }),
    );
    render(<CustomerTicketDetailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
  });
});

// ---------------------------------------------------------------------------
// New request
// ---------------------------------------------------------------------------

const jobTypes = [
  {
    id: "cheap",
    name: "Ad copy",
    category: "Copy",
    description: null,
    tokenCost: 1,
    defaultQuantity: 1,
  },
  {
    id: "dear",
    name: "Motion",
    category: "Video",
    description: null,
    tokenCost: 24,
    defaultQuantity: 1,
  },
];

function renderForm(props: { initialJobTypeId?: string; role?: string } = {}) {
  respond([
    ["/api/customer/settings", { user: { companyRole: props.role ?? "OWNER" } }],
    ["/api/moodboards", { moodboards: [] }],
  ]);
  return render(
    <NewTicketForm
      companySlug="acme"
      projects={[]}
      jobTypes={jobTypes}
      tokenBalance={3}
      initialJobTypeId={props.initialJobTypeId}
    />,
  );
}

describe("New request form", () => {
  it("shows no cost until a job type is chosen", async () => {
    renderForm();
    expect(await screen.findByText("Select a job type")).toBeInTheDocument();
    expect(screen.getByText("3 tokens")).toBeInTheDocument();
    expect(screen.queryByText("Remaining after")).toBeNull();
  });

  it("prices the chosen job type against the balance", async () => {
    renderForm({ initialJobTypeId: "cheap" });
    expect(await screen.findByText("Remaining after")).toBeInTheDocument();
    expect(screen.getAllByText("1 token")).not.toHaveLength(0);
    expect(screen.getByText("2 tokens")).toBeInTheDocument();
  });

  it("blocks a request the balance can't cover", async () => {
    renderForm({ initialJobTypeId: "dear" });
    expect(await screen.findByText("Not enough tokens")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create request" })).toBeDisabled();
  });

  it("explains a missing title on submit, without calling the API", async () => {
    renderForm({ initialJobTypeId: "cheap" });
    await screen.findByText("Remaining after");
    fireEvent.click(screen.getByRole("button", { name: "Create request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required");
    const writes = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST");
    expect(writes).toHaveLength(0);
  });
});
