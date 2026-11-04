import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CustomerBoardPage from "@/app/customer/board/page";

const showToast = vi.fn();
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/app/customer/tickets/new/NewTicketForm", () => ({
  default: () => <div>new ticket form</div>,
}));

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    code: "WEB-1",
    title: "Logo redesign",
    description: "<p>Refresh the logo</p>",
    status: "TODO",
    priority: "MEDIUM",
    projectId: "p1",
    projectName: "Web",
    projectCode: "WEB",
    isAssigned: false,
    jobTypeId: "j1",
    jobTypeName: "Logo",
    createdAt: "2026-01-01T12:00:00.000Z",
    dueDate: "2999-01-15T12:00:00.000Z",
    tags: [],
    ...overrides,
  };
}

type Calls = { method: string; url: string }[];

function mockApi({
  role = "OWNER",
  tickets = [ticket()],
  revisions = [],
  comments = [],
  failBoard = false,
}: {
  role?: string | null;
  tickets?: ReturnType<typeof ticket>[];
  revisions?: object[];
  comments?: object[];
  failBoard?: boolean;
} = {}): Calls {
  const calls: Calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url });
    if (url.includes("/company-role")) return Response.json({ role });
    if (url.includes("/api/customer/projects")) {
      return Response.json({
        projects: [
          { id: "p1", name: "Web", code: "WEB", ticketCount: 1 },
          { id: "p2", name: "Empty", code: "EMP", ticketCount: 0 },
        ],
      });
    }
    if (url.includes("/revisions")) return Response.json({ revisions });
    if (url.includes("/comments")) {
      if (method === "POST") {
        return Response.json({
          comment: {
            id: "new",
            body: "Thanks",
            createdAt: "2026-02-01T12:00:00.000Z",
            author: { id: "u", name: "Ada", email: "a@b.c" },
          },
        });
      }
      return Response.json({ comments });
    }
    if (url.includes("/assets")) return Response.json({ assets: [] });
    if (url.includes("/api/customer/tickets/status")) return Response.json({ success: true });
    if (/\/api\/customer\/tickets\/[^/?]+$/.test(url)) {
      return Response.json({
        ticket: { effectiveCost: 24, updatedAt: "2026-02-03T12:00:00.000Z" },
      });
    }
    if (url.includes("/api/customer/tickets")) {
      if (failBoard) return Response.json({ error: "Board is down" }, { status: 500 });
      return Response.json({
        company: { id: "c", name: "Acme Studio", slug: "acme" },
        tickets,
        pagination: { hasMore: false },
      });
    }
    return Response.json({});
  });
  return calls;
}

function openCard(name: RegExp) {
  const card = screen.getByRole("button", { name });
  fireEvent.keyDown(card, { key: "Enter" });
}

