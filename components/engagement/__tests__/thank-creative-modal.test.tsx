// -----------------------------------------------------------------------------
// @file: components/engagement/__tests__/thank-creative-modal.test.tsx
// @purpose: The approval window: thank-you tags go to the creative, the
//           optional private rating goes to brandbite, and the owner's switch
//           decides which window opens.
// -----------------------------------------------------------------------------

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetEngagementSwitchesCache } from "@/lib/hooks/use-engagement-switches";

import { ApprovalFeedbackModal, ThankCreativeModal } from "../thank-creative-modal";

function mockFetch(switchOn = true) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/engagement/switches")) {
        return Response.json({ switches: { thankYous: switchOn } });
      }
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return Response.json({}, { status: 201 });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetEngagementSwitchesCache();
});

const props = { open: true, ticketId: "t1", ticketTitle: "Logo", onClose: () => {} };

describe("ThankCreativeModal", () => {
  it("sends the picked tags and no rating when the stars are left empty", async () => {
    const calls = mockFetch();
    const onClose = vi.fn();
    render(<ThankCreativeModal {...props} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Nailed the brief"));
    fireEvent.click(screen.getByLabelText("Great communication"));
    fireEvent.click(screen.getByRole("button", { name: "Send thanks" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls).toEqual([
      {
        url: "/api/customer/tickets/t1/thanks",
        body: { tags: ["NAILED_BRIEF", "GREAT_COMMUNICATION"] },
      },
    ]);
  });

  it("asks for all three scores when the rating is half filled", () => {
    const calls = mockFetch();
    render(<ThankCreativeModal {...props} />);
    fireEvent.click(
      screen.getAllByRole("radio", { name: "5 stars" })[0]!, // Quality only
    );
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Score all three/);
    expect(calls).toEqual([]);
  });

  it("sends the private rating when all three are scored", async () => {
    const calls = mockFetch();
    const onClose = vi.fn();
    render(<ThankCreativeModal {...props} onClose={onClose} />);
    for (const star of screen.getAllByRole("radio", { name: "4 stars" })) fireEvent.click(star);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls).toEqual([
      {
        url: "/api/customer/tickets/t1/rating",
        body: { quality: 4, communication: 4, speed: 4 },
      },
    ]);
  });

  it("can't send with nothing chosen, but can be skipped", () => {
    mockFetch();
    const onClose = vi.fn();
    render(<ThankCreativeModal {...props} onClose={onClose} />);
    expect(screen.getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("ApprovalFeedbackModal", () => {
  it("opens the thank-you window when the owner switched it on", async () => {
    mockFetch(true);
    render(<ApprovalFeedbackModal {...props} />);
    expect(await screen.findByText("Thank your creative")).toBeTruthy();
  });

  it("keeps the rating-only window when it's off", async () => {
    mockFetch(false);
    render(<ApprovalFeedbackModal {...props} />);
    expect(await screen.findByText("How did this request go?")).toBeTruthy();
    expect(screen.queryByText("Thank your creative")).toBeNull();
  });
});
