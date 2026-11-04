import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStudioPalette, setStudioRole } from "@/lib/colors";

import { ContrastCheckerView } from "../contrast-checker-view";
import { resetWorkspaceStoreForTests, workspaceActions } from "../workspace-store";

const LOCAL_KEY = "brandbite.colorStudio.palettes.v1";
const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

const ratio = () => screen.getByTestId("contrast-ratio").textContent;

function setHex(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetWorkspaceStoreForTests();
  push.mockClear();
});

describe("ContrastCheckerView", () => {
  it("shows the extremes and the reference pairs", () => {
    render(<ContrastCheckerView />);
    expect(ratio()).toBe("11.62:1");

    setHex("Foreground (text)", "#000000");
    expect(ratio()).toBe("21.00:1");

    setHex("Background", "#000000");
    expect(ratio()).toBe("1.00:1");

    setHex("Foreground (text)", "#FF6426");
    setHex("Background", "#FFFFFF");
    expect(ratio()).toBe("2.95:1");
  });

  it("reports the four results independently", () => {
    render(<ContrastCheckerView />);
    setHex("Foreground (text)", "#C2410C");
    const verdict = (label: string) =>
      screen.getByText(label).closest("li")?.textContent?.includes("Pass");
    expect(verdict("AA normal text")).toBe(true);
    expect(verdict("AAA normal text")).toBe(false);
    expect(verdict("AA large text")).toBe(true);
    expect(verdict("AAA large text")).toBe(true);
  });

  it("swaps colors", () => {
    render(<ContrastCheckerView />);
    fireEvent.click(screen.getByRole("button", { name: "Swap colors" }));
    expect(screen.getByLabelText("Foreground (text)")).toHaveValue("#FFFFFF");
    expect(screen.getByLabelText("Background")).toHaveValue("#173B59");
  });

  it("classifies text size and weight using the WCAG limits", () => {
    render(<ContrastCheckerView />);
    expect(screen.getByText(/counts as normal text/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Text size"), { target: { value: "24" } });
    expect(screen.getByText(/counts as large text/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Text size"), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "700" } });
    expect(screen.getByText(/counts as normal text/)).toBeInTheDocument();
  });

  it("applies sample text, size and weight to the preview", () => {
    render(<ContrastCheckerView />);
    fireEvent.change(screen.getByLabelText("Sample text"), { target: { value: "Hello" } });
    fireEvent.change(screen.getByLabelText("Text size"), { target: { value: "32" } });
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "700" } });
    const sample = screen.getByTestId("contrast-sample");
    expect(sample).toHaveTextContent("Hello");
    expect(sample).toHaveStyle({ fontSize: "32px", fontWeight: "700" });
  });

  it("suggests only for failing pairs, and Apply can be undone", () => {
    render(<ContrastCheckerView />);
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();

    setHex("Foreground (text)", "#FF6426");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(parseFloat(ratio() ?? "0")).toBeGreaterThanOrEqual(4.5);
    expect(screen.getByLabelText("Foreground (text)")).not.toHaveValue("#FF6426");

    fireEvent.click(screen.getByRole("button", { name: "Undo suggestion" }));
    expect(screen.getByLabelText("Foreground (text)")).toHaveValue("#FF6426");
  });

  it("uses text and background roles from the active palette", () => {
    const palette = createStudioPalette({
      name: "Ocean",
      hexes: ["#173b59", "#f6e5d5"],
      sourceTool: "generator",
    });
    const withText = setStudioRole(palette, "text", palette.colors[0].id);
    workspaceActions.load(setStudioRole(withText, "background", palette.colors[1].id));
    render(<ContrastCheckerView />);
    expect(screen.getByLabelText("Foreground (text)")).toHaveValue("#173B59");
    expect(screen.getByLabelText("Background")).toHaveValue("#F6E5D5");
    expect(screen.queryByText(/has no text and background roles/)).toBeNull();
  });

  it("asks for two colors when the palette has no roles", () => {
    workspaceActions.load(
      createStudioPalette({
        name: "Plain",
        hexes: ["#111111", "#eeeeee"],
        sourceTool: "generator",
      }),
    );
    render(<ContrastCheckerView />);
    expect(screen.getByText(/Plain has no text and background roles/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Text color"), { target: { value: "#111111" } });
    expect(screen.getByLabelText("Foreground (text)")).toHaveValue("#111111");
  });

  it("saves a pairing with its roles and lists it", async () => {
    render(<ContrastCheckerView />);
    const save = await screen.findByRole("button", { name: "Save pairing" });
    await vi.waitFor(() => expect(save).toBeEnabled());
    await act(async () => {
      fireEvent.click(save);
    });

    const [saved] = JSON.parse(window.localStorage.getItem(LOCAL_KEY) as string).palettes;
    expect(saved.sourceTool).toBe("contrast");
    expect(saved.roles.text).toBe(saved.colors[0].id);
    expect(saved.roles.background).toBe(saved.colors[1].id);
    expect(screen.getByRole("heading", { name: "Saved pairings" })).toBeInTheDocument();
  });

  it("takes the pair to the generator with roles", () => {
    render(<ContrastCheckerView />);
    fireEvent.click(screen.getByRole("button", { name: "Use in palette" }));
    expect(push).toHaveBeenCalledWith("/colors/color-palette-generator");
    const stored = JSON.parse(
      window.sessionStorage.getItem("brandbite.colorStudio.workspace.v1") as string,
    );
    expect(stored.activePalette.colors.map((c: { hex: string }) => c.hex)).toEqual([
      "#173b59",
      "#ffffff",
    ]);
    expect(stored.activePalette.roles.text).toBeDefined();
  });

  it("does not claim overall accessibility", () => {
    render(<ContrastCheckerView />);
    expect(screen.getByText(/don't measure\s+overall accessibility/)).toBeInTheDocument();
  });
});
