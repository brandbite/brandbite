import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AiToolsPage from "@/app/customer/ai-tools/page";
import CustomerConsultationPage from "@/app/customer/consultation/page";
import MoodboardsPage from "@/app/customer/moodboards/page";
import OnboardingPage from "@/app/onboarding/page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/",
}));

type Handler = (url: string, init?: RequestInit) => Response | undefined;

function mockFetch(handler: Handler) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const res = handler(String(input), init);
    return res ?? Response.json({ error: `unexpected ${input}` }, { status: 500 });
  });
}

const generation = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  toolType: "TEXT_GENERATION",
  status: "COMPLETED",
  provider: "openai",
  model: "gpt",
  prompt: `Prompt ${id}`,
  outputText: null,
  outputImageUrl: null,
  outputParams: null,
  tokenCost: 2,
  errorMessage: null,
  createdAt: "2026-04-01T12:00:00.000Z",
  completedAt: null,
  ...overrides,
});

beforeEach(() => push.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("AI tools", () => {
  function mockAi(generations = [generation("a")], total = generations.length) {
    return mockFetch((url) => {
      if (url.includes("/api/customer/tokens")) {
        return Response.json({ company: { tokenBalance: 3 }, stats: {} });
      }
      if (url.includes("/api/ai/generations")) return Response.json({ generations, total });
      return undefined;
    });
  }

  it("shows the company balance from the tokens response", async () => {
    mockAi();
    render(<AiToolsPage />);
    expect(await screen.findByText("3 tokens")).toBeInTheDocument();
  });

  it("offers the five tools and opens one at a time without spending", async () => {
    const fetchSpy = mockAi();
    render(<AiToolsPage />);
    for (const name of [
      /Image Generation/,
      /Copy Generation/,
      /Background Removal/,
      /Design Suggestions/,
      /Image Upscaling/,
    ]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-expanded", "false");
    }

    fireEvent.click(screen.getByRole("button", { name: /Copy Generation/ }));
    expect(screen.getByRole("button", { name: "Generate Copy" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Image Upscaling/ }));
    expect(screen.queryByRole("button", { name: "Generate Copy" })).toBeNull();
    expect(screen.getByRole("button", { name: "Upscale Image" })).toBeDisabled();

    const writes = fetchSpy.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(writes).toHaveLength(0);
  });

  it("asks the API for the chosen filters and restarts from the first page", async () => {
    const fetchSpy = mockAi(
      Array.from({ length: 10 }, (_, i) => generation(String(i))),
      12,
    );
    render(<AiToolsPage />);
    await screen.findByText("Showing 1–10 of 12");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(fetchSpy.mock.calls.some(([u]) => String(u).includes("offset=10"))).toBe(true),
    );

    await screen.findByRole("combobox", { name: "Filter by status" });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by status" }), {
      target: { value: "FAILED" },
    });
    await waitFor(() => {
      const last = String(
        fetchSpy.mock.calls.filter(([u]) => String(u).includes("generations")).at(-1)?.[0],
      );
      expect(last).toContain("status=FAILED");
      expect(last).toContain("offset=0");
    });
  });

  it("tells a filtered-empty history apart from an empty one", async () => {
    mockAi([]);
    render(<AiToolsPage />);
    expect(await screen.findByText("No generations yet")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by tool" }), {
      target: { value: "UPSCALE_IMAGE" },
    });
    expect(await screen.findByText("No generations match these filters")).toBeInTheDocument();
  });

  it("marks a failed generation's tokens as refunded", async () => {
    mockAi([generation("f", { status: "FAILED" })]);
    render(<AiToolsPage />);
    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(screen.getAllByText(/Refunded/).length).toBeGreaterThan(0);
  });

  it("reports a failed history load", async () => {
    mockFetch(() => Response.json({ error: "down" }, { status: 500 }));
    render(<AiToolsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("generation history");
  });
});

