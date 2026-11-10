import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CreativeBoardPage from "@/app/creative/board/page";

const showToast = vi.fn();
vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ showToast }),
}));

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    title: "Logo redesign",
    description: "<p>Update the logo</p>",
    status: "TODO",
    priority: "HIGH",
    dueDate: "2999-01-15T12:00:00.000Z",
    companyTicketNumber: 101,
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-02T12:00:00.000Z",
    company: { id: "c", name: "Acme Studio", slug: "acme" },
    project: { id: "p1", name: "Website revamp", code: "WEB" },
    jobType: { id: "j", name: "Logo Design", tokenCost: 10, creativePayoutTokens: 6 },
    revisionCount: 0,
    estimatedPayout: 10,
    latestRevisionHasFeedback: false,
    latestRevisionFeedbackSnippet: null,
    ...overrides,
  };
}

type Call = { url: string; method: string; body: unknown };

function mockApi({
  tickets = [ticket()],
  revisions = [],
  comments = [],
  failList = false,
}: {
  tickets?: ReturnType<typeof ticket>[];
  revisions?: object[];
  comments?: object[];
  failList?: boolean;
} = {}) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.includes("/availability")) return Response.json({ isPaused: false });
    if (url.includes("/revisions")) return Response.json({ revisions });
    if (url.includes("/assets")) return Response.json({ assets: [] });
    if (url.includes("/comments")) return Response.json({ comments });
    if (url.includes("/batch")) {
      const ids = (JSON.parse(String(init?.body)) as { ticketIds: string[] }).ticketIds;
      return Response.json({
        successCount: ids.length,
        failCount: 0,
        results: ids.map((ticketId) => ({ ticketId, success: true })),
      });
    }
    if (method === "PATCH") return Response.json({ revisionId: "r1" });
    if (failList) return Response.json({ error: "Board is down" }, { status: 500 });
    return Response.json({ stats: {}, tickets, revisionNotesEnabled: true });
  });
  return calls;
}

const writes = (calls: Call[]) => calls.filter((c) => c.method !== "GET");

const column = (name: string) => screen.getByRole("region", { name });

const dataTransfer = { setData: () => {}, effectAllowed: "" };

function drag(title: string, toColumn: string) {
  const card = screen.getByText(title).closest("article") as HTMLElement;
  fireEvent.dragStart(card, { dataTransfer });
  fireEvent.dragOver(column(toColumn), { dataTransfer });
  fireEvent.drop(column(toColumn), { dataTransfer });
}

