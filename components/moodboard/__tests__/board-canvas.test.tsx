import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MoodboardConnection, MoodboardItemClient } from "@/lib/moodboard";

import { BoardCanvas } from "../board-canvas";
import type { CreatableKind, ToolMode } from "../board-toolbar";

function note(id: string, body = `Body ${id}`, x = 100, y = 100): MoodboardItemClient {
  return {
    id,
    type: "NOTE",
    data: { body },
    x,
    y,
    width: 280,
    height: 0,
  } as unknown as MoodboardItemClient;
}

function setup(
  overrides: {
    connections?: MoodboardConnection[];
    items?: MoodboardItemClient[];
    placing?: CreatableKind | null;
    toolMode?: ToolMode;
  } = {},
) {
  const handlers = {
    onSetToolMode: vi.fn(),
    onPlace: vi.fn(),
    onPick: vi.fn(),
    onCancelPlacing: vi.fn(),
    onRemoveEmpty: vi.fn(),
    onUpdateItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onMoveItem: vi.fn(),
    onResizeItem: vi.fn(),
    onAddConnection: vi.fn(),
    onDeleteConnection: vi.fn(),
    onAddDrawing: vi.fn(),
    onUndoDelete: vi.fn(),
  };
  const view = render(
    <BoardCanvas
      items={overrides.items ?? [note("a")]}
      connections={overrides.connections ?? []}
      toolMode={overrides.toolMode ?? "select"}
      placing={overrides.placing ?? null}
      drawOpacity={1}
      drawColor="#000000"
      drawSize={4}
      {...handlers}
    />,
  );
  return { ...handlers, ...view };
}

const card = (id = "a") => document.querySelector<HTMLElement>(`[data-mb-card-id="${id}"]`)!;
const body = (id = "a") => screen.getByText(`Body ${id}`);

function press(el: Element, x = 200, y = 200) {
  fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: x, clientY: y });
}
function move(x: number, y: number) {
  act(() => {
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: x, clientY: y }));
  });
}
function release(x: number, y: number) {
  act(() => {
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientX: x, clientY: y }));
  });
}
/** A full click at one spot: press, release, then the click the browser would send. */
function click(el: Element) {
  press(el);
  release(200, 200);
  fireEvent.click(el);
}

beforeEach(() => {
  // jsdom has no layout, and the canvas waits for a real size before showing cards.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 1000,
    bottom: 800,
    width: 1000,
    height: 800,
  } as DOMRect);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BoardCanvas selection", () => {
  it("selects on the first click without opening the card", () => {
    setup();
    click(body());
    expect(screen.getByRole("button", { name: "Delete Sticky note" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Note text" })).toBeNull();
  });

  it("opens the card for editing on a click once it's selected", () => {
    setup();
    click(body());
    click(body());
    expect(screen.getByRole("textbox", { name: "Note text" })).toBeInTheDocument();
  });

  it("clears the selection when pressing the empty canvas or Escape", () => {
    setup();
    click(body());
    press(screen.getByTestId("moodboard-viewport"));
    release(200, 200);
    expect(screen.queryByRole("button", { name: "Delete Sticky note" })).toBeNull();

    click(body());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Delete Sticky note" })).toBeNull();
  });
});

describe("BoardCanvas moving cards", () => {
  it("moves the card by the pointer's travel, from anywhere on it", () => {
    const { onMoveItem } = setup();
    press(body(), 200, 200);
    move(260, 230);
    release(260, 230);
    expect(onMoveItem).toHaveBeenCalledWith("a", 160, 130);
  });

  it("doesn't treat a tiny wobble as a move, and allows negative positions", () => {
    const { onMoveItem } = setup();
    press(body(), 200, 200);
    move(202, 201);
    release(202, 201);
    expect(onMoveItem).not.toHaveBeenCalled();

    press(body(), 200, 200);
    move(-100, -100);
    release(-100, -100);
    expect(onMoveItem).toHaveBeenCalledWith("a", -200, -200);
  });

  it("doesn't open a card when the click ends a drag", () => {
    setup();
    click(body());
    press(body(), 200, 200);
    move(260, 230);
    release(260, 230);
    fireEvent.click(body());
    expect(screen.queryByRole("textbox", { name: "Note text" })).toBeNull();
  });

  it("leaves checkboxes working on the first click, without dragging", () => {
    const { onMoveItem, onUpdateItem } = setup({
      items: [
        {
          id: "t",
          type: "TODO",
          data: { items: [{ id: "1", text: "One", checked: false }] },
          x: 0,
          y: 0,
          width: 280,
          height: 0,
        } as unknown as MoodboardItemClient,
      ],
    });
    const box = screen.getByRole("checkbox");
    press(box, 200, 200);
    move(300, 300);
    release(300, 300);
    expect(onMoveItem).not.toHaveBeenCalled();
    fireEvent.click(box);
    expect(onUpdateItem).toHaveBeenCalledTimes(1);
  });

  it("nudges the selected card with the arrow keys", () => {
    const { onMoveItem } = setup();
    click(body());
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onMoveItem).toHaveBeenLastCalledWith("a", 110, 100);
    fireEvent.keyDown(window, { key: "ArrowUp", shiftKey: true });
    expect(onMoveItem).toHaveBeenLastCalledWith("a", 100, 50);
  });
});

