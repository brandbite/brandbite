import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStudioPalette } from "@/lib/colors";

import { PaletteGeneratorView } from "../palette-generator-view";
import { TailwindShadesView } from "../tailwind-shades-view";
import { resetWorkspaceStoreForTests, workspaceActions } from "../workspace-store";

const push = vi.fn();
const writeText = vi.fn(() => Promise.resolve());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

function workspace() {
  const raw = window.sessionStorage.getItem("brandbite.colorStudio.workspace.v1");
  return raw ? JSON.parse(raw) : null;
}

const hexes = () => workspace().activePalette.colors.map((c: { hex: string }) => c.hex);

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetWorkspaceStoreForTests();
  push.mockClear();
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

describe("TailwindShadesView", () => {
  it("defaults to Tailwind v4 output, with v3 and CSS available", () => {
    render(<TailwindShadesView />);
    expect(screen.getByText(/@theme \{/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tailwind v3" }));
    expect(screen.getByText(/colors: \{/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "CSS variables" }));
    expect(screen.getByText(/:root \{/)).toBeInTheDocument();
  });

  it("starts from the color selected in another tool", () => {
    const palette = createStudioPalette({
      name: "Ocean",
      hexes: ["#173b59", "#41c2d0"],
      sourceTool: "generator",
    });
    workspaceActions.load(palette, palette.colors[1].id);
    render(<TailwindShadesView />);
    expect(screen.getByLabelText("Base color")).toHaveValue("#41C2D0");
  });

  it("keeps copying, inspecting and setting the base separate", async () => {
    render(<TailwindShadesView />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect shade 200" }));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Base color")).toHaveValue("#FF6426");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Copy shade 200/ }));
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Base color")).toHaveValue("#FF6426");

    fireEvent.click(screen.getByRole("button", { name: "Set as base" }));
    expect(screen.getByLabelText("Base color")).not.toHaveValue("#FF6426");
  });

  it("writes base color changes back to the active palette", () => {
    const palette = createStudioPalette({
      name: "Ocean",
      hexes: ["#173b59", "#41c2d0"],
      sourceTool: "generator",
    });
    workspaceActions.load(palette);
    render(<TailwindShadesView />);
    fireEvent.change(screen.getByLabelText("Base color"), { target: { value: "#000000" } });
    expect(hexes()).toEqual(["#000000", "#41c2d0"]);
    expect(workspace().dirty).toBe(true);
  });
});

describe("PaletteGeneratorView", () => {
  it("generates under the chosen harmony and undoes in one step", () => {
    render(<PaletteGeneratorView />);
    fireEvent.click(screen.getByRole("button", { name: "Generate palette" }));
    const generated = hexes();
    expect(generated).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(hexes()).toEqual(["#173b59", "#41c2d0", "#c9f1ed", "#ff6426", "#f6e5d5"]);

    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(hexes()).toEqual(generated);
  });

  it("keeps locked colors when generating", () => {
    render(<PaletteGeneratorView />);
    fireEvent.click(screen.getAllByRole("button", { name: "Lock" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Generate palette" }));
    expect(hexes()[1]).toBe("#41c2d0");
    expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
  });

  it("generates with Space, but not from inside a field", () => {
    render(<PaletteGeneratorView />);
    fireEvent.keyDown(screen.getByLabelText("Harmony"), { code: "Space" });
    expect(workspace()).toBeNull();

    fireEvent.keyDown(document.body, { code: "Space" });
    expect(workspace().undoStack).toBeUndefined();
    expect(workspace().dirty).toBe(true);
  });

  it("shows Custom after a manual color change", () => {
    render(<PaletteGeneratorView />);
    fireEvent.change(screen.getByLabelText("Selected color"), { target: { value: "#000000" } });
    expect(screen.getByLabelText("Harmony")).toHaveValue("custom");
  });

  it("reorders with Move buttons, and roles follow the color", () => {
    render(<PaletteGeneratorView />);
    fireEvent.click(screen.getByRole("button", { name: "Move #173B59 right" }));
    expect(hexes().slice(0, 2)).toEqual(["#41c2d0", "#173b59"]);
    expect(screen.getByRole("button", { name: "Move #41C2D0 left" })).toBeDisabled();
  });

  it("adds and removes colors within limits, skipping locked ones", () => {
    render(<PaletteGeneratorView />);
    fireEvent.click(screen.getByRole("button", { name: "Add a color" }));
    expect(hexes()).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Remove a color" }));
    expect(hexes()).toHaveLength(5);
  });

  it("tells the user when removing a color clears a role", () => {
    render(<PaletteGeneratorView />);
    const textRole = screen.getByLabelText("Text") as HTMLSelectElement;
    fireEvent.change(textRole, { target: { value: textRole.options[5].value } });
    fireEvent.click(screen.getByRole("button", { name: "Remove a color" }));
    expect(screen.getByText(/cleared the text role/)).toBeInTheDocument();
  });

  it("counts a slider drag as one undo step", () => {
    render(<PaletteGeneratorView />);
    const slider = screen.getByLabelText(/Lightness/);
    fireEvent.change(slider, { target: { value: "40" } });
    fireEvent.change(slider, { target: { value: "45" } });
    fireEvent.change(slider, { target: { value: "50" } });
    fireEvent.pointerUp(slider);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(hexes()[0]).toBe("#173b59");
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("saves under a new id each time from the starter, then updates", async () => {
    render(<PaletteGeneratorView />);
    const save = await screen.findByRole("button", { name: "Save palette" });
    await vi.waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    fireEvent.change(screen.getByLabelText("Palette name"), { target: { value: "Coast" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    const stored = JSON.parse(
      window.localStorage.getItem("brandbite.colorStudio.palettes.v1") as string,
    );
    expect(stored.palettes[0].name).toBe("Coast");
    expect(stored.palettes[0].id).not.toBe("starter-palette");
    expect(workspace().dirty).toBe(false);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });
});
