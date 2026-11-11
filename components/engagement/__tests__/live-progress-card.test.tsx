// -----------------------------------------------------------------------------
// @file: components/engagement/__tests__/live-progress-card.test.tsx
// @purpose: The customer's live progress card: hidden when the owner's switch
//           is off, shows the step and the running timer when on.
// -----------------------------------------------------------------------------

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatClock, LiveProgressCard, progressMessage } from "../live-progress-card";

function mockProgress(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body))),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("LiveProgressCard", () => {
  it("renders nothing while the feature is switched off", async () => {
    mockProgress({ enabled: false });
    const { container } = render(<LiveProgressCard ticketId="t1" status="IN_PROGRESS" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("shows the current step and the running timer", async () => {
    mockProgress({
      enabled: true,
      status: "IN_PROGRESS",
      isAssigned: true,
      timerStartedAt: new Date(Date.now() - 65_000).toISOString(),
    });
    render(<LiveProgressCard ticketId="t1" status="IN_PROGRESS" />);
    expect(await screen.findByText("Timer running")).toBeTruthy();
    expect(screen.getByText("Your creative is working on this request now.")).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toMatch(/^00:01:0\d$/);
    expect(
      screen
        .getByText(/In progress/)
        .closest("li")
        ?.getAttribute("aria-current"),
    ).toBe("step");
  });

  it("has no timer when the creative isn't working right now", async () => {
    mockProgress({ enabled: true, status: "IN_PROGRESS", isAssigned: true, timerStartedAt: null });
    render(<LiveProgressCard ticketId="t1" status="IN_PROGRESS" />);
    expect(await screen.findByText("Your creative has started on this request.")).toBeTruthy();
    expect(screen.queryByText("Timer running")).toBeNull();
  });

  it("asks the page to reload when the status has moved on", async () => {
    mockProgress({ enabled: true, status: "IN_REVIEW", isAssigned: true, timerStartedAt: null });
    const onStatusChange = vi.fn();
    render(<LiveProgressCard ticketId="t1" status="IN_PROGRESS" onStatusChange={onStatusChange} />);
    await waitFor(() => expect(onStatusChange).toHaveBeenCalled());
  });
});

describe("helpers", () => {
  it("formats the clock", () => {
    expect(formatClock(0)).toBe("00:00:00");
    expect(formatClock(3725)).toBe("01:02:05");
  });

  it("words each step", () => {
    expect(progressMessage("TODO", false, false)).toMatch(/queue/);
    expect(progressMessage("IN_REVIEW", true, false)).toMatch(/your turn/);
  });
});
