import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuideVote } from "../guide-vote";

function mockApi(saved: boolean | null, putStatus = 200) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    if (init?.method === "PUT") {
      return Response.json({}, { status: putStatus });
    }
    return Response.json({ helpful: saved });
  });
}

const yes = () => screen.getByRole("button", { name: "Yes" });
const no = () => screen.getByRole("button", { name: "No" });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GuideVote", () => {
  it("shows the person's earlier answer", async () => {
    mockApi(false);
    render(<GuideVote slug="tokens" />);
    await waitFor(() => expect(no()).toHaveAttribute("aria-pressed", "true"));
    expect(yes()).toHaveAttribute("aria-pressed", "false");
  });

  it("saves an answer for this guide and thanks the person", async () => {
    const fetchMock = mockApi(null);
    render(<GuideVote slug="tokens" />);
    await waitFor(() => expect(yes()).toBeEnabled());

    fireEvent.click(yes());

    await waitFor(() => expect(yes()).toHaveAttribute("aria-pressed", "true"));
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ slug: "tokens", helpful: true });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Thanks"));
  });

  it("lets the person change their answer, and doesn't resend the same one", async () => {
    const fetchMock = mockApi(true);
    render(<GuideVote slug="tokens" />);
    await waitFor(() => expect(yes()).toHaveAttribute("aria-pressed", "true"));

    fireEvent.click(yes());
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);

    fireEvent.click(no());
    await waitFor(() => expect(no()).toHaveAttribute("aria-pressed", "true"));
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
  });

  it("goes back to the earlier answer and says so when saving fails", async () => {
    mockApi(true, 500);
    render(<GuideVote slug="tokens" />);
    await waitFor(() => expect(yes()).toHaveAttribute("aria-pressed", "true"));

    fireEvent.click(no());

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't save");
    expect(yes()).toHaveAttribute("aria-pressed", "true");
    expect(no()).toHaveAttribute("aria-pressed", "false");
  });

  it("still takes an answer when the earlier one can't be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
    render(<GuideVote slug="tokens" />);
    await waitFor(() => expect(yes()).toBeEnabled());
    expect(yes()).toHaveAttribute("aria-pressed", "false");
  });
});