describe("Moodboards list", () => {
  const board = (id: string, title: string, updatedAt: string, createdAt = updatedAt) => ({
    id,
    title,
    description: null,
    projectId: null,
    projectName: null,
    itemCount: 1,
    thumbnails: [],
    createdAt,
    updatedAt,
  });

  function mockBoards(boards: ReturnType<typeof board>[]) {
    return mockFetch((url, init) => {
      if (init?.method === "POST") {
        return Response.json({ moodboard: { id: "new" } });
      }
      if (url.includes("/api/customer/moodboards")) return Response.json({ moodboards: boards });
      return undefined;
    });
  }

  const titles = () =>
    screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

  it("sorts by last update by default and by name on request", async () => {
    mockBoards([
      board("a", "Alpha", "2026-01-01T00:00:00.000Z"),
      board("z", "Zeta", "2026-03-01T00:00:00.000Z"),
    ]);
    render(<MoodboardsPage />);
    await screen.findByRole("heading", { name: "Zeta" });
    expect(titles()).toEqual(["Zeta", "Alpha"]);

    fireEvent.change(screen.getByRole("combobox", { name: "Sort moodboards" }), {
      target: { value: "title" },
    });
    expect(titles()).toEqual(["Alpha", "Zeta"]);
  });

  it("shows the real date for the chosen sort", async () => {
    mockBoards([board("a", "Alpha", "2026-03-09T12:00:00.000Z", "2026-01-05T12:00:00.000Z")]);
    render(<MoodboardsPage />);
    expect(await screen.findByText("Updated Mar 9, 2026")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Sort moodboards" }), {
      target: { value: "created" },
    });
    expect(screen.getByText("Created Jan 5, 2026")).toBeInTheDocument();
  });

  it("filters by search and offers a way back", async () => {
    mockBoards([board("a", "Alpha", "2026-01-01T00:00:00.000Z")]);
    render(<MoodboardsPage />);
    const search = await screen.findByRole("searchbox", { name: "Search moodboards" });
    fireEvent.change(search, { target: { value: "nothing" } });
    expect(screen.getByText("No moodboards match your search")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
  });

  it("creates a board and opens it", async () => {
    mockBoards([]);
    render(<MoodboardsPage />);
    expect(await screen.findByText("No moodboards yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ New Moodboard" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/customer/moodboards/new"));
  });

  it("reports a failed load", async () => {
    mockFetch(() => Response.json({ error: "down" }, { status: 500 }));
    render(<MoodboardsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load moodboards");
  });
});

describe("Consultation", () => {
  const row = (id: string, status: string, description: string, overrides = {}) => ({
    id,
    description,
    preferredTimes: null,
    timezone: "UTC",
    scheduledAt: null,
    videoLink: null,
    tokenCost: 1,
    status,
    createdAt: "2026-04-01T12:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
    requestedBy: { id: "u", name: "A", email: "a@b.c" },
    ...overrides,
  });

  function mockConsult({
    role = "OWNER",
    enabled = true,
    rows = [] as ReturnType<typeof row>[],
  } = {}) {
    return mockFetch((url, init) => {
      if (url.includes("availability")) return Response.json({ busy: [], googleConnected: false });
      if (url.includes("consultation-settings")) {
        return Response.json({
          settings: {
            enabled,
            tokenCost: 1,
            durationMinutes: 30,
            contactEmail: null,
            workingDays: [1, 2, 3, 4, 5],
            workingHourStart: 9,
            workingHourEnd: 17,
            minNoticeHours: 24,
            maxBookingDays: 30,
            companyTimezone: "UTC",
          },
        });
      }
      if (url.includes("/api/customer/settings")) {
        return Response.json({ user: { companyRole: role } });
      }
      if (url.includes("/api/customer/tokens")) {
        return Response.json({ company: { tokenBalance: 3 } });
      }
      if (url.includes("/api/customer/consultations")) {
        if (init?.method === "POST") return Response.json({ ok: true });
        return Response.json({ consultations: rows, tokenCost: 1 });
      }
      return undefined;
    });
  }

  it("shows the form beside the records for owners, with the cost on the button", async () => {
    mockConsult({ rows: [row("a", "COMPLETED", "A finished call")] });
    render(<CustomerConsultationPage />);
    expect(await screen.findByRole("button", { name: /Submit request — 1 token$/ })).toBeDisabled();
    expect(screen.getByText("A finished call")).toBeInTheDocument();
    expect(screen.getByText("3 tokens")).toBeInTheDocument();
  });

  it("hides the form from roles that can't book", async () => {
    mockConsult({ role: "MEMBER" });
    render(<CustomerConsultationPage />);
    expect(await screen.findByText(/Ask a teammate/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit request/ })).toBeNull();
  });

  it("hides the form when bookings are paused", async () => {
    mockConsult({ enabled: false });
    render(<CustomerConsultationPage />);
    expect(await screen.findByText(/bookings are paused right now/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit request/ })).toBeNull();
  });

  it("books the chosen wall-clock time in the selected time zone", async () => {
    const fetchSpy = mockConsult();
    render(<CustomerConsultationPage />);
    const submit = await screen.findByRole("button", { name: /Submit request — 1 token$/ });

    fireEvent.change(screen.getByLabelText(/What do you want to discuss/), {
      target: { value: "A long enough description" },
    });
    fireEvent.change(screen.getByLabelText("Timezone"), { target: { value: "Asia/Tokyo" } });
    const day = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    fireEvent.change(screen.getByLabelText("Preferred date"), { target: { value: day } });
    fireEvent.change(screen.getByLabelText("Preferred time"), { target: { value: "09:00" } });
    fireEvent.click(submit);

    await screen.findByText(/Request submitted/);
    const post = fetchSpy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      description: "A long enough description",
      preferredTimes: [`${day}T00:00:00.000Z`],
      timezone: "Asia/Tokyo",
    });
  });

  it("filters the records by upcoming, status and search", async () => {
    mockConsult({
      rows: [
        row("a", "PENDING", "Waiting call"),
        row("b", "COMPLETED", "Finished call"),
        row("c", "SCHEDULED", "Passed call", { scheduledAt: "2020-01-01T00:00:00.000Z" }),
        row("d", "SCHEDULED", "Future call", {
          scheduledAt: "2999-01-01T00:00:00.000Z",
          videoLink: "https://meet.example/x",
        }),
      ],
    });
    render(<CustomerConsultationPage />);
    await screen.findByText("Waiting call");
    expect(screen.getByRole("link", { name: /Join call/ })).toHaveAttribute(
      "href",
      "https://meet.example/x",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Upcoming (2)" }));
    expect(screen.getByText("Waiting call")).toBeInTheDocument();
    expect(screen.getByText("Future call")).toBeInTheDocument();
    expect(screen.queryByText("Finished call")).toBeNull();
    expect(screen.queryByText("Passed call")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "All (4)" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search consultations" }), {
      target: { value: "finished" },
    });
    expect(screen.getByText("Finished call")).toBeInTheDocument();
    expect(screen.queryByText("Waiting call")).toBeNull();
  });
});

