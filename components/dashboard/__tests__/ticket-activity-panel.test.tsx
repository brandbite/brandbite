import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TicketActivityPanel } from "@/components/dashboard/ticket-activity-panel";

function mockActivity(body: unknown, status = 200) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(body, { status }));
}

const activity = [
  { id: "b", at: "2026-11-05T10:00:00.000Z", actor: "You", summary: "created this request" },
  {
    id: "a",
    at: "2026-11-04T10:00:00.000Z",
    actor: "Your creative",
    summary: "submitted version 1",
  },
];

afterEach(() => vi.restoreAllMocks());

describe("TicketActivityPanel", () => {
  it("loads from the given url and lists entries in the order it receives", async () => {
    mockActivity({ activity, partialHistory: false });
    render(<TicketActivityPanel url="/api/x/activity" />);
    expect(await screen.findByText("Your creative")).toBeInTheDocument();
    expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toBe("/api/x/activity");
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("You created this request");
    expect(rows[1]).toHaveTextContent("Your creative submitted version 1");
  });

  it("says when older history may be incomplete, only when it may be", async () => {
    mockActivity({ activity, partialHistory: true });
    const { unmount } = render(<TicketActivityPanel url="/a" />);
    expect(await screen.findByText(/Older activity may be incomplete/)).toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();

    mockActivity({ activity, partialHistory: false });
    render(<TicketActivityPanel url="/a" />);
    await screen.findByText("Your creative");
    expect(screen.queryByText(/Older activity may be incomplete/)).toBeNull();
  });

  it("explains a failed load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockActivity({ error: "Ticket not found" }, 404);
    render(<TicketActivityPanel url="/a" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Ticket not found");
  });
});