describe("BoardCanvas deleting", () => {
  it("deletes the selected card with Delete and with its button", () => {
    const { onDeleteItem } = setup();
    click(body());
    fireEvent.keyDown(window, { key: "Delete" });
    expect(onDeleteItem).toHaveBeenCalledWith("a");

    click(body());
    fireEvent.click(screen.getByRole("button", { name: "Delete Sticky note" }));
    expect(onDeleteItem).toHaveBeenCalledTimes(2);
  });

  it("doesn't delete anything when nothing is selected, or while typing", () => {
    const { onDeleteItem } = setup();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(onDeleteItem).not.toHaveBeenCalled();

    click(body());
    click(body());
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Note text" }), { key: "Backspace" });
    expect(onDeleteItem).not.toHaveBeenCalled();
  });

  it("selects an arrow on click rather than deleting it", () => {
    const { onDeleteConnection } = setup({
      items: [note("a"), note("b", "Body b", 600, 100)],
      connections: [
        { id: "c1", sourceItemId: "a", targetItemId: "b" } as unknown as MoodboardConnection,
      ],
    });
    fireEvent.click(screen.getByTestId("connection-c1"));
    expect(onDeleteConnection).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Delete" });
    expect(onDeleteConnection).toHaveBeenCalledWith("c1");
  });

  it("offers undo through the keyboard", () => {
    const { onUndoDelete } = setup();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(onUndoDelete).toHaveBeenCalled();
  });
});

describe("BoardCanvas keyboard", () => {
  it("switches tools by letter, but not while typing", () => {
    const { onSetToolMode } = setup();
    fireEvent.keyDown(window, { key: "l" });
    expect(onSetToolMode).toHaveBeenLastCalledWith("arrow");
    fireEvent.keyDown(window, { key: "m" });
    expect(onSetToolMode).toHaveBeenLastCalledWith("draw");

    onSetToolMode.mockClear();
    click(body());
    click(body());
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Note text" }), { key: "l" });
    expect(onSetToolMode).not.toHaveBeenCalled();
  });
});

describe("BoardCanvas empty board", () => {
  it("explains what to do, and has nothing to fit", () => {
    setup({ items: [] });
    expect(screen.getByText("Your moodboard is empty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit to content" })).toBeDisabled();
  });
});

describe("BoardCanvas placing objects", () => {
  it("places the picked object where the canvas is clicked", () => {
    const { onPlace, onMoveItem } = setup({ placing: "note" });
    press(screen.getByTestId("moodboard-viewport"), 300, 200);
    release(300, 200);
    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace.mock.calls[0][0]).toBe("note");
    expect(onMoveItem).not.toHaveBeenCalled();
  });

  it("picks sticky, shape and text by letter", () => {
    const { onPick } = setup();
    fireEvent.keyDown(window, { key: "s" });
    expect(onPick).toHaveBeenLastCalledWith("note");
    fireEvent.keyDown(window, { key: "r" });
    expect(onPick).toHaveBeenLastCalledWith("shape");
    fireEvent.keyDown(window, { key: "t" });
    expect(onPick).toHaveBeenLastCalledWith("text");
  });

  it("cancels placing with Escape", () => {
    const { onCancelPlacing } = setup({ placing: "note" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancelPlacing).toHaveBeenCalled();
  });
});

describe("BoardCanvas editing", () => {
  it("opens the selected note with Enter, ready to type", () => {
    setup();
    click(body());
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByRole("textbox", { name: "Note text" })).toHaveFocus();
  });

  it("changes a sticky's color from its toolbar, without opening it", () => {
    const { onUpdateItem } = setup();
    click(body());
    fireEvent.click(screen.getByRole("button", { name: "Color #B9DCFF" }));
    expect(onUpdateItem).toHaveBeenCalledWith("a", expect.objectContaining({ color: "#B9DCFF" }));
    expect(screen.queryByRole("textbox", { name: "Note text" })).toBeNull();
  });

  it("types directly on a shape, and removes text left empty", () => {
    const { onUpdateItem, onRemoveEmpty } = setup({
      items: [
        { ...note("s"), type: "SHAPE", data: { kind: "rect", text: "", fill: "#FFFFFF" } },
        { ...note("t"), type: "TEXT", data: { text: "Hello" }, x: 600 },
      ] as unknown as MoodboardItemClient[],
    });

    const shape = card("s").querySelector("svg")!;
    click(shape);
    click(shape);
    const box = screen.getByRole("textbox", { name: "Shape text" });
    fireEvent.change(box, { target: { value: "On the shape" } });
    fireEvent.blur(box);
    expect(onUpdateItem).toHaveBeenCalledWith(
      "s",
      expect.objectContaining({ text: "On the shape" }),
    );

    const text = screen.getByText("Hello");
    click(text);
    click(text);
    const field = screen.getByRole("textbox", { name: "Text" });
    fireEvent.change(field, { target: { value: "  " } });
    fireEvent.blur(field);
    expect(onRemoveEmpty).toHaveBeenCalledWith("t");
  });
});

