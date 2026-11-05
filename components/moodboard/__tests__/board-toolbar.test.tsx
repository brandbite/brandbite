import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BoardToolbar, type ToolMode } from "../board-toolbar";

function setup(toolMode: ToolMode = "select") {
  const handlers = {
    onSetToolMode: vi.fn(),
    onPick: vi.fn(),
    onDropAt: vi.fn(),
    onSetPenKind: vi.fn(),
    onSetDrawColor: vi.fn(),
    onSetDrawSize: vi.fn(),
    onSetShapeKind: vi.fn(),
  };
  render(
    <BoardToolbar
      toolMode={toolMode}
      placing={null}
      penKind="marker"
      drawColor="#424143"
      drawSize={4}
      shapeKind="rect"
      {...handlers}
    />,
  );
  return handlers;
}

const pointer = (type: string, x: number, y: number) =>
  act(() => {
    window.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y }));
  });

describe("BoardToolbar", () => {
  it("picks an object on click", () => {
    const { onPick, onDropAt } = setup();
    const sticky = screen.getByRole("button", { name: "Sticky note" });
    fireEvent.pointerDown(sticky, { button: 0, pointerType: "mouse", clientX: 10, clientY: 10 });
    pointer("pointerup", 10, 10);
    fireEvent.click(sticky);
    expect(onPick).toHaveBeenCalledWith("note");
    expect(onDropAt).not.toHaveBeenCalled();
  });

  it("drops an object where it's dragged to, without also picking it", () => {
    const { onPick, onDropAt } = setup();
    const sticky = screen.getByRole("button", { name: "Sticky note" });
    fireEvent.pointerDown(sticky, { button: 0, pointerType: "mouse", clientX: 10, clientY: 500 });
    pointer("pointermove", 300, 200);
    pointer("pointerup", 300, 200);
    fireEvent.click(sticky);
    expect(onDropAt).toHaveBeenCalledWith("note", 300, 200);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("still picks on the next click after a drag dropped on the canvas", () => {
    const { onPick } = setup();
    const sticky = screen.getByRole("button", { name: "Sticky note" });
    fireEvent.pointerDown(sticky, { button: 0, pointerType: "mouse", clientX: 10, clientY: 500 });
    pointer("pointermove", 300, 200);
    pointer("pointerup", 300, 200);

    const shape = screen.getByRole("button", { name: "Shape" });
    fireEvent.pointerDown(shape, { button: 0, pointerType: "mouse", clientX: 10, clientY: 10 });
    pointer("pointerup", 10, 10);
    fireEvent.click(shape);
    expect(onPick).toHaveBeenCalledWith("shape");
  });

  it("leaves touch drags to scroll the dock", () => {
    const { onDropAt } = setup();
    const sticky = screen.getByRole("button", { name: "Sticky note" });
    fireEvent.pointerDown(sticky, { button: 0, pointerType: "touch", clientX: 10, clientY: 500 });
    pointer("pointermove", 300, 500);
    pointer("pointerup", 300, 500);
    expect(onDropAt).not.toHaveBeenCalled();
  });

  it("keeps pen options hidden until the marker is on", () => {
    setup();
    expect(screen.queryByRole("group", { name: "Pen color" })).toBeNull();
  });

  it("offers marker, highlighter and eraser with colors and sizes", () => {
    const { onSetPenKind, onSetDrawColor, onSetDrawSize, onSetToolMode } = setup("draw");
    fireEvent.click(screen.getByRole("button", { name: "Highlighter" }));
    expect(onSetPenKind).toHaveBeenCalledWith("highlighter");
    fireEvent.click(screen.getByRole("button", { name: "Color #4C8EF7" }));
    expect(onSetDrawColor).toHaveBeenCalledWith("#4C8EF7");
    fireEvent.click(screen.getByRole("button", { name: "Size 8" }));
    expect(onSetDrawSize).toHaveBeenCalledWith(8);
    fireEvent.click(screen.getByRole("button", { name: "Eraser" }));
    expect(onSetToolMode).toHaveBeenLastCalledWith("eraser");
  });
});
