// -----------------------------------------------------------------------------
// @file: tests/integration/customer-tokens.test.ts
// @purpose: Customer ledger list and CSV export against a real Postgres: totals
//           cover the whole ledger, filters and paging narrow only the rows, and
//           no other company's or creative's rows ever appear.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));

import { prisma } from "@/lib/prisma";
import { GET as listTokens } from "@/app/api/customer/tokens/route";
import { GET as exportTokens } from "@/app/api/customer/tokens/export/route";
import { resetDatabase } from "./helpers/db";
import { createCompany, createJobType, createTicket, createUser } from "./helpers/fixtures";

function req(path: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost${path}${query ? `?${query}` : ""}`);
}

async function list(params: Record<string, string> = {}) {
  const res = await listTokens(req("/api/customer/tokens", params));
  expect(res.status).toBe(200);
  return res.json();
}

async function exportRows(params: Record<string, string> = {}) {
  const res = await exportTokens(req("/api/customer/tokens/export", params));
  expect(res.status).toBe(200);
  const text = await res.text();
  return { res, text, lines: text.trim().split("\r\n") };
}

async function seed(
  companyId: string,
  rows: {
    direction?: "CREDIT" | "DEBIT";
    amount?: number;
    reason?: string;
    notes?: string;
    createdAt?: string;
    ticketId?: string;
    userId?: string;
  }[],
) {
  await prisma.tokenLedger.createMany({
    data: rows.map((row) => ({
      companyId,
      direction: row.direction ?? "CREDIT",
      amount: row.amount ?? 1,
      reason: row.reason,
      notes: row.notes,
      ticketId: row.ticketId,
      userId: row.userId,
      createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
    })),
  });
}

let companyId: string;

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();
  const company = await createCompany({ tokenBalance: 40 });
  companyId = company.id;
  const user = await createUser({ role: "CUSTOMER" });
  mockGetUser.mockResolvedValue({ id: user.id, role: "CUSTOMER", activeCompanyId: companyId });
});

describe("GET /api/customer/tokens", () => {
  it("totals the whole ledger, not just the page it returns", async () => {
    await seed(
      companyId,
      Array.from({ length: 60 }, () => ({ direction: "CREDIT" as const, amount: 2 })),
    );
    await seed(companyId, [{ direction: "DEBIT", amount: 80 }]);

    const body = await list({ pageSize: "5" });

    expect(body.ledger).toHaveLength(5);
    expect(body.stats).toEqual({ totalCredits: 120, totalDebits: 80 });
    expect(body.pagination).toEqual({ page: 1, pageSize: 5, pageCount: 13, total: 61 });
  });

  it("keeps the totals all-time while filters narrow the rows", async () => {
    await seed(companyId, [
      { direction: "CREDIT", amount: 100, createdAt: "2026-01-10T12:00:00Z" },
      { direction: "DEBIT", amount: 30, createdAt: "2026-03-10T12:00:00Z" },
    ]);

    const body = await list({ direction: "DEBIT", from: "2026-03-01T00:00:00Z" });

    expect(body.ledger.map((e: { amount: number }) => e.amount)).toEqual([30]);
    expect(body.pagination.total).toBe(1);
    expect(body.stats).toEqual({ totalCredits: 100, totalDebits: 30 });
  });

  it("leaves out creative payouts and other companies' rows", async () => {
    const other = await createCompany();
    const creative = await createUser({ role: "DESIGNER" });
    await seed(companyId, [{ amount: 10, reason: "MINE" }]);
    await seed(companyId, [{ amount: 500, reason: "PAYOUT", userId: creative.id }]);
    await seed(other.id, [{ amount: 900, reason: "THEIRS" }]);

    const body = await list();

    expect(body.ledger.map((e: { reason: string }) => e.reason)).toEqual(["MINE"]);
    expect(body.stats.totalCredits).toBe(10);
    expect((await list({ q: "THEIRS" })).ledger).toEqual([]);
    expect((await list({ q: "PAYOUT" })).ledger).toEqual([]);
  });

  it("includes the start of the range and excludes the end", async () => {
    await seed(companyId, [
      { reason: "BEFORE", createdAt: "2026-02-28T23:59:59.999Z" },
      { reason: "AT_START", createdAt: "2026-03-01T00:00:00Z" },
      { reason: "LAST_MS", createdAt: "2026-03-01T23:59:59.999Z" },
      { reason: "AT_END", createdAt: "2026-03-02T00:00:00Z" },
    ]);

    const body = await list({ from: "2026-03-01T00:00:00Z", to: "2026-03-02T00:00:00Z" });

    expect(body.ledger.map((e: { reason: string }) => e.reason)).toEqual(["LAST_MS", "AT_START"]);
  });

  it("returns every row exactly once across pages, even with identical timestamps", async () => {
    const createdAt = "2026-03-01T00:00:00Z";
    await seed(
      companyId,
      Array.from({ length: 7 }, () => ({ createdAt })),
    );

    const seen: string[] = [];
    for (const page of ["1", "2", "3"]) {
      const body = await list({ page, pageSize: "3" });
      seen.push(...body.ledger.map((e: { id: string }) => e.id));
    }

    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
  });

  it("moves a page past the end back to the last page", async () => {
    await seed(companyId, [{}, {}, {}]);

    const body = await list({ page: "99", pageSize: "2" });

    expect(body.pagination.page).toBe(2);
    expect(body.ledger).toHaveLength(1);
  });

  it("caps pageSize and defaults to 50", async () => {
    await seed(
      companyId,
      Array.from({ length: 120 }, () => ({})),
    );

    expect((await list()).ledger).toHaveLength(50);
    expect((await list({ pageSize: "5000" })).ledger).toHaveLength(100);
  });

  describe("search", () => {
    it("finds a reason by the label shown on screen or by its code", async () => {
      await seed(companyId, [{ reason: "TOKEN_TOPUP" }, { reason: "AI_REFUND" }]);

      for (const q of ["token top-up", "TOPUP"]) {
        const body = await list({ q });
        expect(body.ledger.map((e: { reason: string }) => e.reason)).toEqual(["TOKEN_TOPUP"]);
      }
    });

    it("treats % and _ in notes as plain characters", async () => {
      await seed(companyId, [
        { reason: "A", notes: "50% off" },
        { reason: "B", notes: "nothing here" },
      ]);

      expect((await list({ q: "50%" })).ledger).toHaveLength(1);
      expect((await list({ q: "%" })).ledger).toHaveLength(1);
      expect((await list({ q: "_" })).ledger).toHaveLength(0);
    });

    it("finds a ticket by the code on screen", async () => {
      const customer = await createUser({ role: "CUSTOMER" });
      const jobType = await createJobType();
      const ticket = await createTicket({
        companyId,
        createdById: customer.id,
        jobTypeId: jobType.id,
      });
      const project = await prisma.project.create({
        data: { id: "project-web", name: "Website", code: "WEB", companyId },
      });
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { projectId: project.id, companyTicketNumber: 102 },
      });
      await seed(companyId, [{ reason: "LINKED", ticketId: ticket.id }, { reason: "OTHER" }]);

      for (const q of ["WEB-102", "web-102", "#102", "102", "WEB", ticket.id]) {
        const body = await list({ q });
        expect(body.ledger.map((e: { reason: string }) => e.reason)).toEqual(["LINKED"]);
        expect(body.ledger[0].ticketCode).toBe("WEB-102");
      }
      expect((await list({ q: "WEB-103" })).ledger).toEqual([]);
    });

    it("doesn't fail on a number too large to be a ticket number", async () => {
      await seed(companyId, [{ reason: "A" }]);
      expect((await list({ q: "99999999999999999999" })).ledger).toEqual([]);
      expect((await list({ q: "WEB-99999999999999999999" })).ledger).toEqual([]);
    });
  });

  it.each([
    [{ direction: "SIDEWAYS" }],
    [{ from: "not-a-date" }],
    [{ to: "not-a-date" }],
    [{ from: "2026-03-02T00:00:00Z", to: "2026-03-01T00:00:00Z" }],
  ])("rejects %j with a 400", async (params) => {
    const res = await listTokens(req("/api/customer/tokens", params));
    expect(res.status).toBe(400);
  });
});

describe.each([
  ["list", listTokens, "/api/customer/tokens"],
  ["export", exportTokens, "/api/customer/tokens/export"],
] as const)("authorization: %s", (_name, handler, path) => {
  it("is 401 without a session", async () => {
    const err: Error & { code?: string } = new Error("UNAUTHENTICATED");
    err.code = "UNAUTHENTICATED";
    mockGetUser.mockRejectedValue(err);
    expect((await handler(req(path))).status).toBe(401);
  });

  it("is 403 for anyone who isn't a customer", async () => {
    mockGetUser.mockResolvedValue({ id: "u", role: "DESIGNER", activeCompanyId: companyId });
    expect((await handler(req(path))).status).toBe(403);
  });

  it("is 400 without an active company", async () => {
    mockGetUser.mockResolvedValue({ id: "u", role: "CUSTOMER", activeCompanyId: null });
    expect((await handler(req(path))).status).toBe(400);
  });
});

describe("GET /api/customer/tokens/export", () => {
  it("downloads as UTF-8 CSV with a header row", async () => {
    await seed(companyId, [
      {
        direction: "DEBIT",
        amount: 5,
        reason: "TOKEN_TOPUP",
        notes: 'Über "note", ok',
        createdAt: "2026-03-01T10:00:00Z",
      },
    ]);

    const raw = await exportTokens(req("/api/customer/tokens/export"));
    // Raw bytes, because decoding the response as text strips the byte-order mark.
    const bytes = new Uint8Array(await raw.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    const { res, lines } = await exportRows();

    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("token-ledger.csv");
    expect(lines[0]).toContain('"Date (UTC)"');
    expect(lines[1]).toBe(
      '"2026-03-01T10:00:00.000Z","Debit",5,"Token top-up",,"Über ""note"", ok",,',
    );
  });

  it("exports past the batch size, newest first, with no gaps or repeats", async () => {
    await seed(
      companyId,
      Array.from({ length: 1001 }, (_, i) => ({
        amount: i + 1,
        createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(),
      })),
    );

    const { lines } = await exportRows();
    const amounts = lines.slice(1).map((line) => Number(line.split(",")[2]));

    expect(amounts).toHaveLength(1001);
    expect(amounts[0]).toBe(1001);
    expect(amounts[1000]).toBe(1);
    expect(new Set(amounts).size).toBe(1001);
  });

  it("applies the filters, and only this company's rows go in", async () => {
    const other = await createCompany();
    const creative = await createUser({ role: "DESIGNER" });
    await seed(companyId, [
      { direction: "CREDIT", reason: "KEEP", createdAt: "2026-03-01T10:00:00Z" },
      { direction: "DEBIT", reason: "WRONG_TYPE", createdAt: "2026-03-01T10:00:00Z" },
      { direction: "CREDIT", reason: "TOO_OLD", createdAt: "2026-01-01T10:00:00Z" },
      { direction: "CREDIT", reason: "PAYOUT", userId: creative.id, createdAt: "2026-03-01" },
    ]);
    await seed(other.id, [{ reason: "THEIRS", createdAt: "2026-03-01T10:00:00Z" }]);

    const { lines } = await exportRows({ direction: "CREDIT", from: "2026-02-01T00:00:00Z" });

    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Keep"');
  });

  it("neutralises formulas in notes", async () => {
    await seed(companyId, [{ reason: "A", notes: '=HYPERLINK("http://x")' }]);
    const { lines } = await exportRows();
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it("returns just the header when nothing matches", async () => {
    const { lines } = await exportRows({ q: "nothing" });
    expect(lines).toHaveLength(1);
  });

  it("rejects bad filters before starting a download", async () => {
    const res = await exportTokens(req("/api/customer/tokens/export", { from: "nope" }));
    expect(res.status).toBe(400);
  });
});
