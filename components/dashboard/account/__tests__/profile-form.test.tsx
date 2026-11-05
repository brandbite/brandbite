import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileForm } from "@/components/profile/profile-form";
import { defaultWorkSchedule } from "@/lib/work-schedule";

vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    listSessions: vi.fn(async () => ({ data: [] })),
    twoFactor: {},
  },
}));

function mockApi({
  role = "CUSTOMER",
  workSchedule = null as ReturnType<typeof defaultWorkSchedule> | null,
  selected = [] as string[],
  twoFactorEnabled = false,
  failPrefs = false,
} = {}) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/profile")) {
      return Response.json({
        user: {
          id: "u",
          email: "me@acme.test",
          name: "Me Myself",
          role,
          timezone: null,
          twoFactorEnabled,
          image: null,
          workingHours: null,
          workSchedule,
          workScheduleUpdatedAt: null,
          tasksPerWeekCap: null,
        },
      });
    }
    if (url.includes("/preferences")) {
      if (failPrefs) return Response.json({ error: "down" }, { status: 500 });
      return Response.json({ preferences: [] });
    }
    if (url.includes("/api/session")) return Response.json({ session: { id: "s" } });
    if (url.includes("/creative/skills")) {
      return Response.json({ jobTypes: [], selectedJobTypeIds: selected });
    }
    if (url.includes("/customer/settings")) {
      return Response.json({
        user: { companyRole: "OWNER" },
        company: { name: "Acme Studio" },
      });
    }
    return Response.json({});
  });
}

const tabNames = () => screen.getAllByRole("tab").map((t) => t.textContent);

beforeEach(() => window.history.replaceState(null, "", "/profile"));
afterEach(() => vi.restoreAllMocks());

describe("ProfileForm surfaces", () => {
  it("leaves the admin's three tabs and summary as they are", async () => {
    mockApi({ role: "SITE_OWNER" });
    render(<ProfileForm layout="tabs" />);
    await screen.findByRole("heading", { name: "Identity" });
    expect(tabNames()).toEqual(["Personal details", "Notifications", "Security & sessions"]);
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    // Admin keeps the password field directly in the card and no delete section.
    fireEvent.click(screen.getByRole("tab", { name: "Security & sessions" }));
    expect(screen.getByRole("button", { name: "Set up" })).toBeInTheDocument();
    expect(screen.queryByText("Delete account")).toBeNull();
  });

  it("splits a customer's profile into five tabs with their company summary", async () => {
    mockApi();
    render(<ProfileForm layout="tabs" surface="dashboard" />);
    await screen.findByRole("heading", { name: "Identity" });
    expect(tabNames()).toEqual([
      "Personal details",
      "Notifications",
      "Security",
      "Sessions",
      "Account management",
    ]);
    expect(await screen.findByText("Acme Studio")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Company settings/ })).toBeInTheDocument();
  });

  it("gives a creative a Workload tab, and customers none even by URL", async () => {
    mockApi({ role: "DESIGNER" });
    const { unmount } = render(<ProfileForm layout="tabs" surface="dashboard" />);
    await screen.findByRole("heading", { name: "Identity" });
    expect(tabNames()).toContain("Workload");
    unmount();

    window.history.replaceState(null, "", "/profile?tab=workload");
    mockApi();
    render(<ProfileForm layout="tabs" surface="dashboard" />);
    await screen.findByRole("heading", { name: "Identity" });
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Personal details");
  });

  it("opens 2FA setup in its own step, and cancel closes it", async () => {
    window.history.replaceState(null, "", "/profile?tab=security");
    mockApi();
    render(<ProfileForm layout="tabs" surface="dashboard" />);

    const start = await screen.findByRole("button", { name: "Set up two-factor" });
    expect(screen.queryByLabelText("Current password")).toBeNull();
    fireEvent.click(start);
    expect(screen.getByText("Step 1 of 3: Confirm your password")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Current password")).toBeNull();
  });

  it("keeps delete away from the personal form", async () => {
    mockApi();
    render(<ProfileForm layout="tabs" surface="dashboard" />);
    await screen.findByRole("heading", { name: "Identity" });
    expect(screen.getByRole("heading", { name: "Delete account", hidden: true })).not.toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Account management" }));
    expect(screen.getByRole("heading", { name: "Delete account" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open workspace access" })).toHaveAttribute(
      "href",
      "/customer/settings?tab=access",
    );
  });

  it("shows notifications as events by channel", async () => {
    window.history.replaceState(null, "", "/profile?tab=notifications");
    mockApi();
    render(<ProfileForm layout="tabs" surface="dashboard" />);
    expect(
      await screen.findByRole("switch", { name: "Revision submitted In-app" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Revision submitted Email" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /Withdrawal/ })).toBeNull();
  });

  it("reports preferences that failed to load instead of loading forever", async () => {
    window.history.replaceState(null, "", "/profile?tab=notifications");
    mockApi({ failPrefs: true });
    render(<ProfileForm layout="tabs" surface="dashboard" />);
    expect(await screen.findByText("We couldn't load your preferences")).toBeInTheDocument();
  });
});

describe("Creative setup", () => {
  it("nudges until working hours and skills are set", async () => {
    mockApi({ role: "DESIGNER", workSchedule: null, selected: [] });
    render(<ProfileForm layout="tabs" surface="dashboard" />);
    expect(await screen.findByText("Finish setting up your account")).toBeInTheDocument();
    expect(screen.getByText(/None selected yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Workload" }));
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Workload");
    expect(screen.getByLabelText("Time zone")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save working hours" })).toBeEnabled();
  });

  it("drops the nudge once the checklist is complete", async () => {
    mockApi({ role: "DESIGNER", workSchedule: defaultWorkSchedule("UTC"), selected: ["s1", "s2"] });
    render(<ProfileForm layout="tabs" surface="dashboard" />);
    await screen.findByText(/2 selected/);
    await waitFor(() => expect(screen.queryByText("Finish setting up your account")).toBeNull());
  });
});
