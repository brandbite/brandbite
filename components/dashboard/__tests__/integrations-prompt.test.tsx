import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IntegrationsPrompt } from "@/components/dashboard/integrations-prompt";

type Status = "CONNECTED" | "BROKEN" | "NOT_CONNECTED";

function mockApi(
  drive: { available: boolean; status: Status },
  dropbox: { available: boolean; status: Status },
  canManage = true,
) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      canManage,
      integrations: [
        { provider: "GOOGLE_DRIVE", label: "Google Drive", slug: "google-drive", ...drive },
        { provider: "DROPBOX", label: "Dropbox", slug: "dropbox", ...dropbox },
        {
          provider: "SLACK",
          label: "Slack",
          slug: "slack",
          available: false,
          status: "NOT_CONNECTED",
        },
      ],
    }),
  );
}

const off = { available: true, status: "NOT_CONNECTED" as const };

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("IntegrationsPrompt", () => {
  it("tells owners why to connect and offers both providers", async () => {
    mockApi(off, off);
    render(<IntegrationsPrompt />);
    expect(
      await screen.findByRole("heading", { name: "Keep your source files in your own storage" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/deleted from brandbite 90 days after a request is done/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect Google Drive" })).toHaveAttribute(
      "href",
      "/api/customer/integrations/google-drive/connect",
    );
    expect(screen.getByRole("link", { name: "Connect Dropbox" })).toHaveAttribute(
      "href",
      "/api/customer/integrations/dropbox/connect",
    );
  });

  it("stays away once either storage is connected", async () => {
    mockApi({ available: true, status: "CONNECTED" }, off);
    const { container } = render(<IntegrationsPrompt />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing while neither provider is set up on our side", async () => {
    mockApi(
      { available: false, status: "NOT_CONNECTED" },
      { available: false, status: "NOT_CONNECTED" },
    );
    const { container } = render(<IntegrationsPrompt />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("tells members who can connect, without Connect buttons", async () => {
    mockApi(off, off, false);
    render(<IntegrationsPrompt />);
    expect(
      await screen.findByText(/Your company owner or a project manager can connect it/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Connect/ })).toBeNull();
  });

  it("hides for 30 days after Not now", async () => {
    mockApi(off, off);
    const { unmount } = render(<IntegrationsPrompt />);
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("heading", { name: /Keep your source files/ })).toBeNull();
    unmount();

    render(<IntegrationsPrompt />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("heading", { name: /Keep your source files/ })).toBeNull();
  });

  it("asks to reconnect a broken connection, even after Not now", async () => {
    window.localStorage.setItem("bb-integrations-prompt-dismissed-until", String(Date.now() + 1e9));
    mockApi({ available: true, status: "BROKEN" }, off);
    render(<IntegrationsPrompt />);
    expect(
      await screen.findByRole("heading", { name: "Google Drive needs reconnecting" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reconnect Google Drive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Not now" })).toBeNull();
  });
});
