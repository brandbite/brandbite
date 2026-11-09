import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminAuditLogPage from "@/app/admin/audit-log/page";

import { humanize, metadataRows, roleLabel, targetLabel, type AuditEntry } from "../audit-format";

// A stable toast, like the real provider's, so the page doesn't refetch on every render.
const toast = { showToast: vi.fn() };
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => toast }));
vi.mock("@/lib/hooks/use-session-role", () => ({
  useSessionRole: () => ({ isSiteOwner: true, loading: false }),
}));

const entry = (over: Partial<AuditEntry> = {}): AuditEntry => ({
  id: "entry-1",
  createdAt: "2026-11-04T14:58:57.000Z",
  action: "CONSULTATION_PRICING_EDIT",
  outcome: "SUCCESS",
  actor: { id: "user-1", email: "owner@example.com", name: "brandbite studio", role: "SITE_OWNER" },
  target: { type: "ConsultationSettings", id: "settings-1" },
  metadata: { changedFields: ["priceTokens", "durationMinutes"], enabled: true },
  errorMessage: null,
  ipAddress: "203.0.113.7",
  userAgent: "Mozilla/5.0",
  ...over,
});

function mockLog(entries: AuditEntry[], total = entries.length) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost");
    const limit = Number(url.searchParams.get("limit"));
    const offset = Number(url.searchParams.get("offset"));
    return Response.json({
      entries,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  });
}

afterEach(() => vi.restoreAllMocks());

describe("audit log formatting", () => {
  it("names targets, roles and keys the way people say them", () => {
    expect(targetLabel("UserAccount")).toBe("User");
    expect(targetLabel("ConsultationSettings")).toBe("Consultation");
    expect(targetLabel("SomethingNew")).toBe("Something new");
    expect(roleLabel("SITE_OWNER")).toBe("Site owner");
    expect(roleLabel("DESIGNER")).toBe("Creative");
    expect(humanize("changedFields")).toBe("Changed fields");
    expect(humanize("op")).toBe("Op");
  });

  it("turns metadata into rows, keeping nested values as JSON", () => {
    expect(metadataRows(null)).toBeNull();
    expect(metadataRows({})).toBeNull();
    expect(
      metadataRows({ amountTokens: 50, list: ["a", "b"], ok: false, empty: [], nested: { a: 1 } }),
    ).toEqual([
      { label: "Amount tokens", value: "50" },
      { label: "List", value: "a, b" },
      { label: "Ok", value: "No" },
      { label: "Empty", value: "—" },
      { label: "Nested", value: '{\n  "a": 1\n}', code: true },
    ]);
  });
});

describe("Audit log page", () => {
  it("lists entries with actor, action, target and outcome", async () => {
    mockLog([entry(), entry({ id: "entry-2", action: "GOOGLE_OAUTH_CONFIG_EDIT", target: null })]);
    render(<AdminAuditLogPage />);

    const table = await screen.findByRole("table", { name: "Audit log entries" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Consultation pricing edited")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Site owner")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Consultation")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Success")).toBeInTheDocument();
    expect(within(rows[1]).getByText("No target")).toBeInTheDocument();
    expect(screen.getByText("2 recorded entries")).toBeInTheDocument();
  });

  it("opens an entry's full record and closes it again", async () => {
    mockLog([entry()]);
    render(<AdminAuditLogPage />);
    fireEvent.click(await screen.findByRole("button", { name: /View details/ }));

    const dialog = screen.getByRole("dialog", { name: "Audit entry" });
    expect(within(dialog).getByText("owner@example.com")).toBeInTheDocument();
    expect(within(dialog).getByText("priceTokens, durationMinutes")).toBeInTheDocument();
    expect(within(dialog).getByText("203.0.113.7")).toBeInTheDocument();
    expect(within(dialog).getByText("settings-1")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explains why a blocked attempt was stopped", async () => {
    mockLog([entry({ outcome: "BLOCKED", errorMessage: "Only site owners can do this." })]);
    render(<AdminAuditLogPage />);
    fireEvent.click(await screen.findByRole("button", { name: /View details/ }));
    const dialog = screen.getByRole("dialog", { name: "Audit entry" });
    expect(within(dialog).getByText("Why it was blocked")).toBeInTheDocument();
    expect(within(dialog).getByText("Only site owners can do this.")).toBeInTheDocument();
  });

  it("explains the log in About audit log", async () => {
    mockLog([entry()]);
    render(<AdminAuditLogPage />);
    fireEvent.click(screen.getByRole("button", { name: "About audit log" }));
    const dialog = screen.getByRole("dialog", { name: "About audit log" });
    expect(within(dialog).getByText("Read-only history")).toBeInTheDocument();
  });

  it("pages with the chosen page size", async () => {
    const fetchMock = mockLog([entry()], 60);
    render(<AdminAuditLogPage />);
    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("limit=25&offset=25"),
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Entries per page" }), {
      target: { value: "10" },
    });
    await waitFor(() =>
      expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("limit=10&offset=0"),
    );
    expect(await screen.findByText("Page 1 of 6")).toBeInTheDocument();
  });
});
