import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CustomerServicesPage from "@/app/customer/services/page";
import CustomerTokensPage from "@/app/customer/tokens/page";

function service(overrides: Record<string, unknown>) {
  return {
    id: "s1",
    name: "Brand Deck",
    category: "Brand",
    categoryIcon: null,
    categorySortOrder: 1,
    description: "A short deck.",
    tokenCost: 18,
    estimatedHours: 18,
    hasQuantity: false,
    quantityLabel: null,
    defaultQuantity: 1,
    ...overrides,
  };
}

function entry(overrides: Record<string, unknown>) {
  return {
    id: "e1",
    createdAt: "2026-04-20T11:27:28.964Z",
    direction: "CREDIT",
    amount: 1,
    reason: "AI_REFUND",
    notes: null,
    ticketCode: null,
    balanceBefore: 2,
    balanceAfter: 3,
    ...overrides,
  };
}

function mockApi({
  services = [service({})],
  ledger = [entry({})],
  balance = 3,
  companyRole = "OWNER",
  failServices = false,
  failTokens = false,
}: {
  services?: ReturnType<typeof service>[];
  ledger?: ReturnType<typeof entry>[];
  balance?: number;
  companyRole?: string;
  failServices?: boolean;
  failTokens?: boolean;
} = {}) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/settings")) return Response.json({ user: { companyRole } });
    if (url.includes("/services")) {
      if (failServices) return Response.json({ error: "Catalog is down" }, { status: 500 });
      return Response.json({ services, categories: [] });
    }
    if (failTokens) return Response.json({ error: "Ledger is down" }, { status: 500 });
    return Response.json({
      company: { id: "c", name: "Acme Studio", slug: "acme", tokenBalance: balance },
      stats: { totalCredits: 1116565638, totalDebits: 1116565873 },
      ledger,
    });
  });
}

afterEach(() => vi.restoreAllMocks());

