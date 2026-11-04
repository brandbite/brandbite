import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStudioPalette } from "@/lib/colors";

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

import { GuestPalettesNotice } from "../guest-palettes-notice";

const LOCAL_KEY = "brandbite.colorStudio.palettes.v1";

function storePalettes(count: number) {
  const palettes = Array.from({ length: count }, (_, i) =>
    createStudioPalette({ name: `Palette ${i}`, hexes: ["#ff6426"], sourceTool: "ideas" }),
  );
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ version: 1, palettes }));
  return palettes;
}

beforeEach(() => window.localStorage.clear());

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GuestPalettesNotice", () => {
  it("shows nothing when the browser has no palettes", async () => {
    const { container } = render(<GuestPalettesNotice />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing for unreadable browser data", async () => {
    window.localStorage.setItem(LOCAL_KEY, "not json");
    const { container } = render(<GuestPalettesNotice />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it("never moves palettes without a click", async () => {
    storePalettes(2);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<GuestPalettesNotice />);

    expect(await screen.findByText(/This browser has 2 saved palettes/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(LOCAL_KEY)).not.toBeNull();
  });

  it("uses the singular for one palette", async () => {
    storePalettes(1);
    render(<GuestPalettesNotice />);
    expect(await screen.findByText(/This browser has 1 saved palette that/)).toBeInTheDocument();
  });

  it("stays dismissed", async () => {
    storePalettes(1);
    const { unmount } = render(<GuestPalettesNotice />);
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/This browser has/)).toBeNull();
    unmount();

    render(<GuestPalettesNotice />);
    await act(async () => {});
    expect(screen.queryByText(/This browser has/)).toBeNull();
    // Dismissing hides the notice; the palettes themselves stay.
    expect(window.localStorage.getItem(LOCAL_KEY)).not.toBeNull();
  });

  it("clears the browser only after the account accepted the palettes", async () => {
    const palettes = storePalettes(2);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ palettes }), { status: 200 }),
    );
    render(<GuestPalettesNotice />);
    fireEvent.click(await screen.findByRole("button", { name: "Move to my account" }));

    expect(await screen.findByText("Moved 2 saved palettes to your account.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View palettes" })).toHaveAttribute(
      "href",
      "/colors/saved",
    );
    expect(window.localStorage.getItem(LOCAL_KEY)).toBeNull();
  });

  it("keeps the palettes and explains when moving fails", async () => {
    storePalettes(2);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    render(<GuestPalettesNotice />);
    fireEvent.click(await screen.findByRole("button", { name: "Move to my account" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Couldn't reach/));
    expect(window.localStorage.getItem(LOCAL_KEY)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Move to my account" })).toBeEnabled();
  });
});
