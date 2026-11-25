import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CustomerHomePage from "@/app/customer/page";

function ticket(overrides: Record<string, unknown>) {
  return {
    id: "t1",
    title: "Logo redesign",
    status: "TODO",
    dueDate: "2999-01-15T12:00:00.000Z",
    createdAt: "2026-11-01T12:00:00.000Z",
    updatedAt: "2026-11-20T12:00:00.000Z",
    companyTicketNumber: 1,
    project: { id: "p1", name: "Web", code: "WEB" },
    jobType: null,
    ...overrides,
  };
}

const STEPS = [
  { key: "colors", label: "Brand colors", done: true, action: { label: "x", href: "/x" } },
  {
    key: "logo",
    label: "Logo files",
    done: false,
    action: { label: "Upload your logo", href: "/customer/brand" },
  },
];

function mockApi({
  balance = 30,
  companyRole = "OWNER",
  tickets = [ticket({})],
  drafts = [] as object[],
  moodboards = [] as object[],
  thumbnails = {} as Record<string, string>,
  brandProfile = false,
  storage = "CONNECTED",
  canManageStorage = true,
  recap = null as object | null,
  failBoard = false,
  failExtras = false,
}: {
  balance?: number;
  companyRole?: string;
  tickets?: ReturnType<typeof ticket>[];
  drafts?: object[];
  moodboards?: object[];
  thumbnails?: Record<string, string>;
  brandProfile?: boolean;
  storage?: "CONNECTED" | "NOT_CONNECTED" | "BROKEN";
  canManageStorage?: boolean;
  recap?: object | null;
  failBoard?: boolean;
  failExtras?: boolean;
} = {}) {
  const byStatus = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 } as Record<string, number>;
  tickets.forEach((t) => (byStatus[t.status as string] += 1));
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/settings")) {
      return Response.json({
        user: { id: "u", email: "a@b.c", name: "Ada Lovelace", companyRole },
      });
    }
    if (url.includes("/tokens")) return Response.json({ company: { tokenBalance: balance } });
    if (url.includes("/ticket-drafts")) {
      return failExtras ? Response.json({}, { status: 500 }) : Response.json({ drafts });
    }
    if (url.includes("/moodboards")) {
      return failExtras ? Response.json({}, { status: 500 }) : Response.json({ moodboards });
    }
    if (url.includes("/customer/tickets")) {
      if (failExtras) return Response.json({}, { status: 500 });
      return Response.json({
        tickets: Object.entries(thumbnails).map(([id, thumbnailUrl]) => ({ id, thumbnailUrl })),
      });
    }
    if (url.includes("/board")) {
      if (failBoard) return Response.json({ error: "Board is down" }, { status: 500 });
      return Response.json({ stats: { byStatus, total: tickets.length }, tickets });
    }
    if (url.includes("/brand-profile")) {
      return Response.json(
        brandProfile
          ? { enabled: true, profile: { percent: 50, steps: STEPS } }
          : { enabled: false },
      );
    }
    if (url.includes("/integrations")) {
      return Response.json({
        canManage: canManageStorage,
        integrations: [
          {
            provider: "GOOGLE_DRIVE",
            label: "Google Drive",
            slug: "google-drive",
            available: true,
            status: storage,
          },
          {
            provider: "DROPBOX",
            label: "Dropbox",
            slug: "dropbox",
            available: true,
            status: "NOT_CONNECTED",
          },
        ],
      });
    }
    if (url.includes("/monthly-recap")) {
      return Response.json(recap ? { enabled: true, recap } : { enabled: false });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

afterEach(() => vi.restoreAllMocks());

describe("Customer home", () => {
  it("greets by first name with open requests and the balance", async () => {
    mockApi({ tickets: [ticket({}), ticket({ id: "d", status: "DONE" })] });
    render(<CustomerHomePage />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/, Ada\.$/);
    expect(screen.getByRole("link", { name: "1 open request" })).toHaveAttribute(
      "href",
      "/customer/board",
    );
    expect(screen.getByText("30 tokens left")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Balance" })).toHaveAttribute(
      "href",
      "/customer/tokens",
    );
  });

  it("flags low balance only under the admin threshold", async () => {
    mockApi({ balance: 5 });
    const { unmount } = render(<CustomerHomePage />);
    await screen.findByText("5 tokens left");
    expect(screen.queryByText("Tokens are running low")).toBeNull();
    unmount();
    vi.restoreAllMocks();

    mockApi({ balance: 3 });
    render(<CustomerHomePage />);
    expect(await screen.findByText("3 tokens left · Low balance")).toBeInTheDocument();
    expect(screen.getByText("Tokens are running low")).toBeInTheDocument();
  });

  it("lists what needs attention, the review first, with the request's picture", async () => {
    mockApi({
      tickets: [
        ticket({ id: "late", title: "Late one", dueDate: "2020-01-02T12:00:00.000Z" }),
        ticket({ id: "rev", title: "Motion", status: "IN_REVIEW" }),
        ticket({ id: "done", title: "Done one", status: "DONE", dueDate: "2020-01-02T12:00:00Z" }),
      ],
      drafts: [{ id: "d1", title: "Packaging", updatedAt: "2026-11-20T12:00:00.000Z" }],
      thumbnails: { rev: "https://files.test/rev.png" },
    });
    render(<CustomerHomePage />);
    const section = (await screen.findByRole("heading", { name: "Needs your attention" })).closest(
      "section",
    )!;
    const rows = within(section).getAllByRole("listitem");
    expect(rows.map((row) => within(row).getByRole("link").getAttribute("href"))).toEqual([
      "/customer/tickets/rev",
      "/customer/tickets/late",
      "/customer/tickets/new?draft=d1",
    ]);
    expect(within(rows[0]).getByText("Ready for review")).toBeInTheDocument();
    expect(rows[0].querySelector("img")).toHaveAttribute("src", "https://files.test/rev.png");
    expect(within(section).getByLabelText("3 items")).toBeInTheDocument();
    expect(within(section).queryByText(/Done one/)).toBeNull();
  });

  it("says so when nothing is waiting", async () => {
    mockApi();
    render(<CustomerHomePage />);
    expect(await screen.findByText("You’re all caught up")).toBeInTheDocument();
  });

  it("shows recent work, filters it to requests, and loads without the extras", async () => {
    mockApi({
      moodboards: [{ id: "m1", title: "Winter campaign", updatedAt: "2026-11-24T12:00:00.000Z" }],
    });
    const { unmount } = render(<CustomerHomePage />);
    const section = (await screen.findByRole("heading", { name: "Recent work" })).closest(
      "section",
    )!;
    const hrefs = () =>
      within(section)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"));
    expect(hrefs()).toEqual(["/customer/moodboards/m1", "/customer/tickets/t1"]);
    fireEvent.click(within(section).getByRole("button", { name: "Requests" }));
    expect(hrefs()).toEqual(["/customer/tickets/t1"]);
    unmount();
    vi.restoreAllMocks();

    mockApi({ failExtras: true });
    render(<CustomerHomePage />);
    expect(await screen.findByRole("heading", { name: "Recent work" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("links the four shortcuts", async () => {
    mockApi();
    render(<CustomerHomePage />);
    const shortcuts = await screen.findByRole("navigation", { name: "Shortcuts" });
    expect(
      within(shortcuts)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/customer/brand", "/customer/moodboards", "/customer/ai-tools", "/colors"]);
  });

  it("shows the brand setup with its next step, and offers storage", async () => {
    mockApi({ brandProfile: true, storage: "NOT_CONNECTED" });
    render(<CustomerHomePage />);
    const card = (
      await screen.findByRole("heading", { name: "Your brand, ready to create" })
    ).closest("section")!;
    expect(within(card).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(within(card).getByRole("link", { name: "Upload your logo" })).toHaveAttribute(
      "href",
      "/customer/brand",
    );
    expect(within(card).getByRole("link", { name: "Google Drive" })).toHaveAttribute(
      "href",
      "/api/customer/integrations/google-drive/connect",
    );
  });

  it("hides the brand card when the switch is off and storage is connected", async () => {
    mockApi();
    render(<CustomerHomePage />);
    await screen.findByRole("heading", { name: "Recent work" });
    expect(screen.queryByText(/ready to create/)).toBeNull();
    expect(screen.queryByText("Connect your file storage")).toBeNull();
  });

  it("asks to reconnect broken storage, and tells members who can", async () => {
    mockApi({ storage: "BROKEN" });
    const { unmount } = render(<CustomerHomePage />);
    expect(await screen.findByText("Google Drive needs reconnecting")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reconnect Google Drive" })).toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();

    mockApi({ storage: "NOT_CONNECTED", canManageStorage: false });
    render(<CustomerHomePage />);
    expect(await screen.findByText(/owner or a project manager can connect/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Google Drive" })).toBeNull();
  });

  it("sums up last month and opens the full recap on request", async () => {
    mockApi({
      recap: {
        monthKey: "2026-10",
        monthLabel: "October 2026",
        monthName: "October",
        jobsDelivered: 6,
        tokensUsed: 38,
        agencyEquivalentUsd: 2400,
      },
    });
    render(<CustomerHomePage />);
    const card = (await screen.findByRole("heading", { name: "Last month" })).closest("section")!;
    expect(within(card).getByText("October 2026")).toBeInTheDocument();
    expect(within(card).getByText("6")).toBeInTheDocument();
    expect(screen.queryByText("Monthly recap")).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "View monthly recap" }));
    expect(await screen.findByText("Monthly recap")).toBeInTheDocument();
    expect(screen.getByText("≈ $2,400")).toBeInTheDocument();
  });

  it("follows the company role for creating, reviewing and booking", async () => {
    mockApi({
      companyRole: "BILLING",
      tickets: [ticket({ id: "rev", title: "Motion", status: "IN_REVIEW" })],
    });
    const { unmount } = render(<CustomerHomePage />);
    await screen.findByText("You’re all caught up");
    expect(screen.queryByRole("link", { name: "New request" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Book a consultation" })).toBeNull();
    unmount();
    vi.restoreAllMocks();

    mockApi({ companyRole: "OWNER" });
    render(<CustomerHomePage />);
    expect(await screen.findByRole("link", { name: "New request" })).toHaveAttribute(
      "href",
      "/customer/tickets/new",
    );
    expect(screen.getByRole("link", { name: "Book a consultation" })).toHaveAttribute(
      "href",
      "/customer/consultation",
    );
  });

  it("explains a failed load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockApi({ failBoard: true });
    render(<CustomerHomePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Board is down");
  });
});
