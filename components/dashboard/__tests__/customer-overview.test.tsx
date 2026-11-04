import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CustomerOverviewPage from "@/app/customer/page";

function ticket(overrides: Record<string, unknown>) {
  return {
    id: "t1",
    title: "Logo redesign",
    status: "TODO",
    dueDate: "2999-01-15T12:00:00.000Z",
    companyTicketNumber: 1,
    project: { id: "p1", name: "Web", code: "WEB" },
    ...overrides,
  };
}

function mockApi({
  balance = 3,
  companyRole = "OWNER",
  tickets = [ticket({})],
  plan = { id: "pl", name: "Full", monthlyTokens: 400, priceCents: 199900, isActive: true },
  failBoard = false,
}: {
  balance?: number;
  companyRole?: string;
  tickets?: ReturnType<typeof ticket>[];
  plan?: object | null;
  failBoard?: boolean;
} = {}) {
  const byStatus = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 } as Record<string, number>;
  tickets.forEach((t) => (byStatus[t.status as string] += 1));
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/settings")) {
      return Response.json({
        user: { id: "u", email: "a@b.c", name: "A", companyRole },
        company: {
          id: "c",
          name: "Acme Studio",
          slug: "acme",
          counts: { members: 3, projects: 2, tickets: tickets.length },
        },
        plan,
      });
    }
    if (url.includes("/tokens")) {
      return Response.json({
        company: { tokenBalance: balance },
        stats: { totalCredits: 1116565638, totalDebits: 1116565873 },
      });
    }
    if (failBoard) return Response.json({ error: "Board is down" }, { status: 500 });
    return Response.json({ stats: { byStatus, total: tickets.length }, tickets });
  });
}

afterEach(() => vi.restoreAllMocks());

describe("Customer overview", () => {
  it("shows the balance, and long ledger totals in full", async () => {
    mockApi({ balance: 3 });
    render(<CustomerOverviewPage />);
    expect(await screen.findByText("Low balance")).toBeInTheDocument();
    expect(screen.getByText("1,116,565,638")).toBeInTheDocument();
    expect(screen.getByText("1,116,565,873")).toBeInTheDocument();
  });

  it("flags low balance only under the admin threshold", async () => {
    mockApi({ balance: 5 });
    render(<CustomerOverviewPage />);
    await screen.findByText("Token activity");
    expect(screen.queryByText("Low balance")).toBeNull();
  });

  it("offers the request that needs review, and counts several", async () => {
    mockApi({
      tickets: [
        ticket({ id: "a", title: "Motion", status: "IN_REVIEW" }),
        ticket({ id: "b", title: "Deck", status: "IN_REVIEW" }),
      ],
    });
    render(<CustomerOverviewPage />);
    expect(await screen.findByText("2 requests need your review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review request/ })).toHaveAttribute(
      "href",
      "/customer/tickets/a",
    );
  });

  it("hides the review prompt when nothing needs review", async () => {
    mockApi();
    render(<CustomerOverviewPage />);
    await screen.findByText("Token activity");
    expect(screen.queryByText("Needs your review")).toBeNull();
  });

  it("marks overdue requests and leaves done ones out of upcoming", async () => {
    mockApi({
      tickets: [
        ticket({ id: "late", title: "Late one", dueDate: "2020-01-02T12:00:00.000Z" }),
        ticket({ id: "done", title: "Done one", status: "DONE" }),
      ],
    });
    render(<CustomerOverviewPage />);
    expect(await screen.findByText(/Overdue/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Late one" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Done one" })).toBeNull();
  });

  it("follows the company role for creating and managing", async () => {
    mockApi({ companyRole: "BILLING" });
    const { unmount } = render(<CustomerOverviewPage />);
    await screen.findByText("Token activity");
    expect(screen.queryByRole("link", { name: "+ New request" })).toBeNull();
    expect(screen.getByRole("link", { name: "Manage plan" })).toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();

    mockApi({ companyRole: "OWNER" });
    render(<CustomerOverviewPage />);
    expect(await screen.findByRole("link", { name: "+ New request" })).toHaveAttribute(
      "href",
      "/customer/tickets/new",
    );
  });

  it("says when there is no plan rather than showing empty numbers", async () => {
    mockApi({ plan: null });
    render(<CustomerOverviewPage />);
    expect(await screen.findByText(/No plan is assigned yet/)).toBeInTheDocument();
  });

  it("explains a failed load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockApi({ failBoard: true });
    render(<CustomerOverviewPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Board is down");
  });
});
