// -----------------------------------------------------------------------------
// @file: lib/support/__tests__/support.test.ts
// @purpose: Guards the Support guide content (unique slugs, valid routes and
//           related links) and the lookup helpers behind the "?" help link
//           and the hub search.
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  findGuideForPath,
  getGuides,
  popularGuides,
  primaryRoute,
  relatedGuides,
  searchGuides,
  type SupportRole,
} from "../index";

const ROLES: SupportRole[] = ["customer", "creative", "admin"];

describe("guide content integrity", () => {
  for (const role of ROLES) {
    const all = getGuides(role, { isSiteOwner: true });

    it(`${role}: slugs are unique and URL-safe`, () => {
      const slugs = all.map((g) => g.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    });

    it(`${role}: routes live under /${role}`, () => {
      for (const g of all) {
        for (const r of g.routes) {
          expect(r === `/${role}` || r.startsWith(`/${role}/`)).toBe(true);
        }
      }
    });

    it(`${role}: related slugs point at existing guides`, () => {
      const slugs = new Set(all.map((g) => g.slug));
      for (const g of all) {
        for (const r of g.related ?? []) expect(slugs.has(r), `${g.slug} → ${r}`).toBe(true);
        expect(g.related ?? []).not.toContain(g.slug);
      }
    });

    it(`${role}: every guide has content`, () => {
      for (const g of all) {
        expect(g.sections.length).toBeGreaterThan(0);
        for (const s of g.sections) expect(s.blocks.length).toBeGreaterThan(0);
      }
    });
  }
});

describe("findGuideForPath", () => {
  it("matches the role root exactly only", () => {
    expect(findGuideForPath("customer", "/customer")?.slug).toBe("overview");
    expect(findGuideForPath("customer", "/customer/unknown-page")).toBeUndefined();
  });

  it("matches child paths", () => {
    expect(findGuideForPath("customer", "/customer/moodboards/abc123")?.slug).toBe("moodboards");
  });

  it("prefers literal segments over [param] segments", () => {
    expect(findGuideForPath("customer", "/customer/tickets/new")?.slug).toBe("create-request");
    expect(findGuideForPath("customer", "/customer/tickets/abc123")?.slug).toBe(
      "review-and-approve",
    );
    expect(findGuideForPath("customer", "/customer/tickets")?.slug).toBe("requests-table");
  });
});

describe("findGuideForPath — creative", () => {
  it("maps the creative dashboard pages", () => {
    expect(findGuideForPath("creative", "/creative")?.slug).toBe("overview");
    expect(findGuideForPath("creative", "/creative/board")?.slug).toBe("board");
    expect(findGuideForPath("creative", "/creative/tickets")?.slug).toBe("tickets-table");
    expect(findGuideForPath("creative", "/creative/tickets/abc123")?.slug).toBe("ticket-details");
    expect(findGuideForPath("creative", "/creative/withdrawals")?.slug).toBe("withdrawals");
  });
});

describe("findGuideForPath — admin", () => {
  const owner = { isSiteOwner: true };

  it("prefers the most specific admin route", () => {
    expect(findGuideForPath("admin", "/admin", owner)?.slug).toBe("dashboard");
    expect(findGuideForPath("admin", "/admin/tickets", owner)?.slug).toBe("board-and-tickets");
    expect(findGuideForPath("admin", "/admin/tickets/abc123", owner)?.slug).toBe("ticket-detail");
    expect(findGuideForPath("admin", "/admin/settings", owner)?.slug).toBe("settings");
    expect(findGuideForPath("admin", "/admin/settings/mfa", owner)?.slug).toBe("two-factor");
    expect(findGuideForPath("admin", "/admin/consultations/settings", owner)?.slug).toBe(
      "consultation-settings",
    );
  });

  it("hides owner-only guides from site admins", () => {
    expect(findGuideForPath("admin", "/admin/audit-log", owner)?.slug).toBe("audit-log");
    expect(findGuideForPath("admin", "/admin/audit-log", { isSiteOwner: false })).toBeUndefined();
    const adminSlugs = getGuides("admin", { isSiteOwner: false }).map((g) => g.slug);
    expect(adminSlugs).not.toContain("talent-applications");
    expect(adminSlugs).not.toContain("two-factor");
  });
});

describe("primaryRoute", () => {
  it("skips dynamic routes", () => {
    const guide = getGuides("customer").find((g) => g.slug === "review-and-approve")!;
    expect(primaryRoute(guide)).toBeUndefined();
  });
});

describe("relatedGuides", () => {
  it("resolves slugs to guides in order", () => {
    const guide = getGuides("customer").find((g) => g.slug === "getting-around")!;
    expect(relatedGuides("customer", guide).map((g) => g.slug)).toEqual(guide.related);
  });
});

describe("popularGuides", () => {
  it.each([
    ["customer", ["create-request", "review-and-approve", "tokens"]],
    ["creative", ["deliver-work", "handle-feedback", "withdrawals"]],
    ["admin", ["board-and-tickets", "companies", "withdrawals", "users"]],
  ] as const)("%s: lists its picks in order, for every viewer", (role, slugs) => {
    // Without the owner flag, so a site admin gets the full list too and a renamed
    // slug can't quietly drop out of it.
    expect(popularGuides(role).map((g) => g.slug)).toEqual(slugs);
  });
});

describe("searchGuides", () => {
  const guides = getGuides("customer");

  it("returns everything for an empty query", () => {
    expect(searchGuides(guides, "   ")).toHaveLength(guides.length);
  });

  it("requires every term and ranks title hits first", () => {
    const hits = searchGuides(guides, "moodboards");
    expect(hits[0]?.slug).toBe("moodboards");
    expect(searchGuides(guides, "moodboard zzzqqq")).toHaveLength(0);
  });

  it("matches keywords and ignores **bold** markers", () => {
    expect(searchGuides(guides, "2fa").map((g) => g.slug)).toContain("profile");
    expect(searchGuides(guides, "send back to creative").length).toBeGreaterThan(0);
  });
});
