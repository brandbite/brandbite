import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MoodboardConnection, MoodboardItemClient } from "@/lib/moodboard";

import { BoardCanvas } from "../board-canvas";

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
  overrides: { connections?: MoodboardConnection[]; items?: MoodboardItemClient[] } = {},
) {
  const handlers = {
    onSetToolMode: vi.fn(),
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
      toolMode="select"
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
    expect(screen.getByRole("button", { name: "Delete Note" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write something...")).toBeNull();
  });

  it("opens the card for editing on a click once it's selected", () => {
    setup();
    click(body());
    click(body());
    expect(screen.getByPlaceholderText("Write something...")).toBeInTheDocument();
  });

  it("clears the selection when pressing the empty canvas or Escape", () => {
    setup();
    click(body());
    press(screen.getByTestId("moodboard-viewport"));
    release(200, 200);
    expect(screen.queryByRole("button", { name: "Delete Note" })).toBeNull();

    click(body());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Delete Note" })).toBeNull();
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
    expect(screen.queryByPlaceholderText("Write something...")).toBeNull();
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
    fireEvent.click(screen.getByRole("button", { name: "Delete Note" }));
    expect(onDeleteItem).toHaveBeenCalledTimes(2);
  });

  it("doesn't delete anything when nothing is selected, or while typing", () => {
    const { onDeleteItem } = setup();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(onDeleteItem).not.toHaveBeenCalled();

    click(body());
    click(body());
    fireEvent.keyDown(screen.getByPlaceholderText("Write something..."), { key: "Backspace" });
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
    fireEvent.keyDown(screen.getByPlaceholderText("Write something..."), { key: "l" });
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
