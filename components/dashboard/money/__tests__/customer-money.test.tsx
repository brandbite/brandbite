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
  failExport = false,
}: {
  services?: ReturnType<typeof service>[];
  ledger?: ReturnType<typeof entry>[];
  balance?: number;
  companyRole?: string;
  failServices?: boolean;
  failTokens?: boolean;
  failExport?: boolean;
} = {}) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/settings")) return Response.json({ user: { companyRole } });
    if (url.includes("/services")) {
      if (failServices) return Response.json({ error: "Catalog is down" }, { status: 500 });
      return Response.json({ services, categories: [] });
    }
    if (url.includes("/export")) {
      if (failExport) return Response.json({ error: "Export is down" }, { status: 500 });
      return new Response("csv");
    }
    if (failTokens) return Response.json({ error: "Ledger is down" }, { status: 500 });

    // Filters and paging happen on the server, so the mock does them too.
    const params = new URL(url, "http://localhost").searchParams;
    const direction = params.get("direction");
    const q = params.get("q")?.toLowerCase();
    const matching = ledger.filter(
      (row) =>
        (!direction || row.direction === direction) &&
        (!q || String(row.reason).toLowerCase().includes(q)),
    );
    const pageSize = Number(params.get("pageSize") ?? 50);
    const page = Number(params.get("page") ?? 1);
    return Response.json({
      company: { id: "c", name: "Acme Studio", slug: "acme", tokenBalance: balance },
      stats: { totalCredits: 1116565638, totalDebits: 1116565873 },
      ledger: matching.slice((page - 1) * pageSize, page * pageSize),
      pagination: {
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(matching.length / pageSize)),
        total: matching.length,
      },
    });
  });
}

function tokenRequests(path = "/api/customer/tokens?") {
  return vi
    .mocked(globalThis.fetch)
    .mock.calls.map(([input]) => String(input))
    .filter((url) => url.includes(path));
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
  it("labels the totals as all-time and shows them in full", async () => {
    mockApi();
    render(<CustomerTokensPage />);
    expect(await screen.findByText("1,116,565,638")).toBeInTheDocument();
    expect(screen.getByText("1,116,565,873")).toBeInTheDocument();
    expect(screen.getByText("All-time credits")).toBeInTheDocument();
    expect(screen.getByText("All-time debits")).toBeInTheDocument();
    expect(screen.queryByText(/50 most recent/)).toBeNull();
  });

  it("asks the server for each page and resets to page one when filtering", async () => {
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
    expect(await screen.findByText(/Showing 7–8 of 8/)).toBeInTheDocument();
    expect(tokenRequests().at(-1)).toContain("page=2");
    fireEvent.click(screen.getByRole("button", { name: "Debits" }));
    expect(await screen.findByText(/Showing 1–1 of 1/)).toBeInTheDocument();
    expect(tokenRequests().at(-1)).toContain("direction=DEBIT");
    expect(tokenRequests().at(-1)).toContain("page=1");
  });

  it("searches on the server after a pause in typing", async () => {
    mockApi({ ledger: [entry({ id: "a" }), entry({ id: "b", reason: "TOKEN_TOPUP" })] });
    render(<CustomerTokensPage />);
    await screen.findByText(/Showing 1–2 of 2/);
    const before = tokenRequests().length;
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "t" } });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "topup" } });
    expect(await screen.findByText(/Showing 1–1 of 1/)).toBeInTheDocument();
    expect(tokenRequests().length).toBe(before + 1);
    expect(tokenRequests().at(-1)).toContain("q=topup");
  });

  it("explains an empty ledger and an empty search differently", async () => {
    mockApi({ ledger: [] });
    render(<CustomerTokensPage />);
    expect(await screen.findByText("No token movements yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Debits" }));
    expect(await screen.findByText("No movements match these filters")).toBeInTheDocument();
  });

  it("sends a date range as the customer's local days, end day included", async () => {
    mockApi();
    render(<CustomerTokensPage />);
    await screen.findByText(/Showing 1–1 of 1/);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-31" } });
    await vi.waitFor(() => expect(tokenRequests().at(-1)).toContain("to="));
    const params = new URL(tokenRequests().at(-1)!, "http://localhost").searchParams;
    expect(params.get("from")).toBe(new Date(2026, 2, 1).toISOString());
    expect(params.get("to")).toBe(new Date(2026, 3, 1).toISOString());
  });

  it("doesn't request or export a backwards date range", async () => {
    mockApi();
    render(<CustomerTokensPage />);
    await screen.findByText(/Showing 1–1 of 1/);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-31" } });
    await vi.waitFor(() => expect(tokenRequests().at(-1)).toContain("from="));
    const before = tokenRequests().length;
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-01" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/on or before the end date/);
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
    expect(tokenRequests().length).toBe(before);
  });

  it("exports with the filters on screen", async () => {
    mockApi();
    const createUrl = vi.fn(() => "blob:ledger");
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<CustomerTokensPage />);
    await screen.findByText(/Showing 1–1 of 1/);
    fireEvent.click(screen.getByRole("button", { name: "Credits" }));
    await screen.findByText(/Showing 1–1 of 1/);
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
    const [url] = tokenRequests("/export");
    expect(url).toContain("direction=CREDIT");
    expect(url).not.toContain("page");
    expect(createUrl).toHaveBeenCalledOnce();
  });

  it("explains a failed export and keeps the ledger on screen", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockApi({ failExport: true });
    render(<CustomerTokensPage />);
    await screen.findByText(/Showing 1–1 of 1/);
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Export is down");
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