beforeEach(() => showToast.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("Creative board", () => {
  it("shows four status columns with real payout and due date, and no pager", async () => {
    mockApi();
    render(<CreativeBoardPage />);
    await screen.findByText("Logo redesign");
    for (const name of ["Backlog", "In progress", "In review", "Done"]) {
      expect(column(name)).toBeInTheDocument();
    }
    const card = within(column("Backlog"));
    expect(card.getByText("10 tokens")).toBeInTheDocument();
    expect(card.getByText("WEB-101")).toBeInTheDocument();
    expect(card.getByText(/2999/)).toBeInTheDocument();
    expect(screen.queryByText(/sample/i)).toBeNull();
    expect(screen.getByText("Showing 1 of 1 request")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).toBeNull();
  });

  it("shows a dash, not zero or a made-up date, when values are missing", async () => {
    mockApi({ tickets: [ticket({ estimatedPayout: null, dueDate: null })] });
    render(<CreativeBoardPage />);
    await screen.findByText("Logo redesign");
    expect(within(column("Backlog")).getAllByText("—")).toHaveLength(2);
    expect(screen.queryByText("0 tokens")).toBeNull();
  });

  it("marks open tickets as overdue, but not finished ones", async () => {
    mockApi({
      tickets: [
        ticket({ id: "late", title: "Late one", dueDate: "2020-01-02T12:00:00.000Z" }),
        ticket({
          id: "done",
          title: "Done one",
          status: "DONE",
          dueDate: "2020-01-02T12:00:00.000Z",
        }),
      ],
    });
    render(<CreativeBoardPage />);
    await screen.findByText("Late one");
    expect(within(column("Backlog")).getByText("Overdue")).toBeInTheDocument();
    expect(within(column("Done")).queryByText("Overdue")).toBeNull();
  });

  it("filters by the top project menu, search and changes requested", async () => {
    mockApi({
      tickets: [
        ticket(),
        ticket({
          id: "t2",
          title: "Brochure",
          project: { id: "p2", name: "Onboarding", code: "ONB" },
          latestRevisionHasFeedback: true,
          latestRevisionFeedbackSnippet: "More contrast",
        }),
      ],
    });
    render(<CreativeBoardPage />);
    await screen.findByText("Brochure");

    const project = screen.getByRole("combobox", { name: "Filter by project" });
    fireEvent.change(project, { target: { value: "Onboarding" } });
    expect(screen.queryByText("Logo redesign")).toBeNull();
    expect(screen.getByText("Showing 1 of 2 requests")).toBeInTheDocument();
    fireEvent.change(project, { target: { value: "ALL" } });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search board" }), {
      target: { value: "web-101" },
    });
    expect(screen.queryByText("Brochure")).toBeNull();
    expect(screen.getByText("Logo redesign")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search board" }), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Changes requested/ }));
    expect(screen.queryByText("Logo redesign")).toBeNull();
    expect(screen.getByText(/More contrast/)).toBeInTheDocument();
  });

  it("focuses the search with the / shortcut", async () => {
    mockApi();
    render(<CreativeBoardPage />);
    await screen.findByText("Logo redesign");
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByRole("searchbox", { name: "Search board" })).toHaveFocus();
  });

  it("explains a failed load instead of showing empty columns", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockApi({ failList: true });
    render(<CreativeBoardPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Board is down");
    expect(screen.queryByRole("region", { name: "Backlog" })).toBeNull();
  });
});

describe("Moving tickets", () => {
  it("rejects a move the rules don't allow, without saving", async () => {
    const calls = mockApi();
    render(<CreativeBoardPage />);
    await screen.findByText("Logo redesign");
    drag("Logo redesign", "In review");
    expect(await screen.findByText(/You can only start a backlog request/)).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });

  it("saves an allowed move", async () => {
    const calls = mockApi();
    render(<CreativeBoardPage />);
    await screen.findByText("Logo redesign");
    drag("Logo redesign", "In progress");
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toMatchObject({ id: "t1", status: "IN_PROGRESS" });
    expect(await within(column("In progress")).findByText("Logo redesign")).toBeInTheDocument();
  });

  it("asks for files before sending to review, and can't send an empty version", async () => {
    const calls = mockApi({ tickets: [ticket({ status: "IN_PROGRESS" })] });
    render(<CreativeBoardPage />);
    await screen.findByText("Logo redesign");
    drag("Logo redesign", "In review");
    const send = await screen.findByRole("button", { name: "Upload & send for review" });
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(writes(calls)).toHaveLength(0);
  });

  it("never lets a creative drag a done ticket or drop one into Done", async () => {
    const calls = mockApi({
      tickets: [
        ticket({ id: "done", title: "Finished", status: "DONE" }),
        ticket({ id: "rev", title: "Waiting", status: "IN_REVIEW" }),
      ],
    });
    render(<CreativeBoardPage />);
    await screen.findByText("Finished");
    expect(screen.getByText("Finished").closest("article")).toHaveAttribute("draggable", "false");
    expect(screen.getByText("Waiting").closest("article")).toHaveAttribute("draggable", "true");
    drag("Waiting", "Done");
    expect(await screen.findByText(/From In review you can move/)).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });
});

describe("Bulk select", () => {
  it("selects by keyboard-reachable checkbox, once per click, and moves in a batch", async () => {
    const calls = mockApi();
    render(<CreativeBoardPage />);
    await screen.findByText("Logo redesign");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));

    const box = screen.getByRole("checkbox", { name: /Logo redesign/ });
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(screen.getByText("1 request selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start working" }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].url).toContain("/batch");
    expect(writes(calls)[0].body).toEqual({ ticketIds: ["t1"], status: "IN_PROGRESS" });
  });

  it("offers no checkbox on done tickets, and Escape leaves select mode", async () => {
    mockApi({ tickets: [ticket({ status: "DONE" })] });
    render(<CreativeBoardPage />);
    await screen.findByText("Logo redesign");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
  });
});