beforeEach(() => showToast.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("Customer board", () => {
  it("shows the four columns, company, role and real counts", async () => {
    mockApi({ tickets: [ticket(), ticket({ id: "t2", title: "Deck", status: "DONE" })] });
    render(<CustomerBoardPage />);
    expect(await screen.findByText("Logo redesign")).toBeInTheDocument();
    for (const label of ["Backlog", "In progress", "In review", "Done"]) {
      expect(screen.getByRole("region", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText("Acme Studio")).toBeInTheDocument();
    await screen.findByText("Owner");
    expect(within(screen.getByRole("region", { name: "Done" })).getByText("Deck")).toBeTruthy();
  });

  it("shows a dash instead of a date when there is none, and marks real overdue only", async () => {
    mockApi({
      tickets: [
        ticket({ id: "none", title: "No date", dueDate: null }),
        ticket({ id: "late", title: "Late", dueDate: "2020-01-02T12:00:00.000Z" }),
        ticket({
          id: "shipped",
          title: "Shipped",
          status: "DONE",
          dueDate: "2020-01-02T12:00:00.000Z",
        }),
      ],
    });
    render(<CustomerBoardPage />);
    await screen.findByText("No date");
    expect(screen.getAllByText(/Overdue/)).toHaveLength(1);
    const noDate = screen.getByRole("button", { name: /No date/ });
    expect(within(noDate).getByText("—")).toBeInTheDocument();
  });

  it("filters by project, priority, tag, assignment and search", async () => {
    mockApi({
      tickets: [
        ticket({ id: "a", title: "Alpha", priority: "HIGH", isAssigned: true }),
        ticket({
          id: "b",
          title: "Beta",
          projectName: "Print",
          tags: [{ id: "tg", name: "Brand", color: "BLUE" }],
        }),
      ],
    });
    render(<CustomerBoardPage />);
    await screen.findByText("Alpha");

    fireEvent.change(screen.getByLabelText("Filter by project"), { target: { value: "Print" } });
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.getByText("Showing 1 of 2 requests")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Alpha")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by priority"), { target: { value: "HIGH" } });
    expect(screen.queryByText("Beta")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "tg" } });
    expect(screen.queryByText("Alpha")).toBeNull();
    fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "ALL" } });

    fireEvent.change(screen.getByLabelText("Assignment"), { target: { value: "ASSIGNED" } });
    expect(screen.queryByText("Beta")).toBeNull();
    fireEvent.change(screen.getByLabelText("Assignment"), { target: { value: "ALL" } });

    fireEvent.change(screen.getByLabelText("Search requests"), { target: { value: "beta" } });
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("lists empty projects in the filter", async () => {
    mockApi();
    render(<CustomerBoardPage />);
    await screen.findByRole("option", { name: "Empty (0)" });
  });

  it("asks for review and opens the card from the banner", async () => {
    mockApi({
      tickets: [ticket({ id: "r", title: "Motion", code: "ONB-3", status: "IN_REVIEW" })],
    });
    render(<CustomerBoardPage />);
    expect(await screen.findByText("Needs your review")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Review request/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: "Current version" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Open full page/ })).toHaveAttribute(
      "href",
      "/customer/tickets/r",
    );
  });

  it("counts several reviews and hides the prompt when nothing needs one", async () => {
    mockApi({
      tickets: [
        ticket({ id: "a", title: "Motion", status: "IN_REVIEW" }),
        ticket({ id: "b", title: "Deck", status: "IN_REVIEW" }),
      ],
    });
    const { unmount } = render(<CustomerBoardPage />);
    expect(await screen.findByText("2 requests need your review")).toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();

    mockApi();
    render(<CustomerBoardPage />);
    await screen.findByText("Logo redesign");
    expect(screen.queryByText("Needs your review")).toBeNull();
  });

  it("only offers the actions the company role allows", async () => {
    const review = ticket({ id: "r", title: "Motion", status: "IN_REVIEW", isAssigned: true });

    mockApi({ role: "BILLING", tickets: [review] });
    const billing = render(<CustomerBoardPage />);
    await screen.findByText("Motion");
    await screen.findByText("Billing manager");
    expect(screen.queryByText("Needs your review")).toBeNull();
    expect(screen.queryByRole("button", { name: /New request/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Project actions" })).toBeNull();
    openCard(/Motion/);
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Request revision" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
    billing.unmount();
    vi.restoreAllMocks();

    mockApi({ role: "MEMBER", tickets: [review] });
    const member = render(<CustomerBoardPage />);
    await screen.findByText("Member");
    expect(screen.getByRole("button", { name: /New request/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Project actions" })).toBeNull();
    openCard(/Motion/);
    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: "Request revision" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
    member.unmount();
    vi.restoreAllMocks();

    mockApi({ role: "PM", tickets: [review] });
    render(<CustomerBoardPage />);
    await screen.findByText("Project manager");
    expect(screen.getByRole("button", { name: "Project actions" })).toBeInTheDocument();
    openCard(/Motion/);
    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: /Approve/ })).toBeInTheDocument();
  });

  it("only makes In review cards draggable", async () => {
    mockApi({
      tickets: [
        ticket({ id: "a", title: "Waiting" }),
        ticket({ id: "b", title: "Motion", status: "IN_REVIEW" }),
      ],
    });
    render(<CustomerBoardPage />);
    await screen.findByText("Owner");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Motion/ })).toHaveAttribute("draggable", "true"),
    );
    expect(screen.getByRole("button", { name: /Waiting/ })).toHaveAttribute("draggable", "false");
  });

  it("confirms a drop on Done and on In progress before saving", async () => {
    const calls = mockApi({
      tickets: [ticket({ id: "b", title: "Motion", status: "IN_REVIEW" })],
    });
    render(<CustomerBoardPage />);
    await screen.findByText("Owner");
    const card = await screen.findByRole("button", { name: /Motion/ });
    const dataTransfer = { setData: vi.fn(), getData: () => "b", effectAllowed: "" };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "Done" }), { dataTransfer });
    expect(await screen.findByText("Approve and complete this request?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "In progress" }), { dataTransfer });
    expect(await screen.findByText("Send this request back to your creative?")).toBeInTheDocument();

    // An empty revision message is refused without touching the API.
    fireEvent.click(screen.getByRole("button", { name: "Send back to creative" }));
    expect(screen.getByText("Please add a short message for your creative.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("refuses a drop that isn't allowed and explains why", async () => {
    mockApi({
      tickets: [
        ticket({ id: "b", title: "Motion", status: "IN_REVIEW" }),
        ticket({ id: "c", title: "Waiting" }),
      ],
    });
    render(<CustomerBoardPage />);
    await screen.findByText("Owner");
    await screen.findByRole("button", { name: /Motion/ });
    fireEvent.drop(screen.getByRole("region", { name: "Done" }), {
      dataTransfer: { getData: () => "c" },
    });
    expect(await screen.findByText(/can only be picked up by your creative/)).toBeInTheDocument();
  });

  it("opens the card detail with a real cost and comments on their own tab", async () => {
    const calls = mockApi({
      comments: [
        {
          id: "c1",
          body: "Looks good",
          createdAt: "2026-02-01T12:00:00.000Z",
          author: { id: "u", name: "Ada", email: "a@b.c" },
        },
      ],
    });
    render(<CustomerBoardPage />);
    await screen.findByText("Logo redesign");
    openCard(/Logo redesign/);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: "Brief & files" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await within(dialog).findByText("24 tokens")).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes("/comments"))).toBe(false);

    fireEvent.click(within(dialog).getByRole("tab", { name: "Comments" }));
    expect(await within(dialog).findByText("Looks good")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Add a comment"), {
      target: { value: "Thanks" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add comment" }));
    expect(await within(dialog).findByText("Thanks")).toBeInTheDocument();
  });

  it("gates edit and cancel on status and role, and confirms a cancel", async () => {
    mockApi();
    render(<CustomerBoardPage />);
    await screen.findByText("Owner");
    await screen.findByText("Logo redesign");
    openCard(/Logo redesign/);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Cancel & refund/ }));
    expect(await screen.findByText("Cancel this request?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep request" }));
    expect(screen.queryByText("Cancel this request?")).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: /Edit request/ }));
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Logo redesign");
    expect(within(dialog).getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(within(dialog).getByRole("button", { name: /Edit request/ })).toBeInTheDocument();
  });

  it("has no cancel once a creative is assigned", async () => {
    mockApi({ tickets: [ticket({ isAssigned: true })] });
    render(<CustomerBoardPage />);
    await screen.findByText("Owner");
    await screen.findByText("Logo redesign");
    openCard(/Logo redesign/);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: /Cancel & refund/ })).toBeNull();
    expect(within(dialog).getByRole("button", { name: /Edit request/ })).toBeInTheDocument();
  });

  it("offers project actions, including for the selected project", async () => {
    mockApi();
    render(<CustomerBoardPage />);
    await screen.findByText("Owner");
    await screen.findByRole("option", { name: "Web (1)" });
    fireEvent.click(screen.getByRole("button", { name: "Project actions" }));
    expect(screen.getByRole("button", { name: "New project" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Filter by project"), { target: { value: "Web" } });
    expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Brand guide" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
    expect(await screen.findByText(/will be moved to/)).toBeInTheDocument();
  });

  it("copies the board link with Share", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    mockApi();
    render(<CustomerBoardPage />);
    await screen.findByText("Logo redesign");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Link copied to clipboard" }),
      ),
    );
    expect(writeText).toHaveBeenCalled();
  });

  it("links to the list view and focuses search on /", async () => {
    mockApi();
    render(<CustomerBoardPage />);
    await screen.findByText("Logo redesign");
    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute("href", "/customer/tickets");
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByLabelText("Search requests")).toHaveFocus();
  });

  it("separates nothing yet from nothing matching", async () => {
    mockApi({ tickets: [] });
    const { unmount } = render(<CustomerBoardPage />);
    expect(await screen.findByText("No requests yet")).toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();

    mockApi();
    render(<CustomerBoardPage />);
    await screen.findByText("Logo redesign");
    fireEvent.change(screen.getByLabelText("Search requests"), { target: { value: "zzz" } });
    expect(screen.queryByText("No requests yet")).toBeNull();
    expect(screen.getAllByText("No matching requests.")).toHaveLength(4);
  });

  it("explains a failed load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockApi({ failBoard: true });
    render(<CustomerBoardPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Board is down");
    expect(showToast).toHaveBeenCalled();
  });
});
