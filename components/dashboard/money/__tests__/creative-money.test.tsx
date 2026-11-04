import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CreativeBalancePage from "@/app/creative/balance/page";
import CreativeDashboardPage from "@/app/creative/page";
import CreativePortfolioPage from "@/app/creative/portfolio/page";
import CreativeWithdrawalsPage from "@/app/creative/withdrawals/page";

const showToast = vi.fn();
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ showToast }) }));

const USER = { id: "u", email: "ada@demo.com", name: "Ada Creative", role: "DESIGNER" };

function withdrawal(overrides: Record<string, unknown>) {
  return {
    id: "w1",
    amountTokens: 10,
    status: "APPROVED",
    createdAt: "2026-03-06T13:17:07.173Z",
    approvedAt: "2026-03-06T13:17:07.172Z",
    ...overrides,
  };
}

function ledgerEntry(overrides: Record<string, unknown>) {
  return {
    id: "l1",
    createdAt: "2026-03-06T13:17:06.763Z",
    direction: "CREDIT",
    amount: 10,
    reason: "JOB_COMPLETED",
    notes: "Payout for logo redesign",
    metadata: null,
    balanceBefore: null,
    balanceAfter: null,
    ticketId: null,
    companyId: null,
    ...overrides,
  };
}

function job(overrides: Record<string, unknown>) {
  return {
    id: "t1",
    title: "Logo redesign",
    description: null,
    status: "TODO",
    priority: "HIGH",
    dueDate: "2999-01-15T12:00:00.000Z",
    companyTicketNumber: 101,
    createdAt: "2026-03-06T13:17:01.721Z",
    updatedAt: "2026-03-06T13:17:01.721Z",
    company: { id: "c", name: "Acme Studio", slug: "acme" },
    project: { id: "p", name: "Web", code: "WEB" },
    jobType: null,
    ...overrides,
  };
}

const WITHDRAWAL_STATS = {
  availableBalance: 10,
  reservedTokens: 10,
  spendableBalance: 0,
  totalRequested: 10,
  pendingCount: 0,
  withdrawalsCount: 1,
  minWithdrawalTokens: 20,
};

type Options = {
  stats?: Partial<typeof WITHDRAWAL_STATS>;
  withdrawals?: ReturnType<typeof withdrawal>[];
  ledger?: ReturnType<typeof ledgerEntry>[];
  tickets?: ReturnType<typeof job>[];
  loadScore?: number;
  skills?: string[];
  failBalance?: boolean;
  failWithdrawals?: number;
  failPayoutTier?: boolean;
  portfolioItems?: unknown[];
  post?: () => Response;
};

