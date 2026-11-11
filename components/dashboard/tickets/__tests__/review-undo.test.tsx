// -----------------------------------------------------------------------------
// @file: components/dashboard/tickets/__tests__/review-undo.test.tsx
// @purpose: The one-minute Undo after sending a version: offered as a toast
//           button for what is left of the minute, pulls the request back
//           when clicked, and isn't offered once the minute is nearly over.
// -----------------------------------------------------------------------------

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { offerReviewUndo } from "@/components/dashboard/tickets/review-undo";
import { ToastProvider, useToast } from "@/components/ui/toast-provider";
import { canUndoReview, undoMsLeft } from "@/lib/tickets/review-undo";

function Sender({ sentAtMs, onUndone }: { sentAtMs: number; onUndone: () => void }) {
  const { showToast } = useToast();
  return (
    <button onClick={() => offerReviewUndo({ showToast, ticketId: "t1", sentAtMs, onUndone })}>
      send
    </button>
  );
}

const renderSender = (sentAtMs: number, onUndone = vi.fn()) => {
  render(
    <ToastProvider>
      <Sender sentAtMs={sentAtMs} onUndone={onUndone} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByText("send"));
  return onUndone;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the undo rule", () => {
  it("lasts a minute and ends once the customer answered", () => {
    const sent = new Date("2026-01-01T10:00:00Z");
    const at = (s: number) => new Date(sent.getTime() + s * 1000);
    expect(canUndoReview({ submittedAt: sent, feedbackAt: null }, at(59))).toBe(true);
    expect(canUndoReview({ submittedAt: sent, feedbackAt: null }, at(90))).toBe(false);
    expect(canUndoReview({ submittedAt: sent, feedbackAt: at(5) }, at(10))).toBe(false);
    expect(undoMsLeft(0, 45_000)).toBe(15_000);
    expect(undoMsLeft(0, 70_000)).toBe(0);
  });
});

describe("offerReviewUndo", () => {
  it("pulls the request back when Undo is clicked", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ undone: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onUndone = renderSender(Date.now());

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(onUndone).toHaveBeenCalled());
    expect(
      JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string),
    ).toEqual({
      id: "t1",
      status: "IN_PROGRESS",
    });
    expect(screen.getByText("Version withdrawn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("takes Undo away when the minute is over", async () => {
    vi.useFakeTimers();
    renderSender(Date.now() - 50_000);
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(11_000);
    });
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("doesn't offer Undo when almost no time is left", () => {
    renderSender(Date.now() - 58_000);
    expect(screen.getByText("Version sent for review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });
});
