// -----------------------------------------------------------------------------
// @file: lib/customer-token-ledger.ts
// @purpose: What the customer ledger list and its CSV export share: who may read
//           it, which rows belong to it, and how filters are read.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { LedgerDirection, type Prisma } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { formatLedgerReason } from "@/lib/ledger-reason";
import { prisma } from "@/lib/prisma";
import { buildTicketCode } from "@/lib/ticket-code";

const MAX_SEARCH_LENGTH = 200;
const MAX_INT = 2_147_483_647;

export type LedgerFilters = {
  direction?: LedgerDirection;
  /** Inclusive. */
  from?: Date;
  /** Exclusive, so a client can send the next local midnight as the end of a day. */
  to?: Date;
  q?: string;
};

export const LEDGER_INCLUDE = {
  ticket: {
    select: {
      id: true,
      companyTicketNumber: true,
      project: { select: { code: true } },
    },
  },
} satisfies Prisma.TokenLedgerInclude;

type LedgerRow = Prisma.TokenLedgerGetPayload<{ include: typeof LEDGER_INCLUDE }>;

export function ledgerTicketCode(entry: LedgerRow): string | null {
  if (!entry.ticket) return null;
  return buildTicketCode({
    projectCode: entry.ticket.project?.code,
    companyTicketNumber: entry.ticket.companyTicketNumber,
    ticketId: entry.ticket.id,
  });
}

/**
 * The signed-in customer's company, or the error response to return instead.
 * A missing session still throws UNAUTHENTICATED for the route to handle.
 */
export async function resolveCustomerCompany() {
  const user = await getCurrentUserOrThrow();

  if (user.role !== "CUSTOMER") {
    return {
      response: NextResponse.json(
        { error: "Only customers can access token balance" },
        { status: 403 },
      ),
    };
  }

  if (!user.activeCompanyId) {
    return {
      response: NextResponse.json({ error: "User has no active company" }, { status: 400 }),
    };
  }

  const company = await prisma.company.findUnique({ where: { id: user.activeCompanyId } });

  if (!company) {
    return {
      response: NextResponse.json({ error: "Company not found for current user" }, { status: 404 }),
    };
  }

  return { company };
}

/**
 * Company ledger only. Creative payout rows (JOB_PAYMENT) carry the ticket's
 * companyId AND a userId. They belong to the creative's balance, not the
 * company's. Without userId: null they'd show up in the customer's ledger and
 * inflate the credits total, disagreeing with the stored company.tokenBalance.
 * Matches recalculateCompanyTokenBalance and admin/token-analytics.
 */
export function companyLedgerScope(companyId: string) {
  return { companyId, userId: null } satisfies Prisma.TokenLedgerWhereInput;
}

export function parseLedgerFilters(
  params: URLSearchParams,
): { filters: LedgerFilters } | { error: string } {
  const filters: LedgerFilters = {};

  const direction = params.get("direction");
  if (direction) {
    if (direction !== LedgerDirection.CREDIT && direction !== LedgerDirection.DEBIT) {
      return { error: "direction must be CREDIT or DEBIT" };
    }
    filters.direction = direction;
  }

  for (const key of ["from", "to"] as const) {
    const raw = params.get(key);
    if (!raw) continue;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return { error: `${key} must be a valid date` };
    filters[key] = date;
  }

  if (filters.from && filters.to && filters.from >= filters.to) {
    return { error: "from must be before to" };
  }

  const q = params.get("q")?.trim().slice(0, MAX_SEARCH_LENGTH);
  if (q) filters.q = q;

  return { filters };
}

/** % and _ are wildcards inside Prisma's contains; a search should mean them literally. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

/** Matches the code shown on screen: WEB-102, #102, 102, WEB, or a raw ticket id. */
function ticketSearch(q: string): Prisma.TicketWhereInput[] {
  const text = (contains: string) =>
    ({ project: { is: { code: { contains, mode: "insensitive" } } } }) as const;

  const code = q.match(/^([^\s-]+)-(\d+)$/);
  const number = code ? Number(code[2]) : /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;

  if (number !== null && number > MAX_INT) return [{ id: q }];
  if (code) return [{ companyTicketNumber: number, ...text(escapeLike(code[1])) }, { id: q }];
  if (number !== null) return [{ companyTicketNumber: number }, { id: q }];
  return [text(escapeLike(q)), { id: q }];
}

export async function buildLedgerWhere(
  companyId: string,
  filters: LedgerFilters,
): Promise<Prisma.TokenLedgerWhereInput> {
  const where: Prisma.TokenLedgerWhereInput = { ...companyLedgerScope(companyId) };

  if (filters.direction) where.direction = filters.direction;

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lt: filters.to } : {}),
    };
  }

  if (filters.q) {
    const needle = filters.q.toLowerCase();

    // Reasons are stored as codes but read as labels, so "token top-up" has to
    // find TOKEN_TOPUP. The database can't match on the label, so check this
    // company's reasons here and filter on the ones that match.
    const reasons = await prisma.tokenLedger.findMany({
      where: companyLedgerScope(companyId),
      distinct: ["reason"],
      select: { reason: true },
    });
    const matching = reasons
      .map((r) => r.reason)
      .filter(
        (reason): reason is string =>
          !!reason &&
          (reason.toLowerCase().includes(needle) ||
            formatLedgerReason(reason).toLowerCase().includes(needle)),
      );

    where.OR = [
      { reason: { in: matching } },
      { notes: { contains: escapeLike(filters.q), mode: "insensitive" } },
      ...ticketSearch(filters.q).map((ticket) => ({ ticket: { is: ticket } })),
    ];
  }

  return where;
}
