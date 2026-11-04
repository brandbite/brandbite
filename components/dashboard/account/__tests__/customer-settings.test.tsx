import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CustomerSettingsPage from "@/app/customer/settings/page";

let search = "";
vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

function mockApi({
  companyRole = "OWNER",
  billingStatus = null as string | null,
  hasLiveSubscription = false,
  plan = {
    id: "full",
    name: "Full",
    monthlyTokens: 400,
    priceCents: 199900,
    isActive: true,
  } as object | null,
  tagsEnabled = true,
} = {}) {
  const urls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/plans/topups")) {
      return Response.json({
        topups: [
          { id: "t", name: "Pack", description: null, monthlyTokens: 100, priceCents: 1000 },
        ],
      });
    }
    if (url.includes("/plans/subscriptions")) {
      return Response.json({
        plans: [
          { id: "full", name: "Full", description: null, monthlyTokens: 400, priceCents: 199900 },
          { id: "basic", name: "Basic", description: null, monthlyTokens: 100, priceCents: 59900 },
        ],
      });
    }
    if (url.includes("/notifications/preferences")) return Response.json({ preferences: [] });
    if (url.includes("/customer/tags")) return Response.json({ tags: [], tagsEnabled });
    return Response.json({
      user: { id: "u", email: "me@acme.test", name: "Me", role: "CUSTOMER", companyRole },
      company: {
        id: "c",
        name: "Acme Studio",
        slug: "acme",
        website: null,
        tokenBalance: 3,
        billingStatus,
        hasLiveSubscription,
        createdAt: "2026-03-06T00:00:00.000Z",
        updatedAt: "2026-03-06T00:00:00.000Z",
        counts: { members: 3, projects: 2, tickets: 6 },
      },
      plan,
    });
  });
  return urls;
}

const activeTab = () => screen.getByRole("tab", { selected: true }).textContent;

beforeEach(() => {
  search = "";
  window.history.replaceState(null, "", "/customer/settings");
});
afterEach(() => vi.restoreAllMocks());

describe("Customer settings", () => {
  it("shows the status the data has, not an assumed one", async () => {
    mockApi({ billingStatus: null });
    render(<CustomerSettingsPage />);
    expect(await screen.findByText("Not set")).toBeInTheDocument();
    expect(screen.queryByText("Active")).toBeNull();
  });

  it("starts owners on the plan and a PM on the company", async () => {
    mockApi({ companyRole: "OWNER" });
    const { unmount } = render(<CustomerSettingsPage />);
    await screen.findByText("Your plan & billing");
    expect(activeTab()).toBe("Plan & billing");
    unmount();

    mockApi({ companyRole: "PM" });
    render(<CustomerSettingsPage />);
    await screen.findByRole("tab", { name: "Company" });
    expect(activeTab()).toBe("Company");
  });

  it("opens the tab named in the link", async () => {
    window.history.replaceState(null, "", "/customer/settings?tab=access");
    mockApi();
    render(<CustomerSettingsPage />);
    await screen.findByRole("tab", { name: "Workspace access" });
    await waitFor(() => expect(activeTab()).toBe("Workspace access"));
  });

  it("offers checkout only without a live subscription", async () => {
    mockApi({ hasLiveSubscription: false });
    const { unmount } = render(<CustomerSettingsPage />);
    expect(await screen.findByRole("button", { name: "Start subscription" })).toBeInTheDocument();
    unmount();

    mockApi({ hasLiveSubscription: true, billingStatus: "ACTIVE" });
    render(<CustomerSettingsPage />);
    await screen.findByText("Your plan & billing");
    expect(screen.queryByRole("button", { name: "Start subscription" })).toBeNull();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("disables checkout for an inactive plan", async () => {
    mockApi({
      plan: { id: "x", name: "Old", monthlyTokens: 1, priceCents: 1, isActive: false },
    });
    render(<CustomerSettingsPage />);
    expect(await screen.findByRole("button", { name: "Start subscription" })).toBeDisabled();
  });

  it("keeps billing actions from roles that can't manage them", async () => {
    mockApi({ companyRole: "MEMBER" });
    render(<CustomerSettingsPage />);
    await screen.findByText("Limited access");
    expect(screen.queryByRole("button", { name: "Start subscription" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Preview change" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Buy tokens" })).toBeNull();
    expect(screen.getByText("Owner / Billing only")).toBeInTheDocument();
  });

  it("lets a billing manager manage the plan but not edit the company", async () => {
    const urls = mockApi({ companyRole: "BILLING" });
    render(<CustomerSettingsPage />);
    expect(await screen.findByRole("button", { name: "Preview change" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit company" })).toBeNull();
    expect(urls.some((u) => u.includes("/customer/tags"))).toBe(false);
  });

  it("hides tags when the global flag is off", async () => {
    mockApi({ companyRole: "PM", tagsEnabled: false });
    render(<CustomerSettingsPage />);
    await screen.findByText("Company profile");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Tags" })).toBeNull());
  });

  it("warns an owner before leaving, and delete needs the typed email", async () => {
    window.history.replaceState(null, "", "/customer/settings?tab=access");
    mockApi();
    render(<CustomerSettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Leave workspace" }));
    const leave = await screen.findByRole("dialog");
    expect(within(leave).getByText(/You're an Owner of this workspace/)).toBeInTheDocument();
    fireEvent.click(within(leave).getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    const del = await screen.findByRole("dialog");
    const confirm = within(del).getByRole("button", { name: "Delete my account" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(del).getByLabelText("Type your email to confirm deletion"), {
      target: { value: "ME@acme.test" },
    });
    expect(confirm).toBeEnabled();
  });

  it("opens the company editor from the summary, on the Company tab", async () => {
    mockApi();
    render(<CustomerSettingsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit company" }));
    expect(activeTab()).toBe("Company");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Acme Studio");
  });
});
