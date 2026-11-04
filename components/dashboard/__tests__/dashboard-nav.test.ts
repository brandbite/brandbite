import { describe, expect, it } from "vitest";

import {
  getDashboardBreadcrumb,
  getDashboardNav,
  getDashboardPageIndex,
  isDashboardLeafActive,
} from "../dashboard-nav";

describe("getDashboardBreadcrumb", () => {
  it("names the workspace and the page for each role", () => {
    expect(getDashboardBreadcrumb("customer", "/customer")).toEqual([
      "Customer workspace",
      "Overview",
    ]);
    expect(getDashboardBreadcrumb("creative", "/creative/balance")).toEqual([
      "Creative workspace",
      "Balance",
    ]);
  });

  it("prefers the longest matching page and marks details", () => {
    expect(getDashboardBreadcrumb("customer", "/customer/tickets/new")).toEqual([
      "Customer workspace",
      "New request",
    ]);
    expect(getDashboardBreadcrumb("customer", "/customer/tickets/abc")).toEqual([
      "Customer workspace",
      "Tickets",
      "Detail",
    ]);
  });
});

describe("getDashboardPageIndex", () => {
  it("lists a role's own pages without repeats", () => {
    const pages = getDashboardPageIndex("creative").map((page) => page.href);
    expect(new Set(pages).size).toBe(pages.length);
    expect(pages).toContain("/creative/tickets");
    expect(pages).toContain("/colors");
    expect(pages.some((href) => href.startsWith("/customer") || href.startsWith("/admin"))).toBe(
      false,
    );
  });
});

describe("isDashboardLeafActive", () => {
  const leaf = (role: "customer" | "creative", href: string) =>
    getDashboardNav(role)
      .sections.flatMap((section) => section.items)
      .find((item) => item.href === href)!;

  it("matches Overview only on its exact path", () => {
    const overview = leaf("customer", "/customer");
    expect(isDashboardLeafActive(overview, "/customer", "customer")).toBe(true);
    expect(isDashboardLeafActive(overview, "/customer/board", "customer")).toBe(false);
  });

  it("keeps Board active on ticket pages", () => {
    const board = leaf("creative", "/creative/board");
    expect(isDashboardLeafActive(board, "/creative/tickets/abc", "creative")).toBe(true);
  });
});
