import { describe, expect, it } from "vitest";

import {
  getDashboardBreadcrumb,
  getDashboardNav,
  getDashboardPageIndex,
  isDashboardLeafActive,
} from "../dashboard-nav";

describe("getDashboardBreadcrumb", () => {
  it("names the workspace and the page for each role", () => {
    expect(getDashboardBreadcrumb("customer", "/customer")).toEqual(["Customer workspace", "Home"]);
    expect(getDashboardBreadcrumb("creative", "/creative")).toEqual(["Creative workspace", "Home"]);
    // Pages that left the sidebar still get their own name.
    expect(getDashboardBreadcrumb("customer", "/customer/members")).toEqual([
      "Customer workspace",
      "Members",
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
      "My requests",
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
    // Built hub tools are searchable even when they are not in the sidebar.
    expect(pages).toContain("/sizes");
    // So are the pinned footer items and the pages reached through them.
    expect(pages).toEqual(
      expect.arrayContaining([
        "/creative/settings",
        "/creative/support",
        "/creative/profile",
        "/creative/faq",
      ]),
    );
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

  it("matches Home only on its exact path", () => {
    const overview = leaf("customer", "/customer");
    expect(isDashboardLeafActive(overview, "/customer", "customer")).toBe(true);
    expect(isDashboardLeafActive(overview, "/customer/board", "customer")).toBe(false);
  });

  it("keeps Board active on ticket pages", () => {
    const board = leaf("creative", "/creative/board");
    expect(isDashboardLeafActive(board, "/creative/tickets/abc", "creative")).toBe(true);
  });
});
