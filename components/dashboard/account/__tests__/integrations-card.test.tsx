import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IntegrationsCard } from "@/components/dashboard/account/integrations-card";

vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

type Status = "CONNECTED" | "BROKEN" | "NOT_CONNECTED";

const integration = (
  provider: "GOOGLE_DRIVE" | "DROPBOX" | "SLACK",
  label: string,
  slug: string,
  overrides: { available?: boolean; status?: Status; accountLabel?: string | null } = {},
) => ({
  provider,
  label,
  slug,
  available: overrides.available ?? false,
  status: overrides.status ?? "NOT_CONNECTED",
  accountLabel: overrides.accountLabel ?? null,
  connectedAt:
    overrides.status && overrides.status !== "NOT_CONNECTED" ? "2026-11-10T09:00:00Z" : null,
  connectedBy: overrides.status && overrides.status !== "NOT_CONNECTED" ? "Olive Owner" : null,
  lastError: null,
});

function mockApi(driveStatus: Status, canManage: boolean) {
  const calls: { method: string; url: string }[] = [];
  let status = driveStatus;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url: String(input) });
    if (method === "DELETE") {
      status = "NOT_CONNECTED";
      return Response.json({ ok: true });
    }
    return Response.json({
      canManage,
      integrations: [
        integration("GOOGLE_DRIVE", "Google Drive", "google-drive", {
          available: true,
          status,
          accountLabel: status === "NOT_CONNECTED" ? null : "design@acme.test",
        }),
        integration("DROPBOX", "Dropbox", "dropbox"),
        integration("SLACK", "Slack", "slack"),
      ],
    });
  });
  return calls;
}

const row = (label: string) => screen.getByText(label, { selector: "p" }).closest("li")!;

afterEach(() => vi.restoreAllMocks());

describe("IntegrationsCard", () => {
  it("lets an owner connect Google Drive and shows the others as coming soon", async () => {
    mockApi("NOT_CONNECTED", true);
    render(<IntegrationsCard />);

    const connect = await screen.findByRole("link", { name: "Connect Google Drive" });
    expect(connect).toHaveAttribute("href", "/api/customer/integrations/google-drive/connect");
    expect(within(row("Dropbox")).getByText("Coming soon")).toBeInTheDocument();
    expect(within(row("Slack")).queryByRole("link")).toBeNull();
  });

  it("shows the connected account and disconnects after confirming", async () => {
    const calls = mockApi("CONNECTED", true);
    render(<IntegrationsCard />);

    expect(await screen.findByText(/design@acme\.test/)).toBeInTheDocument();
    expect(within(row("Google Drive")).getByText("Connected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/kept for 90 days/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));

    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "DELETE",
        url: "/api/customer/integrations/google-drive",
      }),
    );
    expect(await screen.findByRole("link", { name: "Connect Google Drive" })).toBeInTheDocument();
  });

  it("asks to reconnect a broken connection", async () => {
    mockApi("BROKEN", true);
    render(<IntegrationsCard />);
    expect(await screen.findByText("Needs reconnecting")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reconnect" })).toHaveAttribute(
      "href",
      "/api/customer/integrations/google-drive/connect",
    );
  });

  it("is read-only for members who can't manage integrations", async () => {
    mockApi("CONNECTED", false);
    render(<IntegrationsCard />);
    expect(await screen.findByText(/Only company owners and project managers/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Connect/ })).toBeNull();
  });

  it("reports the result of the connect round trip", async () => {
    mockApi("CONNECTED", true);
    render(
      <IntegrationsCard result={{ slug: "google-drive", ok: true, message: "design@acme.test" }} />,
    );
    expect(await screen.findByText("Google Drive is connected")).toBeInTheDocument();
    expect(screen.getByText("Connected as design@acme.test.")).toBeInTheDocument();
  });
});
