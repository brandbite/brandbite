import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStudioPalette } from "@/lib/colors";
import { PALETTE_IDEA_CATALOG } from "@/lib/colors/palette-idea-catalog";

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
  const CATALOG = PALETTE_IDEA_CATALOG.slice(0, 40);
  const ALL = [...IDEAS, ...CATALOG];
  const heading = (count: number) => `${count} palettes to make your own`;

  it("renders its content without loading anything", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<PaletteIdeasView ideas={ALL} />);
    expect(screen.getByText(heading(ALL.length))).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("palette-ideas"))).toBe(false);
  });

  it("links each palette to its own page", () => {
    render(<PaletteIdeasView ideas={IDEAS} />);
    expect(screen.getByRole("link", { name: "Vintage Sunset" })).toHaveAttribute(
      "href",
      "/colors/palettes/vintage-sunset",
    );
  });

  it("loads more in pages, and starts over when the filter changes", () => {
    render(<PaletteIdeasView ideas={ALL} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(24);

    fireEvent.click(screen.getByRole("button", { name: "Load more palettes" }));
    expect(screen.getAllByRole("heading", { level: 3 }).length).toBeGreaterThan(24);

    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "name" } });
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(24);
  });

  it("combines search and tag, and clears both", () => {
    render(<PaletteIdeasView ideas={ALL} />);
    fireEvent.change(screen.getByLabelText("Search palettes"), {
      target: { value: "faded tones" },
    });
    expect(screen.getByText("1 palette to make your own")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Corporate" }));
    expect(screen.getByText("No palettes match your search.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText(heading(ALL.length))).toBeInTheDocument();
  });

  it("separates copying one color from copying the palette", async () => {
    render(<PaletteIdeasView ideas={IDEAS} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy #E8C4A0" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenLastCalledWith("#E8C4A0"));

    fireEvent.click(screen.getAllByRole("button", { name: "Copy palette" })[0]);
    await vi.waitFor(() => expect(writeText).toHaveBeenLastCalledWith("#E8C4A0, #D98859"));
  });

  it("saves to the shared collection", async () => {
    render(<PaletteIdeasView ideas={IDEAS} />);
    const save = screen.getByRole("button", { name: "Save Vintage Sunset" });
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

  it("opens in the generator with colors in order", () => {
    render(<PaletteIdeasView ideas={IDEAS} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Open in generator" })[0]);
    expect(push).toHaveBeenCalledWith("/colors/color-palette-generator");
    const stored = JSON.parse(
      window.sessionStorage.getItem("brandbite.colorStudio.workspace.v1") as string,
    );
    expect(stored.activePalette.colors.map((c: { hex: string }) => c.hex)).toEqual([
      "#e8c4a0",
      "#d98859",
    ]);
  });
});
