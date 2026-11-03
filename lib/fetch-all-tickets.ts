// -----------------------------------------------------------------------------
// @file: lib/fetch-all-tickets.ts
// @purpose: Client helper for views that show every ticket at once (the
//           customer and creative boards, the creative table). The ticket
//           list APIs page at 50 by default (max 200), and these views used
//           to call them once with no limit — so anything past the 50 most
//           recent tickets silently disappeared. This walks the pages.
// -----------------------------------------------------------------------------

type PagedTicketsResponse = {
  tickets: unknown[];
  pagination?: { hasMore?: boolean };
};

const PAGE_SIZE = 200;
/** Safety stop: 10 pages = 2000 tickets. */
const MAX_PAGES = 10;

/**
 * Fetches every page of `path` (e.g. "/api/customer/tickets") and returns the
 * first page's body with `tickets` replaced by all tickets. Throws on a
 * non-OK response with the server's error text, like the callers did before.
 */
export async function fetchAllTickets<T extends PagedTicketsResponse>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let first: T | null = null;
  const all: T["tickets"] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${path}${sep}limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`, {
      cache: "no-store",
      ...init,
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      const error = new Error(json?.error || `Request failed with status ${res.status}`);
      (error as Error & { status?: number }).status = res.status;
      throw error;
    }
    const json = (await res.json()) as T;
    if (!first) first = json;
    all.push(...json.tickets);
    if (!json.pagination?.hasMore) break;
  }

  return { ...(first as T), tickets: all };
}