describe("Onboarding", () => {
  it("walks the steps, keeps the skips, and finishes on the dashboard", async () => {
    const fetchSpy = mockFetch((url, init) => {
      if (url.includes("/api/customer/onboarding")) {
        return init?.method === "POST" ? Response.json({ ok: true }) : Response.json({ ok: true });
      }
      return undefined;
    });
    render(<OnboardingPage />);
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();

    // Company name is required before anything is sent.
    fireEvent.click(screen.getByRole("button", { name: "Create Company" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Company name is required.");
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Company Name/), { target: { value: "Nova Labs" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Company" }));
    expect(await screen.findByRole("heading", { name: "Invite your team" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByRole("heading", { name: "Create your first project" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByRole("heading", { name: /You're all set/ })).toBeInTheDocument();
    expect(screen.getByText("Nova Labs")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go to Dashboard" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/customer"));
    expect(
      fetchSpy.mock.calls.some(
        ([u, init]) => String(u).includes("onboarding") && init?.method === "PATCH",
      ),
    ).toBe(true);
  });

  it("suggests a project code from the name and sends invites with the chosen role", async () => {
    const fetchSpy = mockFetch((url) => {
      if (url.includes("/api/customer/onboarding")) return Response.json({ ok: true });
      if (url.includes("/api/customer/members/invite")) return Response.json({ ok: true });
      if (url.includes("/api/customer/projects")) {
        return Response.json({ project: { name: "Website Redesign" } });
      }
      return undefined;
    });
    render(<OnboardingPage />);
    fireEvent.change(screen.getByLabelText(/Company Name/), { target: { value: "Nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Company" }));

    fireEvent.change(await screen.findByLabelText("Email address"), {
      target: { value: "pm@nova.test" },
    });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "PM" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Send invite" }));
    expect(await screen.findByText("pm@nova.test")).toBeInTheDocument();
    const invite = fetchSpy.mock.calls.find(([u]) => String(u).includes("invite"));
    expect(JSON.parse(String(invite?.[1]?.body))).toEqual({
      email: "pm@nova.test",
      roleInCompany: "PM",
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Project Name"), {
      target: { value: "Website Redesign" },
    });
    expect((screen.getByLabelText("Project Code") as HTMLInputElement).value).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
    expect(await screen.findByText("Project created")).toBeInTheDocument();
  });

  it("shows a server error and stays on the step", async () => {
    mockFetch(() => Response.json({ error: "Name taken" }, { status: 400 }));
    render(<OnboardingPage />);
    fireEvent.change(screen.getByLabelText(/Company Name/), { target: { value: "Nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Company" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Name taken");
    expect(screen.getByRole("heading", { name: "Welcome to brandbite" })).toBeInTheDocument();
  });
});
