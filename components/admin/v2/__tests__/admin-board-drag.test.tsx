import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminBoardPage from "@/app/admin/board/page";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ showToast }) }));

const ticket = (over: Record<string, unknown>) => ({
  id: "t1",
  title: "Logo redesign",
  description: null,
  priority: "MEDIUM",
  dueDate: null,
  companyTicketNumber: 1,
  status: "IN_REVIEW",
  createdAt: "2026-11-01T00:00:00.000Z",
  company: { id: "c1", name: "Acme" },
  project: null,
  creative: { id: "d1", name: "Ada", email: "ada@test.local" },
  jobType: { id: "j1", name: "Logo" },
  tags: [],
  estimatedPayout: 18,
  ...over,
});

function setup(tickets: unknown[], bulk: unknown = { succeeded: ["t1"], failed: [] }) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/admin/tickets/bulk")) return Response.json(bulk);
    return Response.json({ tickets, pagination: { hasMore: false, total: tickets.length } });
  });
  return render(<AdminBoardPage />);
}

function drag(title: string, column: string) {
  const card = screen.getByText(title).closest("li")!;
  const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
  fireEvent(card, Object.assign(createEvent.dragStart(card), { dataTransfer }));
  const lane = screen.getByRole("heading", { name: column }).closest("section")!;
  fireEvent.dragOver(lane);
  fireEvent.drop(lane);
}

const bulkCalls = () =>
  vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/tickets/bulk"));

afterEach(() => {
  vi.restoreAllMocks();
  showToast.mockReset();
});

describe("Admin board drag and drop", () => {
  it("says who gets paid before completing, and moves nothing until confirmed", async () => {
    setup([ticket({})]);
    await screen.findByText("Logo redesign");

    drag("Logo redesign", "Done");

    expect(await screen.findByText(/Ada is paid 18 tokens straight away/)).toBeInTheDocument();
    expect(screen.getByText(/skips customer approval/)).toBeInTheDocument();
    expect(bulkCalls()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Keep it here" }));
    expect(bulkCalls()).toHaveLength(0);
  });

  it("sends the move once confirmed and shows the card in its new column", async () => {
    setup([ticket({})]);
    await screen.findByText("Logo redesign");

    drag("Logo redesign", "Done");
    fireEvent.click(await screen.findByRole("button", { name: "Complete request" }));

    await waitFor(() => expect(bulkCalls()).toHaveLength(1));
    expect(JSON.parse(String(bulkCalls()[0][1]?.body))).toEqual({
      op: "status",
      ticketIds: ["t1"],
      status: "DONE",
    });
    await waitFor(() => {
      const lane = screen.getByRole("heading", { name: "Done" }).closest("section")!;
      expect(lane).toHaveTextContent("Logo redesign");
    });
  });

  it("warns that nobody is paid when nobody is assigned", async () => {
    setup([ticket({ creative: null })]);
    await screen.findByText("Logo redesign");

    drag("Logo redesign", "Done");

    expect(await screen.findByText(/Nobody is assigned, so nobody gets paid/)).toBeInTheDocument();
  });

  it("explains other moves without mentioning payment", async () => {
    setup([ticket({})]);
    await screen.findByText("Logo redesign");

    drag("Logo redesign", "In progress");

    expect(await screen.findByText(/No tokens are charged or refunded/)).toBeInTheDocument();
    expect(screen.queryByText(/is paid/)).toBeNull();
  });

  it("doesn't let a Done card be dragged", async () => {
    setup([ticket({ status: "DONE" })]);
    await screen.findByText("Logo redesign");

    expect(screen.getByText("Logo redesign").closest("li")).toHaveAttribute("draggable", "false");
  });

  it("tells the admin when the server refuses, and reloads", async () => {
    setup([ticket({})], { succeeded: [], failed: [{ id: "t1", error: "Ticket not found" }] });
    await screen.findByText("Logo redesign");

    drag("Logo redesign", "In progress");
    fireEvent.click(await screen.findByRole("button", { name: "Move request" }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", description: "Ticket not found" }),
      ),
    );
    const lane = screen.getByRole("heading", { name: "In review" }).closest("section")!;
    expect(lane).toHaveTextContent("Logo redesign");
  });
});
