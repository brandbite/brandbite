import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStudioPalette, setStudioRole } from "@/lib/colors";

import { SharePaletteButton } from "../share-palette";
import { SharedPaletteView } from "../shared-palette-view";
import { resetWorkspaceStoreForTests } from "../workspace-store";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

function palette() {
  const created = createStudioPalette({
    name: "Ocean",
    hexes: ["#173b59", "#f6e5d5"],
    sourceTool: "generator",
    tags: ["secret-tag"],
  });
  return setStudioRole(created, "text", created.colors[0].id);
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetWorkspaceStoreForTests();
  vi.restoreAllMocks();
});

describe("SharePaletteButton", () => {
  it("explains the link first, and offers copy only after the server responds", async () => {
    let respond: (res: Response) => void = () => {};
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise((resolve) => (respond = resolve)),
    );
    render(<SharePaletteButton palette={palette()} />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByText(/Anyone with this link can view this snapshot/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Create link" }));
    expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();

    await act(async () => {
      respond(new Response(JSON.stringify({ id: "abc" }), { status: 201 }));
    });
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByLabelText("Share link")).toHaveValue(
      `${window.location.origin}/colors/p/abc`,
    );
  });

  it("sends only the name, colors and roles", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "abc" }), { status: 201 }));
    render(<SharePaletteButton palette={palette()} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create link" }));
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(Object.keys(body).sort()).toEqual(["colors", "name", "roles"]);
    expect(Object.keys(body.colors[0]).sort()).toEqual(["hex", "id"]);
  });

  it("shows a failure and no link", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));
    render(<SharePaletteButton palette={palette()} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create link" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't be created/);
    expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
  });
});

describe("SharedPaletteView", () => {
  it("is read-only and labels colors with their roles", () => {
    render(<SharedPaletteView palette={palette()} />);
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lock" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(screen.getAllByText("Text").length).toBeGreaterThan(0);
  });

  it("makes a copy under new ids, leaving the source unchanged", async () => {
    const source = palette();
    const snapshot = structuredClone(source);
    render(<SharedPaletteView palette={source} />);
    const button = screen.getByRole("button", { name: "Make a copy" });
    await vi.waitFor(() => expect(button).toBeEnabled());
    await act(async () => {
      fireEvent.click(button);
    });
    const [copy] = JSON.parse(
      window.localStorage.getItem("brandbite.colorStudio.palettes.v1") as string,
    ).palettes;
    expect(copy.id).not.toBe(source.id);
    expect(copy.colors[0].id).not.toBe(source.colors[0].id);
    expect(copy.roles.text).toBe(copy.colors[0].id);
    expect(source).toEqual(snapshot);
  });
});