describe("Customer services", () => {
  const catalog = [
    service({ id: "a", name: "Archetype", category: "Brand", description: "Define it." }),
    service({ id: "b", name: "Deck", category: "Brand", tokenCost: 2, estimatedHours: null }),
    service({ id: "c", name: "Headline", category: "Copy", description: "Short words." }),
  ];

  it("lists one category at a time, not the whole catalog", async () => {
    mockApi({ services: catalog });
    render(<CustomerServicesPage />);
    expect(await screen.findByRole("row", { name: "Archetype" })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: "Headline" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Copy/ }));
    expect(screen.getByRole("row", { name: "Headline" })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: "Archetype" })).toBeNull();
  });

  it("searches the whole catalog, whatever the category", async () => {
    mockApi({ services: catalog });
    render(<CustomerServicesPage />);
    await screen.findByRole("row", { name: "Archetype" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "short words" } });
    expect(screen.getByRole("row", { name: "Headline" })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: "Archetype" })).toBeNull();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText("No services match your search")).toBeInTheDocument();
  });

  it("shows the selected service and keeps the create link's job type", async () => {
    mockApi({ services: catalog, balance: 100 });
    render(<CustomerServicesPage />);
    fireEvent.click(await screen.findByRole("row", { name: "Deck" }));
    expect(screen.getByRole("heading", { name: "Deck" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create request/ })).toHaveAttribute(
      "href",
      "/customer/tickets/new?jobTypeId=b",
    );
  });

  it("presents hours as effort, never as delivery time", async () => {
    mockApi({ services: catalog });
    render(<CustomerServicesPage />);
    expect(await screen.findByText("Estimated effort, not a delivery time")).toBeInTheDocument();
    expect(screen.queryByText(/turnaround|delivered in/i)).toBeNull();
  });

  it("warns when the balance is short, and offers top-ups only to billing roles", async () => {
    mockApi({ services: catalog, balance: 3, companyRole: "OWNER" });
    const { unmount } = render(<CustomerServicesPage />);
    expect(await screen.findByText("This service needs 18 tokens.")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Add tokens" })).toHaveAttribute(
      "href",
      "/customer/settings",
    );
    unmount();
    vi.restoreAllMocks();

    mockApi({ services: catalog, balance: 3, companyRole: "PM" });
    render(<CustomerServicesPage />);
    expect(await screen.findByText("This service needs 18 tokens.")).toBeInTheDocument();
    expect(await screen.findByText(/owner or billing manager can add/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add tokens" })).toBeNull();
  });

  it("hides the create link from roles that can't create requests", async () => {
    mockApi({ services: catalog, balance: 100, companyRole: "BILLING" });
    render(<CustomerServicesPage />);
    expect(await screen.findByText(/Your role can't create requests/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Create request/ })).toBeNull();
  });

  it("still lists services when the balance can't load, showing it as unknown", async () => {
    mockApi({ services: catalog, failTokens: true });
    render(<CustomerServicesPage />);
    await screen.findByRole("row", { name: "Archetype" });
    expect(await screen.findByText("Company balance")).toBeInTheDocument();
    expect(screen.queryByText(/needs 18 tokens/)).toBeNull();
    expect(screen.queryByText("0 tokens")).toBeNull();
  });

  it("explains a failed load", async () => {
    mockApi({ failServices: true });
    render(<CustomerServicesPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Catalog is down");
  });
});

describe("Customer tokens", () => {
  it("shows long totals in full and doesn't call them all-time", async () => {
    mockApi();
    render(<CustomerTokensPage />);
    expect(await screen.findByText("1,116,565,638")).toBeInTheDocument();
    expect(screen.getByText("1,116,565,873")).toBeInTheDocument();
    expect(screen.queryByText(/all-time/i)).toBeNull();
  });

  it("paginates the ledger and resets to page one when filtering", async () => {
    const ledger = Array.from({ length: 8 }, (_, i) =>
      entry({
        id: `e${i}`,
        amount: i + 2,
        direction: i === 7 ? "DEBIT" : "CREDIT",
        reason: "ADMIN_ADJUSTMENT",
      }),
    );
    mockApi({ ledger });
    render(<CustomerTokensPage />);
    expect(await screen.findByText(/Showing 1–6 of 8/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Showing 7–8 of 8/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Debits" }));
    expect(screen.getByText(/Showing 1–1 of 1/)).toBeInTheDocument();
  });

  it("opens the selected movement, with notes, ticket and readable reason", async () => {
    mockApi({
      ledger: [
        entry({ id: "a" }),
        entry({
          id: "b",
          direction: "DEBIT",
          amount: 5454537,
          reason: "ADMIN_ADJUSTMENT",
          notes: "Cost override",
          ticketCode: "WEB-102",
          balanceBefore: null,
          balanceAfter: null,
        }),
      ],
    });
    render(<CustomerTokensPage />);
    fireEvent.click(await screen.findByRole("row", { name: /Adjustment/ }));
    expect(screen.getByRole("heading", { name: "Adjustment" })).toBeInTheDocument();
    expect(screen.getByText("Cost override")).toBeInTheDocument();
    expect(screen.getByText("WEB-102")).toBeInTheDocument();
    // Missing balances say so, they don't become 0.
    expect(screen.getAllByText("Not recorded")).toHaveLength(2);
    expect(screen.getAllByText("−5,454,537 tokens").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(screen.queryByRole("heading", { name: "Adjustment" })).toBeNull();
  });

  it("selects rows from the keyboard", async () => {
    mockApi({ ledger: [entry({ id: "a" }), entry({ id: "b", reason: "TOKEN_TOPUP" })] });
    render(<CustomerTokensPage />);
    fireEvent.keyDown(await screen.findByRole("row", { name: /Token top-up/ }), { key: "Enter" });
    expect(screen.getByRole("heading", { name: "Token top-up" })).toBeInTheDocument();
  });

  it("shows limited access to roles that can't manage billing", async () => {
    mockApi({ companyRole: "PM" });
    render(<CustomerTokensPage />);
    expect(await screen.findByText("Limited access")).toBeInTheDocument();
  });

  it("uses dashes, not zeros, when the balance can't load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockApi({ failTokens: true });
    render(<CustomerTokensPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Ledger is down");
    const card = screen.getByText("Current balance").closest("section")!;
    expect(within(card).getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0")).toBeNull();
  });
});