function mockApi({
  stats,
  withdrawals = [withdrawal({})],
  ledger = [ledgerEntry({})],
  tickets = [job({})],
  loadScore = 72,
  skills = ["a"],
  failBalance = false,
  failWithdrawals,
  failPayoutTier = false,
  portfolioItems = [],
  post,
}: Options = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes("/availability")) return Response.json({ isPaused: false });
    if (url.includes("/withdrawals")) {
      if (init?.method === "POST") return post ? post() : Response.json({}, { status: 201 });
      if (init?.method === "DELETE") return Response.json({ success: true });
      if (failWithdrawals) return Response.json({ error: "Nope" }, { status: failWithdrawals });
      return Response.json({ stats: { ...WITHDRAWAL_STATS, ...stats }, withdrawals });
    }
    if (url.includes("/balance")) {
      if (failBalance) return Response.json({ error: "Balance is down" }, { status: 500 });
      return Response.json({ user: USER, balance: 10, ledger, totals: { credits: 10, debits: 0 } });
    }
    if (url.includes("/tickets")) {
      return Response.json({
        stats: {
          byStatus: { TODO: 1, IN_PROGRESS: 1, IN_REVIEW: 0, DONE: 1 },
          total: 3,
          openTotal: 2,
          byPriority: { LOW: 0, MEDIUM: 2, HIGH: 1, URGENT: 0 },
          loadScore,
        },
        tickets,
      });
    }
    if (url.includes("/payout-tier")) {
      if (failPayoutTier) return Response.json({ error: "x" }, { status: 500 });
      return Response.json({
        currentPayoutPercent: 60,
        currentTierName: null,
        basePayoutPercent: 60,
        tiers: [
          {
            id: "s",
            name: "Silver Tier",
            description: null,
            minCompletedTickets: 50,
            timeWindowDays: 90,
            payoutPercent: 65,
            completedInWindow: 0,
            qualified: false,
          },
        ],
      });
    }
    if (url.includes("/skills")) return Response.json({ selectedJobTypeIds: skills });
    if (url.includes("/portfolio")) {
      return Response.json({
        totalCount: portfolioItems.length,
        categories: ["Brand", "Motion"],
        items: portfolioItems,
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  showToast.mockClear();
});

describe("Creative overview", () => {
  it("labels balance, held and requestable amounts separately", async () => {
    mockApi({ stats: { availableBalance: 10, reservedTokens: 7, spendableBalance: 3 } });
    render(<CreativeDashboardPage />);
    const requestable = (await screen.findByText("Available to request")).closest("section")!;
    expect(within(requestable).getByText("3")).toBeInTheDocument();
    expect(within(requestable).getByText("Held for requests")).toBeInTheDocument();
    expect(within(requestable).getByText("7")).toBeInTheDocument();
    const balance = screen.getByText("Token balance").closest("section")!;
    expect(within(balance).getByText("10")).toBeInTheDocument();
  });

  it("keeps load score, payout tier, priorities, deadlines and withdrawals", async () => {
    mockApi();
    render(<CreativeDashboardPage />);
    expect(await screen.findByRole("img", { name: "Load score 72, Moderate" })).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Next: Silver Tier (65%)")).toBeInTheDocument();
    expect(screen.getByText("Priority breakdown")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Logo redesign" })).toHaveAttribute(
      "href",
      "/creative/tickets/t1",
    );
    const recent = screen.getByText("Recent withdrawals").closest("section")!;
    expect(within(recent).getByText("Approved")).toBeInTheDocument();
    expect(within(recent).queryByText("Paid")).toBeNull();
  });

  it("filters next jobs by status and leaves done work out", async () => {
    mockApi({
      tickets: [
        job({ id: "a", title: "Backlog job", status: "TODO" }),
        job({ id: "b", title: "Active job", status: "IN_PROGRESS" }),
        job({ id: "c", title: "Finished job", status: "DONE" }),
      ],
    });
    render(<CreativeDashboardPage />);
    expect(await screen.findByRole("link", { name: "Backlog job" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Finished job" })).toBeNull();
    const chips = screen.getByRole("group", { name: "Filter next jobs by status" });
    fireEvent.click(within(chips).getByRole("button", { name: /In progress/ }));
    expect(screen.getByRole("link", { name: "Active job" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Backlog job" })).toBeNull();
  });

  it("flags overdue work from the real due date", async () => {
    mockApi({ tickets: [job({ dueDate: "2020-01-02T12:00:00.000Z" })] });
    render(<CreativeDashboardPage />);
    expect(await screen.findByText(/days overdue/)).toBeInTheDocument();
    expect(screen.queryByText(/sample date/i)).toBeNull();
  });

  it("shows the setup guide to creatives with no skills", async () => {
    mockApi({ skills: [] });
    render(<CreativeDashboardPage />);
    expect(await screen.findByText("Welcome to brandbite!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Select your skills" })).toHaveAttribute(
      "href",
      "/creative/settings",
    );
  });

  it("dashes the payout rate when its optional request fails", async () => {
    mockApi({ failPayoutTier: true });
    render(<CreativeDashboardPage />);
    const card = (await screen.findByText("Current payout rate")).closest("section")!;
    expect(within(card).getByText("—")).toBeInTheDocument();
  });

  it("explains a failed load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockApi({ failBalance: true });
    render(<CreativeDashboardPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Balance is down");
  });
});

describe("Creative balance", () => {
  it("shows an unrecorded running balance as a dash, not 0", async () => {
    mockApi();
    render(<CreativeBalancePage />);
    expect((await screen.findAllByText("Not recorded")).length).toBeGreaterThan(0);
    expect(screen.getByText("Job completed")).toBeInTheDocument();
    expect(screen.getByText("+10 tokens")).toBeInTheDocument();
  });

  it("doesn't call the balance withdrawable, and links to the request page", async () => {
    mockApi();
    render(<CreativeBalancePage />);
    await screen.findAllByText("Not recorded");
    expect(screen.queryByText("Available balance")).toBeNull();
    expect(screen.getByRole("link", { name: "Request withdrawal" })).toHaveAttribute(
      "href",
      "/creative/withdrawals",
    );
  });

  it("filters activity by type and search", async () => {
    mockApi({
      ledger: [
        ledgerEntry({ id: "a" }),
        ledgerEntry({ id: "b", direction: "DEBIT", reason: "WITHDRAW", notes: "Paid out" }),
      ],
    });
    render(<CreativeBalancePage />);
    expect(await screen.findByText(/Showing 1–2 of 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Debits" }));
    expect(screen.getByText("Paid out")).toBeInTheDocument();
    expect(screen.queryByText("Payout for logo redesign")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nothing" } });
    expect(screen.getByText("No movements match these filters")).toBeInTheDocument();
  });

  it("offers CSV export only when there is activity", async () => {
    mockApi({ ledger: [] });
    render(<CreativeBalancePage />);
    expect(await screen.findByText("No token movements yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export CSV" })).toBeNull();
  });

  it("uses dashes, not zeros, when the balance can't load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockApi({ failBalance: true });
    render(<CreativeBalancePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Balance is down");
    const card = screen.getByText("Token balance").closest("section")!;
    expect(within(card).getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0")).toBeNull();
  });
});

describe("Creative withdrawals", () => {
  it("keeps balance, held and requestable figures apart, unreconciled", async () => {
    mockApi();
    render(<CreativeWithdrawalsPage />);
    const held = (await screen.findByText("Held for existing requests")).closest("section")!;
    expect(within(held).getByText("10")).toBeInTheDocument();
    const available = screen.getByText("Available to request").closest("section")!;
    expect(within(available).getByText("0")).toBeInTheDocument();
    const pending = screen.getByText("Pending approval").closest("section")!;
    expect(within(pending).getByText("0")).toBeInTheDocument();
  });

  it("never shows Approved as Paid", async () => {
    mockApi();
    render(<CreativeWithdrawalsPage />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Approved")).toBeInTheDocument();
    expect(within(table).getByText("Not paid yet")).toBeInTheDocument();
    expect(within(table).queryByText("Paid")).toBeNull();
    expect(screen.getAllByText("Approval and payout are separate steps.").length).toBeGreaterThan(
      0,
    );
  });

  it("blocks the form when nothing can reach the minimum, and says why", async () => {
    mockApi({ stats: { spendableBalance: 9, reservedTokens: 5, availableBalance: 14 } });
    render(<CreativeWithdrawalsPage />);
    expect(
      await screen.findByText("You can request 9 tokens, below the 20 tokens minimum."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit withdrawal request" })).toBeDisabled();
    expect(screen.getByLabelText("Amount (tokens)")).toBeDisabled();
  });

  it("rejects an invalid amount without calling the API", async () => {
    const fetchSpy = mockApi({ stats: { spendableBalance: 100 } });
    render(<CreativeWithdrawalsPage />);
    const submit = await screen.findByRole("button", { name: "Submit withdrawal request" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Amount (tokens)"), { target: { value: "0" } });
    // Submit directly: a click would stop at the browser's own min={1} check.
    fireEvent.submit(submit.closest("form")!);
    expect(await screen.findByText("Please enter a valid token amount.")).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("posts a valid amount and confirms it", async () => {
    const fetchSpy = mockApi({ stats: { spendableBalance: 100 } });
    render(<CreativeWithdrawalsPage />);
    const submit = await screen.findByRole("button", { name: "Submit withdrawal request" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Amount (tokens)"), { target: { value: "50" } });
    fireEvent.click(submit);
    expect(await screen.findByText("Withdrawal request created successfully.")).toBeInTheDocument();
    const post = fetchSpy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[1]?.body).toBe(JSON.stringify({ amountTokens: 50 }));
    expect(showToast).toHaveBeenCalledWith({
      type: "success",
      title: "Withdrawal request created.",
    });
  });

  it("shows the server's reason when a request is refused", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockApi({
      stats: { spendableBalance: 100 },
      post: () =>
        Response.json({ error: "Minimum withdrawal amount is 20 tokens." }, { status: 400 }),
    });
    render(<CreativeWithdrawalsPage />);
    const submit = await screen.findByRole("button", { name: "Submit withdrawal request" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Amount (tokens)"), { target: { value: "5" } });
    fireEvent.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Minimum withdrawal amount is 20 tokens.",
    );
  });

  it("lets only pending requests be cancelled", async () => {
    const fetchSpy = mockApi({
      withdrawals: [
        withdrawal({ id: "p", status: "PENDING", amountTokens: 5, approvedAt: null }),
        withdrawal({ id: "a", status: "APPROVED" }),
      ],
    });
    render(<CreativeWithdrawalsPage />);
    expect(await screen.findAllByRole("button", { name: /Cancel withdrawal/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel withdrawal of 5 tokens" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({ type: "success", title: "Withdrawal cancelled." }),
    );
    const del = fetchSpy.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(del?.[1]?.body).toBe(JSON.stringify({ id: "p" }));
  });

  it("filters history by status", async () => {
    mockApi({
      withdrawals: [
        withdrawal({ id: "p", status: "PAID", amountTokens: 30 }),
        withdrawal({ id: "a", status: "APPROVED", amountTokens: 40 }),
      ],
    });
    render(<CreativeWithdrawalsPage />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /^Paid/ }));
    const table = screen.getByRole("table");
    expect(within(table).getByText("30 tokens")).toBeInTheDocument();
    expect(within(table).queryByText("40 tokens")).toBeNull();
  });

  it("keeps the permission message and dashes when loading is refused", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockApi({ failWithdrawals: 403 });
    render(<CreativeWithdrawalsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You do not have permission to view creative withdrawals.",
    );
    const card = screen.getByText("Available to request").closest("section")!;
    expect(within(card).getByText("—")).toBeInTheDocument();
  });
});

describe("Creative portfolio", () => {
  function item(overrides: Record<string, unknown>) {
    return {
      ticketId: "t1",
      code: "WEB-105",
      title: "Brand strategy deck",
      completedAt: "2026-03-05T13:17:01.720Z",
      companyName: "Acme Studio",
      projectName: "Website revamp",
      jobType: { id: "j", name: "Deck", category: "Brand" },
      thumbnails: [],
      ...overrides,
    };
  }

  it("filters by search and category, and says when nothing matches", async () => {
    mockApi({
      portfolioItems: [
        item({}),
        item({
          ticketId: "t2",
          title: "Explainer",
          jobType: { id: "m", name: "Video", category: "Motion" },
        }),
      ],
    });
    render(<CreativePortfolioPage />);
    expect(await screen.findByText("Brand strategy deck")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by category"), { target: { value: "Motion" } });
    expect(screen.queryByText("Brand strategy deck")).toBeNull();
    expect(screen.getByText("Explainer")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText("No work matches this filter")).toBeInTheDocument();
  });

  it("links to the job in grid and list views", async () => {
    mockApi({ portfolioItems: [item({})] });
    render(<CreativePortfolioPage />);
    expect(await screen.findByRole("link", { name: /Brand strategy deck/ })).toHaveAttribute(
      "href",
      "/creative/tickets/t1",
    );
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("link", { name: "Brand strategy deck" })).toHaveAttribute(
      "href",
      "/creative/tickets/t1",
    );
  });

  it("explains an empty portfolio", async () => {
    mockApi({ portfolioItems: [] });
    render(<CreativePortfolioPage />);
    expect(await screen.findByText(/haven't completed any tickets yet/)).toBeInTheDocument();
  });
});
