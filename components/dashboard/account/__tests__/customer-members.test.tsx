import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CustomerMembersPage from "@/app/customer/members/page";

vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const member = (id: string, name: string, roleInCompany: string) => ({
  id,
  userId: `u-${id}`,
  name,
  email: `${id}@acme.test`,
  roleInCompany,
  joinedAt: "2026-03-06T00:00:00.000Z",
});

const MEMBERS = [
  member("owner", "Olive Owner", "OWNER"),
  member("pm", "Pat Manager", "PM"),
  member("bill", "Bo Billing", "BILLING"),
];

function mockApi(currentUserId: string) {
  const writes: { method: string; url: string; body: unknown }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const method = init?.method ?? "GET";
    if (method !== "GET") {
      writes.push({
        method,
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return Response.json({ ok: true });
    }
    return Response.json({
      company: { id: "c", name: "Acme Studio", slug: "acme" },
      currentUserId,
      members: MEMBERS,
      pendingInvites: [],
    });
  });
  return writes;
}

async function openMember(name: RegExp) {
  fireEvent.click(await screen.findByRole("row", { name }));
  return await screen.findByRole("complementary");
}

afterEach(() => vi.restoreAllMocks());

describe("Company members", () => {
  it("applies a role change only when it's saved", async () => {
    const writes = mockApi("u-owner");
    render(<CustomerMembersPage />);
    const panel = await openMember(/Select Pat Manager/);

    fireEvent.change(within(panel).getByLabelText("Role for Pat Manager"), {
      target: { value: "MEMBER" },
    });
    expect(writes).toEqual([]);

    fireEvent.click(within(panel).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(writes).toEqual([
        {
          method: "PATCH",
          url: "/api/customer/members/pm",
          body: { roleInCompany: "MEMBER" },
        },
      ]),
    );
  });

  it("describes the role being chosen, and cancel restores it", async () => {
    mockApi("u-owner");
    render(<CustomerMembersPage />);
    const panel = await openMember(/Select Pat Manager/);
    const select = within(panel).getByLabelText("Role for Pat Manager") as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "BILLING" } });
    expect(within(panel).getByText(/Manages the plan, billing/)).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    expect(select.value).toBe("PM");
  });

  it("gives a PM no way to change an owner or grant Owner", async () => {
    mockApi("u-pm");
    render(<CustomerMembersPage />);

    const ownerPanel = await openMember(/Select Olive Owner/);
    expect(within(ownerPanel).queryByRole("combobox")).toBeNull();
    expect(within(ownerPanel).queryByRole("button", { name: "Remove member" })).toBeNull();
    expect(within(ownerPanel).getByText(/Only an owner can change/)).toBeInTheDocument();

    const billPanel = await openMember(/Select Bo Billing/);
    const options = within(billPanel)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).not.toContain("Owner");
  });

  it("doesn't offer removing yourself", async () => {
    mockApi("u-owner");
    render(<CustomerMembersPage />);
    const panel = await openMember(/Select Olive Owner/);
    expect(within(panel).queryByRole("button", { name: "Remove member" })).toBeNull();
  });

  it("asks for confirmation before removing someone", async () => {
    const writes = mockApi("u-owner");
    render(<CustomerMembersPage />);
    const panel = await openMember(/Select Pat Manager/);

    fireEvent.click(within(panel).getByRole("button", { name: "Remove member" }));
    expect(writes).toEqual([]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Pat Manager will lose access/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(writes).toEqual([{ method: "DELETE", url: "/api/customer/members/pm", body: null }]),
    );
  });

  it("says so when a filter hides the selected member", async () => {
    mockApi("u-owner");
    render(<CustomerMembersPage />);
    await openMember(/Select Pat Manager/);

    fireEvent.change(screen.getByLabelText("Filter by role"), { target: { value: "BILLING" } });
    expect(screen.getByText("Pat Manager is hidden by this filter")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pat Manager" })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Select Pat Manager/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.queryByText("Pat Manager is hidden by this filter")).toBeNull();
    expect(screen.getByRole("row", { name: /Select Pat Manager/ })).toBeInTheDocument();
  });

  it("warns about an unsaved role change hidden by a filter", async () => {
    mockApi("u-owner");
    render(<CustomerMembersPage />);
    const panel = await openMember(/Select Pat Manager/);

    fireEvent.change(within(panel).getByLabelText("Role for Pat Manager"), {
      target: { value: "MEMBER" },
    });
    fireEvent.change(screen.getByLabelText("Search members"), { target: { value: "bo" } });
    expect(screen.getByText(/Your unsaved role change is still open/)).toBeInTheDocument();
  });

  it("explains the access message to roles that can't manage members", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { error: "Only company owners or project managers can view company members." },
        { status: 403 },
      ),
    );
    render(<CustomerMembersPage />);
    expect(await screen.findByText("You don't have access to manage members")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send invite" })).toBeNull();
  });
});
