import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStudioPalette } from "@/lib/colors";

import { ColorWheelView } from "../color-wheel-view";
import { PaletteIdeasView } from "../palette-ideas-view";
import { resetWorkspaceStoreForTests, workspaceActions } from "../workspace-store";

const push = vi.fn();
const writeText = vi.fn(() => Promise.resolve());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

const IDEAS = [
  {
    id: "1",
    title: "Vintage Sunset",
    slug: "vintage-sunset",
    summary: "Warm, faded tones.",
    colors: ["#e8c4a0", "#d98859"],
    tags: ["Vintage", "Warm"],
  },
  {
    id: "2",
    title: "Corporate Trust",
    slug: "corporate-trust",
    summary: "Confident blues.",
    colors: ["#1d3557", "#457b9d"],
    tags: ["Corporate", "Cool"],
  },
];

function mockIdeas(ideas: unknown = IDEAS, ok = true) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ideas }), { status: ok ? 200 : 500 }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetWorkspaceStoreForTests();
  push.mockClear();
  writeText.mockClear();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

describe("ColorWheelView", () => {
  it("starts from the workspace's selected color", () => {
    workspaceActions.load(
      createStudioPalette({ name: "Ocean", hexes: ["#173b59"], sourceTool: "generator" }),
    );
    render(<ColorWheelView />);
    expect(screen.getByLabelText("Base color")).toHaveValue("#173B59");
  });

  it("offers keyboard control on the wheel", () => {
    render(<ColorWheelView />);
    const wheel = screen.getByRole("slider", { name: /Color wheel/ });
    expect(wheel).toHaveAttribute("tabindex", "0");
    const before = wheel.getAttribute("aria-valuetext");
    fireEvent.keyDown(wheel, { key: "ArrowRight" });
    expect(
      screen.getByRole("slider", { name: /Color wheel/ }).getAttribute("aria-valuetext"),
    ).not.toBe(before);
  });

  it("changes the palette with the harmony and has separate copy rows", () => {
    render(<ColorWheelView />);
    expect(screen.getAllByRole("button", { name: /^Copy HEX #/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Copy RGB / })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Copy HSL / })).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Triadic" }));
    expect(screen.getAllByRole("button", { name: /^Copy HEX #/ })).toHaveLength(3);
  });

  it("opens the harmony in the generator", () => {
    render(<ColorWheelView />);
    fireEvent.click(screen.getByRole("button", { name: "Open in generator" }));
    expect(push).toHaveBeenCalledWith("/colors/color-palette-generator");
  });
});

describe("PaletteIdeasView", () => {
  it("combines search and tag, and clears both", async () => {
    mockIdeas();
    render(<PaletteIdeasView />);
    await screen.findByText("2 palettes to make your own");

    fireEvent.click(screen.getByRole("button", { name: "Vintage" }));
    expect(screen.getByText("1 palette to make your own")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search palettes"), { target: { value: "blues" } });
    expect(screen.getByText("No palettes match your search.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("2 palettes to make your own")).toBeInTheDocument();
  });

  it("separates copying one color from copying the palette", async () => {
    mockIdeas();
    render(<PaletteIdeasView />);
    fireEvent.click(await screen.findByRole("button", { name: "Copy #E8C4A0" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenLastCalledWith("#E8C4A0"));

    fireEvent.click(screen.getAllByRole("button", { name: "Copy palette" })[0]);
    await vi.waitFor(() => expect(writeText).toHaveBeenLastCalledWith("#E8C4A0, #D98859"));
  });

  it("saves to the shared collection", async () => {
    mockIdeas();
    render(<PaletteIdeasView />);
    const save = await screen.findByRole("button", { name: "Save Vintage Sunset" });
    await vi.waitFor(() => expect(save).toBeEnabled());
    await act(async () => {
      fireEvent.click(save);
    });
    const [saved] = JSON.parse(
      window.localStorage.getItem("brandbite.colorStudio.palettes.v1") as string,
    ).palettes;
    expect(saved.name).toBe("Vintage Sunset");
    expect(saved.sourceTool).toBe("ideas");
    expect(saved.tags).toEqual(["Vintage", "Warm"]);
  });

  it("opens in the generator with colors in order", async () => {
    mockIdeas();
    render(<PaletteIdeasView />);
    const [open] = await screen.findAllByRole("button", { name: "Open in generator" });
    fireEvent.click(open);
    expect(push).toHaveBeenCalledWith("/colors/color-palette-generator");
    const stored = JSON.parse(
      window.sessionStorage.getItem("brandbite.colorStudio.workspace.v1") as string,
    );
    expect(stored.activePalette.colors.map((c: { hex: string }) => c.hex)).toEqual([
      "#e8c4a0",
      "#d98859",
    ]);
  });

  it("separates nothing published from a load failure, and can retry", async () => {
    mockIdeas([]);
    const { unmount } = render(<PaletteIdeasView />);
    expect(await screen.findByText(/No palettes published yet/)).toBeInTheDocument();
    unmount();

    mockIdeas(null, false);
    render(<PaletteIdeasView />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't be loaded/);
    mockIdeas();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("2 palettes to make your own")).toBeInTheDocument();
  });
});
