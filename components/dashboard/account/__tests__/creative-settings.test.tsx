import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CreativeSettingsPage from "@/app/creative/settings/page";

vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const skills = Array.from({ length: 14 }, (_, i) => ({
  id: `s${i}`,
  name: `Skill ${i}`,
  category: i < 10 ? "Brand" : "Web",
  description: null,
}));

function mockApi({
  selected = ["s0", "s11"],
  failTiers = false,
  availability = { isPaused: false, activeTicketCount: 0 } as object,
  failAvailability = false,
} = {}) {
  const writes: { method: string; url: string; body: unknown }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method !== "GET") {
      const body = JSON.parse(String(init?.body));
      writes.push({ method, url, body });
      if (url.includes("/availability")) {
        return Response.json({ ...availability, isPaused: body.action === "pause" });
      }
      return Response.json({ selectedJobTypeIds: body.jobTypeIds ?? [] });
    }
    if (url.includes("/session")) return Response.json({ user: { email: "ada@demo.test" } });
    if (url.includes("/preferences")) return Response.json({ preferences: [] });
    if (url.includes("/skills")) {
      return Response.json({ jobTypes: skills, selectedJobTypeIds: selected });
    }
    if (url.includes("/payout-tier")) {
      if (failTiers) return Response.json({ error: "down" }, { status: 500 });
      return Response.json({
        tiers: [
          {
            id: "silver",
            name: "Silver",
            description: null,
            minCompletedTickets: 50,
            timeWindowDays: 90,
            payoutPercent: 65,
            completedInWindow: 10,
            qualified: false,
          },
        ],
        currentPayoutPercent: 60,
        currentTierName: null,
        basePayoutPercent: 60,
      });
    }
    if (url.includes("/availability")) {
      if (failAvailability) return Response.json({ error: "down" }, { status: 500 });
      return Response.json(availability);
    }
    return Response.json({});
  });
  return writes;
}

const skillBoxes = () => screen.getAllByRole("checkbox") as HTMLInputElement[];

beforeEach(() => window.history.replaceState(null, "", "/creative/settings"));
afterEach(() => vi.restoreAllMocks());

describe("Creative settings: skills", () => {
  it("pages the list and returns to the first page when a filter changes", async () => {
    mockApi();
    render(<CreativeSettingsPage />);
    await screen.findByRole("checkbox", { name: "Skill 0" });
    expect(screen.getByText("Showing 1–12 of 14")).toBeInTheDocument();
    expect(screen.queryByText("Skill 12")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Skill 12")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Skill category"), { target: { value: "Brand" } });
    expect(screen.getByText("Showing 1–10 of 10")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("says when a filter hides selected skills, and keeps them selected", async () => {
    const writes = mockApi();
    render(<CreativeSettingsPage />);
    await screen.findByRole("checkbox", { name: "Skill 0" });

    fireEvent.change(screen.getByLabelText("Skill category"), { target: { value: "Brand" } });
    expect(screen.getByText("1 selected skill is not shown by this filter")).toBeInTheDocument();
    expect(writes).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.queryByText(/not shown by this filter/)).toBeNull();
    expect(skillBoxes().filter((b) => b.checked)).toHaveLength(2);
  });

  it("filters to selected skills from the summary", async () => {
    mockApi();
    render(<CreativeSettingsPage />);
    await screen.findByRole("checkbox", { name: "Skill 0" });
    fireEvent.click(screen.getByRole("button", { name: "Show selected" }));
    expect(skillBoxes()).toHaveLength(2);
  });

  it("saves a ticked skill through the debounced PUT", async () => {
    const writes = mockApi({ selected: [] });
    render(<CreativeSettingsPage />);
    await screen.findByRole("checkbox", { name: "Skill 0" });

    fireEvent.click(skillBoxes()[0]);
    await waitFor(
      () =>
        expect(writes).toEqual([
          { method: "PUT", url: "/api/creative/skills", body: { jobTypeIds: ["s0"] } },
        ]),
      { timeout: 2000 },
    );
  });
});

describe("Creative settings: payout", () => {
  it("doesn't invent a rate when the API fails", async () => {
    mockApi({ failTiers: true });
    render(<CreativeSettingsPage />);
    await screen.findByText("Current payout rate");
    expect(screen.getByText("Not available right now")).toBeInTheDocument();
    expect(screen.queryByText("60%")).toBeNull();
  });

  it("shows the next tier from the data", async () => {
    mockApi();
    render(<CreativeSettingsPage />);
    expect(await screen.findByText("Next: Silver (65%)")).toBeInTheDocument();
    expect(screen.getAllByText("10 / 50 completed in 3 months").length).toBeGreaterThan(0);
  });
});

describe("Creative settings: availability", () => {
  it("keeps all three pause durations and sends the chosen one", async () => {
    const writes = mockApi();
    render(<CreativeSettingsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Availability" }));
    const panel = screen.getByRole("tabpanel", { name: "Availability" });

    expect(within(panel).getByLabelText(/1 hour/)).toBeChecked();
    fireEvent.click(within(panel).getByLabelText(/7 days/));
    expect(within(panel).getByLabelText(/Until I resume/)).not.toBeChecked();
    fireEvent.click(within(panel).getByRole("button", { name: "Pause working" }));

    await waitFor(() =>
      expect(writes).toEqual([
        {
          method: "PATCH",
          url: "/api/creative/availability",
          body: { action: "pause", pauseType: "7_DAYS" },
        },
      ]),
    );
  });

  it("confirms before pausing with active tickets", async () => {
    const writes = mockApi({ availability: { isPaused: false, activeTicketCount: 2 } });
    render(<CreativeSettingsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Availability" }));
    const panel = screen.getByRole("tabpanel", { name: "Availability" });
    await within(panel).findByLabelText(/1 hour/);

    fireEvent.click(within(panel).getByRole("button", { name: "Pause working" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/You have 2 active tickets/)).toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it("claims nothing about availability when it can't load", async () => {
    mockApi({ failAvailability: true });
    render(<CreativeSettingsPage />);
    await screen.findByRole("checkbox", { name: "Skill 0" });
    await waitFor(() => expect(screen.queryByText("Receiving new assignments")).toBeNull());
    fireEvent.click(screen.getByRole("tab", { name: "Availability" }));
    expect(screen.getByText("We couldn't load your availability")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause working" })).toBeNull();
  });
});

describe("Creative settings: notifications", () => {
  it("names each switch by event and channel, and saves that channel only", async () => {
    const writes = mockApi();
    render(<CreativeSettingsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Notifications" }));

    const email = await screen.findByRole("switch", { name: "Withdrawal updates Email" });
    expect(screen.getByRole("switch", { name: "Withdrawal updates In-app" })).toBeInTheDocument();
    fireEvent.click(email);
    await waitFor(() =>
      expect(writes).toEqual([
        {
          method: "PATCH",
          url: "/api/notifications/preferences",
          body: { type: "WITHDRAWAL_UPDATED", emailEnabled: false },
        },
      ]),
    );
  });
});
