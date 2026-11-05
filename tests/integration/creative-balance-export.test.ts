// -----------------------------------------------------------------------------
// @file: tests/integration/creative-balance-export.test.ts
// @purpose: The creative CSV against a real Postgres: the full history, only the
//           creative's own rows, filters applied, and formulas neutralised.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));

import { prisma } from "@/lib/prisma";
import { GET as exportBalance } from "@/app/api/creative/balance/export/route";
import { resetDatabase } from "./helpers/db";
import { createCompany, createUser } from "./helpers/fixtures";

function req(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost/api/creative/balance/export?${query}`);
}

async function exportRows(params: Record<string, string> = {}) {
  const res = await exportBalance(req(params));
  expect(res.status).toBe(200);
  const text = await res.text();
  return { res, lines: text.trim().split("\r\n") };
}

async function seed(
  userId: string | null,
  rows: {
    direction?: "CREDIT" | "DEBIT";
    amount?: number;
    reason?: string;
    notes?: string;
    createdAt?: string;
    companyId?: string;
  }[],
) {
  await prisma.tokenLedger.createMany({
    data: rows.map((row) => ({
      userId,
      companyId: row.companyId,
      direction: row.direction ?? "CREDIT",
      amount: row.amount ?? 1,
      reason: row.reason,
      notes: row.notes,
      createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
    })),
  });
}

let creativeId: string;

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();
  const creative = await createUser({ role: "DESIGNER" });
  creativeId = creative.id;
  mockGetUser.mockResolvedValue({ id: creative.id, role: "DESIGNER" });
});

describe("GET /api/creative/balance/export", () => {
  it("is 401 without a session", async () => {
    const err: Error & { code?: string } = new Error("UNAUTHENTICATED");
    err.code = "UNAUTHENTICATED";
    mockGetUser.mockRejectedValue(err);
    expect((await exportBalance(req())).status).toBe(401);
  });

  it.each(["CUSTOMER", "SITE_ADMIN", "SITE_OWNER"])("is 403 for %s", async (role) => {
    mockGetUser.mockResolvedValue({ id: "u", role });
    expect((await exportBalance(req())).status).toBe(403);
  });

  it("goes past the 50 rows on screen and past a batch, newest first", async () => {
    await seed(
      creativeId,
      Array.from({ length: 501 }, (_, i) => ({
        amount: i + 1,
        createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(),
      })),
    );

    const { lines } = await exportRows();
    const amounts = lines.slice(1).map((line) => Number(line.split(",")[2]));

    expect(amounts).toHaveLength(501);
    expect(amounts[0]).toBe(501);
    expect(amounts[500]).toBe(1);
    expect(new Set(amounts).size).toBe(501);
  });

  it("holds only this creative's rows, never another's or a company's", async () => {
    const other = await createUser({ role: "DESIGNER" });
    const company = await createCompany();
    await seed(creativeId, [{ reason: "JOB_PAYMENT", notes: "mine", companyId: company.id }]);
    await seed(other.id, [{ reason: "JOB_PAYMENT", notes: "theirs" }]);
    await seed(null, [{ reason: "TOKEN_TOPUP", notes: "company", companyId: company.id }]);

    const { lines } = await exportRows();

    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"mine"');
  });

  it("keeps a search from reaching other people's rows", async () => {
    const other = await createUser({ role: "DESIGNER" });
    await seed(creativeId, [{ notes: "logo mine" }]);
    await seed(other.id, [{ notes: "logo theirs" }]);

    const { lines } = await exportRows({ q: "logo" });

    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"logo mine"');
  });

  it("applies the type, and searches reason labels and notes", async () => {
    await seed(creativeId, [
      { direction: "CREDIT", reason: "JOB_PAYMENT", notes: "Logo" },
      { direction: "DEBIT", reason: "WITHDRAW", notes: "Paid out" },
    ]);

    const debits = await exportRows({ direction: "DEBIT" });
    expect(debits.lines).toHaveLength(2);
    expect(debits.lines[1]).toContain('"Paid out"');

    const byLabel = await exportRows({ q: "job payment" });
    expect(byLabel.lines).toHaveLength(2);
    expect(byLabel.lines[1]).toContain('"Logo"');

    const byNote = await exportRows({ q: "paid out" });
    expect(byNote.lines).toHaveLength(2);
  });

  it("neutralises formulas in notes", async () => {
    await seed(creativeId, [{ notes: '=HYPERLINK("http://x")' }]);
    const { lines } = await exportRows();
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it("rejects bad filters before starting a download", async () => {
    const res = await exportBalance(req({ direction: "SIDEWAYS" }));
    expect(res.status).toBe(400);
  });
});