describe("Card detail", () => {
  const revision = (version: number, extra: object = {}) => ({
    version,
    submittedAt: "2026-03-02T12:00:00.000Z",
    feedbackAt: null,
    feedbackMessage: null,
    creativeMessage: null,
    assets: [],
    ...extra,
  });

  const open = async (title = "Logo redesign") => {
    render(<CreativeBoardPage />);
    await screen.findByText(title);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Open request.*${title}`) }));
    return screen.findByRole("dialog", { name: title });
  };

  it("opens from a card click as well as from the button", async () => {
    mockApi();
    render(<CreativeBoardPage />);
    const title = await screen.findByText("Logo redesign");
    fireEvent.mouseDown(title, { clientX: 5, clientY: 5 });
    fireEvent.mouseUp(title, { clientX: 5, clientY: 5 });
    expect(await screen.findByRole("dialog", { name: "Logo redesign" })).toBeInTheDocument();
  });

  it("opens on the brief when nothing has been delivered yet", async () => {
    mockApi();
    const dialog = await open();
    expect(within(dialog).getByRole("tab", { name: "Brief & files" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(dialog).getByText("Update the logo")).toBeInTheDocument();
  });

  it("opens on the current version with feedback and note, and lists versions in a tab", async () => {
    mockApi({
      tickets: [ticket({ revisionCount: 2 })],
      revisions: [
        revision(1, { feedbackMessage: "Needs more contrast" }),
        revision(2, { creativeMessage: "Second pass" }),
      ],
    });
    const dialog = await open();
    expect(await within(dialog).findByText("Version 2")).toBeInTheDocument();
    expect(within(dialog).getByText("Second pass")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Needs more contrast/)).toBeNull();

    fireEvent.click(within(dialog).getByRole("tab", { name: "Versions (2)" }));
    expect(within(dialog).getByText("Version 1")).toBeInTheDocument();
    expect(within(dialog).getByText(/Needs more contrast/)).toBeInTheDocument();
  });

  it("loads comments only in their tab, and links to the full page to add one", async () => {
    const calls = mockApi({
      comments: [
        {
          id: "c1",
          body: "Looks good",
          createdAt: "2026-03-02T12:00:00.000Z",
          author: { id: "u", name: "Ada", email: "a@b.c", role: "DESIGNER" },
        },
      ],
    });
    const dialog = await open();
    expect(calls.some((c) => c.url.includes("/comments"))).toBe(false);
    fireEvent.click(within(dialog).getByRole("tab", { name: "Comments" }));
    expect(await within(dialog).findByText("Looks good")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Add a comment/ })).toHaveAttribute(
      "href",
      "/creative/tickets/t1?from=board",
    );
    expect(writes(calls)).toHaveLength(0);
  });

  it("keeps the full page link and closes", async () => {
    mockApi();
    const dialog = await open();
    expect(within(dialog).getByRole("link", { name: /Open full page/ })).toHaveAttribute(
      "href",
      "/creative/tickets/t1?from=board",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"])(
    "gives a creative no way to approve a %s ticket",
    async (status) => {
      mockApi({ tickets: [ticket({ status })] });
      const dialog = await open();
      for (const name of [/approve/i, /mark.*done/i, /complete/i]) {
        expect(within(dialog).queryByRole("button", { name })).toBeNull();
      }
    },
  );

  it("offers upload only in progress, and pull back only in review", async () => {
    mockApi({ tickets: [ticket({ status: "IN_PROGRESS" })] });
    const dialog = await open();
    expect(within(dialog).queryByRole("button", { name: /Pull back/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload work" }));
    expect(await screen.findByRole("dialog", { name: "Logo redesign" })).toHaveTextContent(
      "Design files",
    );
  });

  it("pulls a review ticket back to in progress", async () => {
    const calls = mockApi({ tickets: [ticket({ status: "IN_REVIEW" })] });
    const dialog = await open();
    expect(within(dialog).getByText("Waiting for customer feedback")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Upload work" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: /Pull back/ }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toMatchObject({ id: "t1", status: "IN_PROGRESS" });
  });
});