describe("BoardCanvas arrows from objects", () => {
  function pullFromDot(side: string) {
    click(body("a"));
    const dot = card("a").querySelector(`[data-mb-connector="${side}"]`)!;
    press(dot, 200, 200);
  }

  it("shows a connector on each side of the selected object", () => {
    setup();
    click(body());
    expect(card().querySelectorAll("[data-mb-connector]")).toHaveLength(4);
  });

  it("keeps the toolbar's padding from covering the top connector", () => {
    setup();
    click(body());
    const wrapper = card().querySelector("[data-mb-card-toolbar]")!;
    expect(wrapper).toHaveClass("pointer-events-none");
    expect(wrapper.firstElementChild).toHaveClass("pointer-events-auto");
  });

  it("connects when the arrow is dropped on another object", () => {
    const { onAddConnection, onSetToolMode } = setup({
      items: [note("a"), note("b", "Body b", 600, 100)],
    });
    pullFromDot("right");
    document.elementFromPoint = vi.fn(() => body("b"));
    move(500, 200);
    release(500, 200);
    expect(onAddConnection).toHaveBeenCalledWith("a", "b");
    expect(onSetToolMode).toHaveBeenCalledWith("select");
  });

  it("does nothing when dropped on empty canvas or back on itself", () => {
    const { onAddConnection } = setup({ items: [note("a"), note("b", "Body b", 600, 100)] });
    pullFromDot("right");
    document.elementFromPoint = vi.fn(() => screen.getByTestId("moodboard-viewport"));
    move(500, 200);
    release(500, 200);
    expect(onAddConnection).not.toHaveBeenCalled();

    pullFromDot("left");
    document.elementFromPoint = vi.fn(() => body("a"));
    move(210, 210);
    release(210, 210);
    expect(onAddConnection).not.toHaveBeenCalled();
  });

  it("connects two objects with two clicks using the Arrow tool", () => {
    const { onAddConnection } = setup({
      toolMode: "arrow",
      items: [note("a"), note("b", "Body b", 600, 100)],
    });
    document.elementFromPoint = vi.fn(() => body("a"));
    press(body("a"), 200, 200);
    release(200, 200);
    expect(onAddConnection).not.toHaveBeenCalled();

    document.elementFromPoint = vi.fn(() => body("b"));
    press(body("b"), 600, 200);
    release(600, 200);
    expect(onAddConnection).toHaveBeenCalledWith("a", "b");
  });
});

describe("BoardCanvas eraser", () => {
  const drawing = (id: string) =>
    ({
      id,
      type: "DRAWING",
      data: { pathData: "M 0 0 L 10 10", strokeColor: "#000000", strokeWidth: 4 },
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    }) as unknown as MoodboardItemClient;

  const hitPath = (id: string) => document.querySelector(`[data-mb-drawing-id="${id}"]`)!;
  const svgOf = (id: string) => hitPath(id).closest("svg")!;

  function setupEraser() {
    const view = setup({ toolMode: "eraser", items: [drawing("d1"), drawing("d2")] });
    const svg = svgOf("d1");
    svg.setPointerCapture = vi.fn();
    svg.hasPointerCapture = vi.fn(() => true);
    svg.releasePointerCapture = vi.fn();
    return { ...view, svg };
  }

  it("erases what's under the press, with no hover first, as on a touch screen", () => {
    const { onDeleteItem, svg } = setupEraser();
    document.elementFromPoint = vi.fn(() => hitPath("d1"));
    fireEvent.pointerDown(svg, { pointerId: 1, pointerType: "touch", clientX: 5, clientY: 5 });
    expect(onDeleteItem).toHaveBeenCalledWith("d1");
    expect(onDeleteItem).toHaveBeenCalledTimes(1);
  });

  it("erases each stroke a swipe crosses, once, including ones it jumps over", () => {
    const { onDeleteItem, svg } = setupEraser();
    document.elementFromPoint = vi.fn((x: number) => {
      if (x < 30) return svg as unknown as Element;
      if (x < 60) return hitPath("d1");
      return hitPath("d2");
    });
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(onDeleteItem).not.toHaveBeenCalled();
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 200, clientY: 0 });
    expect(onDeleteItem.mock.calls.map((c) => c[0])).toEqual(["d1", "d2"]);
  });

  it("only points at strokes until pressed", () => {
    const { onDeleteItem, svg } = setupEraser();
    document.elementFromPoint = vi.fn(() => hitPath("d1"));
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 5, clientY: 5 });
    expect(onDeleteItem).not.toHaveBeenCalled();

    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 5, clientY: 5 });
    onDeleteItem.mockClear();
    document.elementFromPoint = vi.fn(() => hitPath("d2"));
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 50, clientY: 5 });
    expect(onDeleteItem).not.toHaveBeenCalled();
  });
});
