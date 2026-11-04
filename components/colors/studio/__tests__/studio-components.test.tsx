import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStudioPalette } from "@/lib/colors";

import { CopyFallback } from "../copy-fallback";
import { HexField } from "../hex-field";
import { StudioButton } from "../studio-button";
import { StudioSwatch } from "../studio-swatch";
import { ToolNav } from "../tool-nav";
import { useStudioCopy } from "../use-studio-copy";
import { resetWorkspaceStoreForTests, useWorkspace, workspaceActions } from "../workspace-store";

const showToast = vi.fn();
let pathname = "/colors";

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ showToast }),
}));

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

beforeEach(() => {
  showToast.mockClear();
  pathname = "/colors";
  mockClipboard(() => Promise.resolve());
});

describe("ToolNav", () => {
  const more = [{ href: "/colors/contrast-checker", label: "Contrast checker" }];

  it("marks the current tool", () => {
    pathname = "/colors/color-wheel";
    render(<ToolNav />);
    expect(screen.getByRole("link", { name: "Color wheel" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("keeps a tool active on its nested pages", () => {
    pathname = "/colors/color-meanings/orange";
    render(<ToolNav />);
    expect(screen.getByRole("link", { name: "Color meanings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("hides More tools and Saved until they exist", () => {
    render(<ToolNav />);
    expect(screen.queryByRole("button", { name: /more tools/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /saved/i })).toBeNull();
  });

  it("closes More tools on Escape and returns focus to the button", () => {
    render(<ToolNav moreTools={more} />);
    const button = screen.getByRole("button", { name: /more tools/i });

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Contrast checker" })).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("closes More tools on an outside click", () => {
    render(<ToolNav moreTools={more} />);
    const button = screen.getByRole("button", { name: /more tools/i });
    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});

describe("HexField", () => {
  it("emits normalized colors while keeping the typed text", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <HexField label="Background" value="#ffffff" onChange={onChange} />,
    );
    const input = screen.getByLabelText("Background") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "#abc" } });
    expect(onChange).toHaveBeenCalledWith("#aabbcc");

    rerender(<HexField label="Background" value="#aabbcc" onChange={onChange} />);
    expect(input.value).toBe("#abc");

    fireEvent.blur(input);
    expect(input.value).toBe("#AABBCC");
  });

  it("does not emit partial input, and shows an error only on blur", () => {
    const onChange = vi.fn();
    render(<HexField label="Background" value="#ffffff" onChange={onChange} />);
    const input = screen.getByLabelText("Background");

    fireEvent.change(input, { target: { value: "#ab" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/3 or 6 digit/)).toBeNull();

    fireEvent.blur(input);
    expect(screen.getByText(/3 or 6 digit/)).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("rejects alpha colors", () => {
    const onChange = vi.fn();
    render(<HexField label="Background" value="#ffffff" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Background"), { target: { value: "#ff642680" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("replaces the draft when the value changes from outside", () => {
    const { rerender } = render(<HexField label="Text" value="#ffffff" onChange={() => {}} />);
    rerender(<HexField label="Text" value="#173b59" onChange={() => {}} />);
    expect(screen.getByLabelText("Text")).toHaveValue("#173B59");
  });
});

describe("StudioSwatch", () => {
  it("labels the lock with the action it performs", () => {
    const { rerender } = render(<StudioSwatch hex="#173b59" onToggleLock={() => {}} />);
    expect(screen.getByRole("button", { name: "Lock" })).toHaveAttribute("aria-pressed", "false");
    rerender(<StudioSwatch hex="#173b59" locked onToggleLock={() => {}} />);
    expect(screen.getByRole("button", { name: "Unlock" })).toHaveAttribute("aria-pressed", "true");
  });

  it("copies from the color area with an announced 3 second toast", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    mockClipboard(writeText);
    render(<StudioSwatch hex="#173b59" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy #173B59" }));
    });
    expect(writeText).toHaveBeenCalledWith("#173B59");
    expect(showToast).toHaveBeenCalledWith({
      type: "success",
      title: "Copied #173B59",
      durationMs: 3000,
    });
  });

  it("keeps edit separate from copy", () => {
    const onEdit = vi.fn();
    const writeText = vi.fn(() => Promise.resolve());
    mockClipboard(writeText);
    render(<StudioSwatch hex="#173b59" onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit #173B59" }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("shows selection without relying on color", () => {
    render(<StudioSwatch hex="#173b59" selected />);
    expect(screen.getByText("Selected")).toBeInTheDocument();
  });

  it("disables moves past the end of the row", () => {
    const onMoveRight = vi.fn();
    render(<StudioSwatch hex="#173b59" onMoveLeft={null} onMoveRight={onMoveRight} />);
    expect(screen.getByRole("button", { name: "Move #173B59 left" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move #173B59 right" }));
    expect(onMoveRight).toHaveBeenCalledOnce();
  });
});

describe("copy failure", () => {
  function CopyButton() {
    const { copy } = useStudioCopy();
    return (
      <button type="button" onClick={() => void copy("#173B59")}>
        Copy it
      </button>
    );
  }

  it("offers selectable text instead of a success toast, until dismissed", async () => {
    mockClipboard(() => Promise.reject(new Error("denied")));
    render(
      <>
        <CopyButton />
        <CopyFallback />
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy it" }));
    });

    expect(showToast).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText("Text to copy")).toHaveValue("#173B59");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("StudioButton", () => {
  it("blocks clicks and reports progress while loading", () => {
    const onClick = vi.fn();
    render(
      <StudioButton loading onClick={onClick}>
        Save
      </StudioButton>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("workspace store", () => {
  const STORAGE_KEY = "brandbite.colorStudio.workspace.v1";

  function ActivePalette() {
    const state = useWorkspace();
    return <p>{state.activePalette?.name ?? "empty"}</p>;
  }

  const palette = () =>
    createStudioPalette({ name: "Ocean", hexes: ["#173b59"], sourceTool: "generator" });

  beforeEach(() => {
    window.sessionStorage.clear();
    resetWorkspaceStoreForTests();
  });

  it("carries the palette to another page within a session", () => {
    const first = render(<ActivePalette />);
    act(() => workspaceActions.load(palette()));
    expect(screen.getByText("Ocean")).toBeInTheDocument();
    first.unmount();

    render(<ActivePalette />);
    expect(screen.getByText("Ocean")).toBeInTheDocument();
  });

  it("restores after a reload from session storage", () => {
    workspaceActions.load(palette());
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain("Ocean");

    resetWorkspaceStoreForTests();
    render(<ActivePalette />);
    expect(screen.getByText("Ocean")).toBeInTheDocument();
  });

  it("ignores a corrupt session snapshot", () => {
    window.sessionStorage.setItem(STORAGE_KEY, "{oops");
    render(<ActivePalette />);
    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("keeps working when storage writes fail", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    render(<ActivePalette />);
    act(() => workspaceActions.load(palette()));
    expect(screen.getByText("Ocean")).toBeInTheDocument();
    setItem.mockRestore();
  });

  it("undoes through the store", () => {
    const original = palette();
    workspaceActions.load(original);
    workspaceActions.commit({ ...original, name: "Changed" });
    render(<ActivePalette />);
    expect(screen.getByText("Changed")).toBeInTheDocument();
    act(() => workspaceActions.undo());
    expect(screen.getByText("Ocean")).toBeInTheDocument();
  });
});
