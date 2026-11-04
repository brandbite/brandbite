import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeHeader } from "@/components/marketing/home-header";
import { dashboardHrefForRole } from "@/lib/dashboard-href";

function mockSession(response: Promise<Partial<Response>>) {
  vi.spyOn(globalThis, "fetch").mockReturnValue(response as Promise<Response>);
}

const signedInAs = (role: string) =>
  Promise.resolve({ ok: true, json: async () => ({ user: { role } }) });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("HomeHeader call to action", () => {
  it("keeps the sign-up link hidden until the session is known", async () => {
    let resolve: (value: Partial<Response>) => void = () => {};
    mockSession(new Promise((r) => (resolve = r)));
    render(<HomeHeader />);

    const link = screen.getByText("Start Now!");
    expect(link).toHaveAttribute("href", "/login?mode=signup");
    expect(link.className).toContain("invisible");

    resolve({ ok: true, json: async () => ({ user: null }) });
    await waitFor(() => expect(link.className).not.toContain("invisible"));
  });

  it.each([
    ["CUSTOMER", "/customer/board"],
    ["DESIGNER", "/creative/board"],
    ["SITE_ADMIN", "/admin"],
    ["SITE_OWNER", "/admin"],
  ])("sends a signed-in %s to %s", async (role, href) => {
    mockSession(signedInAs(role));
    render(<HomeHeader />);

    const link = await screen.findByRole("link", { name: /Go to dashboard/ });
    expect(link).toHaveAttribute("href", href);
    expect(screen.queryByText("Start Now!")).toBeNull();
  });

  it.each([
    ["a failed request", () => Promise.reject(new Error("offline"))],
    ["an error response", () => Promise.resolve({ ok: false })],
  ])("treats %s as a guest, so the button still works", async (_label, response) => {
    mockSession(response());
    render(<HomeHeader />);

    const link = screen.getByText("Start Now!");
    await waitFor(() => expect(link.className).not.toContain("invisible"));
  });
});

describe("dashboardHrefForRole", () => {
  it("never breaks for an unknown role", () => {
    expect(dashboardHrefForRole("SOMETHING_ELSE")).toBe("/");
    expect(dashboardHrefForRole(undefined)).toBe("/");
  });
});
