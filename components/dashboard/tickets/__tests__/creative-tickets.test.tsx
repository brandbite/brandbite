import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CreativeTicketDetailPage from "@/app/creative/tickets/[ticketId]/page";
import CreativeTicketsPage from "@/app/creative/tickets/page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ ticketId: "t1" }),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/creative/tickets",
}));
vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

afterEach(() => vi.restoreAllMocks());

const company = { id: "c", name: "Acme Studio", slug: "acme" };

function job(over: Record<string, unknown>) {
  return {
    id: "t1",
    title: "Logo redesign",
    description: null,
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueDate: null,
    companyTicketNumber: 101,
    createdAt: "2026-03-06T12:00:00.000Z",
    updatedAt: "2026-03-06T12:00:00.000Z",
    company,
    project: { id: "p", name: "Website", code: "WEB" },
    jobType: { id: "j", name: "Logo", tokenCost: 16, creativePayoutTokens: 7 },
    revisionCount: 0,
    latestRevisionHasFeedback: false,
    latestRevisionFeedbackSnippet: null,
    estimatedPayout: 10,
    ...over,
  };
}

function mockList(tickets: ReturnType<typeof job>[]) {
  const byStatus = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 } as Record<string, number>;
  tickets.forEach((t) => (byStatus[t.status as string] += 1));
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    Response.json({
      stats: { byStatus, total: tickets.length },
      tickets,
      pagination: { total: tickets.length, limit: 200, offset: 0, hasMore: false },
    }),
  );
}

describe("Creative job list", () => {
  it("shows the payout at the creative's rate and flags requested changes", async () => {
    mockList([job({ latestRevisionHasFeedback: true })]);
    render(<CreativeTicketsPage />);
    expect(await screen.findByText("10 tokens")).toBeInTheDocument();
    expect(screen.getByText("Changes requested")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open job" })).toHaveAttribute(
      "href",
      "/creative/tickets/t1",
    );
  });

  it("filters by status card and by search across job and customer", async () => {
    mockList([
      job({ id: "a", title: "Logo redesign" }),
      job({ id: "b", title: "Brochure", status: "DONE", company: { ...company, name: "Globex" } }),
    ]);
    render(<CreativeTicketsPage />);
    await screen.findByRole("link", { name: "Brochure" });

    fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
    expect(screen.queryByRole("link", { name: "Logo redesign" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^All/ }));

    fireEvent.change(screen.getByLabelText("Search jobs"), { target: { value: "globex" } });
    expect(screen.getByRole("link", { name: "Brochure" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Logo redesign" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Search jobs"), { target: { value: "nothing" } });
    expect(screen.getByText("No jobs match these filters")).toBeInTheDocument();
  });

  it("offers only the moves the shared rule allows, and none on done work", async () => {
    mockList([job({ status: "IN_REVIEW" }), job({ id: "d", title: "Finished", status: "DONE" })]);
    render(<CreativeTicketsPage />);
    const select = await screen.findByLabelText("Change status of Logo redesign");
    expect([...(select as HTMLSelectElement).options].map((o) => o.value)).toEqual([
      "IN_REVIEW",
      "IN_PROGRESS",
    ]);
    expect(screen.queryByLabelText("Change status of Finished")).toBeNull();
    expect(screen.getByText("This job is done and can't be moved.")).toBeInTheDocument();
  });
});

function mockDetail(status: string, revisions: unknown[] = []) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method && init.method !== "GET") return Response.json({ ok: true });
    if (url.includes("/time-entries")) {
      return Response.json({ entries: [], runningEntry: null, totalLoggedSeconds: 0 });
    }
    if (url.includes("/comments")) return Response.json({ comments: [] });
    if (url.includes("/revisions")) return Response.json({ revisions });
    if (url.includes("/assets")) return Response.json({ assets: [] });
    if (url.includes("limit=1")) return Response.json({ revisionNotesEnabled: true, tickets: [] });
    return Response.json({
      company,
      ticket: {
        ...job({ status }),
        quantity: 1,
        effectivePayout: 10,
        payoutPercent: 60,
        creative: { id: "a", name: "Ada", email: "ada@x.test" },
        createdBy: { id: "p", name: "Acme PM", email: "pm@x.test" },
        completedAt: null,
        completedBy: null,
        jobType: {
          id: "j",
          name: "Logo",
          tokenCost: 16,
          creativePayoutTokens: 7,
          estimatedHours: 16,
        },
      },
    });
  });
}

describe("Creative job detail", () => {
  it("keeps the send button off until a file is added", async () => {
    mockDetail("IN_PROGRESS");
    render(<CreativeTicketDetailPage />);
    const send = await screen.findByRole("button", { name: "Send for review" });
    expect(send).toBeDisabled();
    expect(screen.getByText("Add at least one file to send this version.")).toBeInTheDocument();
    expect(await screen.findByText("No versions yet")).toBeInTheDocument();

    const file = new File(["x"], "logo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Add files to this version"), {
      target: { files: [file] },
    });
    expect(await screen.findByText("logo.png")).toBeInTheDocument();
    expect(send).toBeEnabled();
  });

  it("refuses files the delivery route wouldn't take, and says why", async () => {
    mockDetail("IN_PROGRESS");
    render(<CreativeTicketDetailPage />);
    await screen.findByRole("button", { name: "Send for review" });
    const file = new File(["x"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Add files to this version"), {
      target: { files: [file] },
    });
    expect(await screen.findByText("Some files weren't added")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send for review" })).toBeDisabled();
  });

  it("offers delivery only while in progress", async () => {
    mockDetail("TODO");
    render(<CreativeTicketDetailPage />);
    expect(await screen.findByRole("button", { name: "Start work" })).toBeInTheDocument();
    expect(await screen.findByText("Start work to send a version")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send for review" })).toBeNull();
  });

  it("starts work through the shared status route", async () => {
    mockDetail("TODO");
    render(<CreativeTicketDetailPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Start work" }));
    await waitFor(() => {
      const patch = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patch?.[0]).toBe("/api/creative/tickets");
      expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ id: "t1", status: "IN_PROGRESS" });
    });
  });

  it("never lets the creative approve their own work", async () => {
    mockDetail("IN_REVIEW");
    render(<CreativeTicketDetailPage />);
    expect(await screen.findByText("This version is with the customer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull back to In progress" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
  });

  it("shows customer feedback with the version and separates comments", async () => {
    mockDetail("IN_PROGRESS", [
      {
        version: 1,
        submittedAt: "2026-03-02T12:00:00.000Z",
        feedbackAt: "2026-03-04T12:00:00.000Z",
        feedbackMessage: "More contrast please",
        creativeMessage: null,
        assets: [],
      },
    ]);
    render(<CreativeTicketDetailPage />);
    expect(await screen.findByText("More contrast please")).toBeInTheDocument();
    expect(screen.getByText("Changes requested")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Comments/ }));
    expect(screen.queryByText("More contrast please")).toBeNull();
  });

  it("shows the timer with the real estimate, and the log in its own tab", async () => {
    mockDetail("IN_PROGRESS");
    render(<CreativeTicketDetailPage />);
    expect(await screen.findByRole("timer")).toHaveTextContent("0:00:00");
    expect(screen.getByText("/ 16h estimated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start timer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Time tracking" }));
    expect(screen.getByRole("heading", { name: "Time entries" })).toBeInTheDocument();
  });
});
