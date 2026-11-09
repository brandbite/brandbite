import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MoodboardItemClient } from "@/lib/moodboard";

import { BoardCanvas } from "../board-canvas";
import {
  buildClipboard,
  diffBoards,
  isEmptyDiff,
  parseClipboard,
  serializeClipboard,
} from "../board-history";
import { rectsIntersect, shiftPath } from "../canvas-math";

beforeEach(() => {
  // jsdom has no layout, and the canvas waits for a real size before showing cards.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 3000,
    bottom: 2000,
    width: 3000,
    height: 2000,
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function note(id: string, x: number, y = 100, width = 200, height = 200) {
  return {
    id,
    type: "NOTE",
    data: { body: `Body ${id}` },
    x,
    y,
    width,
    height,
  } as unknown as MoodboardItemClient;
}

function setup(items = [note("a", 100), note("b", 400), note("c", 700)]) {
  const handlers = {
    onSetToolMode: vi.fn(),
    onPlace: vi.fn(),
    onPick: vi.fn(),
    onCancelPlacing: vi.fn(),
    onRemoveEmpty: vi.fn(),
    onUpdateItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onMoveItem: vi.fn(),
    onMoveItems: vi.fn(),
    onDeleteItems: vi.fn(),
    onDuplicateItems: vi.fn(),
    onCopyItems: vi.fn((ids: string[]) => `copied:${ids.join()}`),
    onPasteText: vi.fn(() => true),
    onPasteLastCopy: vi.fn(),
    onAddFiles: vi.fn(),
    onResizeItem: vi.fn(),
    onAddConnection: vi.fn(),
    onDeleteConnection: vi.fn(),
    onAddDrawing: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
  };
  render(
    <BoardCanvas
      items={items}
      connections={[]}
      toolMode="select"
      placing={null}
      drawOpacity={1}
      drawColor="#000000"
      drawSize={4}
      {...handlers}
    />,
  );
  return handlers;
}

const card = (id: string) => document.querySelector<HTMLElement>(`[data-mb-card-id="${id}"]`)!;
const viewport = () => screen.getByTestId("moodboard-viewport");

function press(el: Element, x: number, y: number, extra: object = {}) {
  fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: x, clientY: y, ...extra });
}
function pointer(type: string, x: number, y: number) {
  act(() => {
    window.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y }));
  });
}
function shiftClick(id: string) {
  press(screen.getByText(`Body ${id}`), 200, 200, { shiftKey: true });
  pointer("pointerup", 200, 200);
}
async function nextFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}

describe("Selecting several objects", () => {
  it("adds with Shift-click, takes back out with another, and shows the count", () => {
    setup();
    shiftClick("a");
    expect(screen.queryByRole("status")).toBeNull();
    shiftClick("b");
    expect(screen.getByRole("status")).toHaveTextContent("2 selected");
    shiftClick("c");
    expect(screen.getByRole("status")).toHaveTextContent("3 selected");
    shiftClick("b");
    expect(screen.getByRole("status")).toHaveTextContent("2 selected");
  });

  it("selects everything with Ctrl+A and clears with Escape", () => {
    setup();
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    expect(screen.getByRole("status")).toHaveTextContent("3 selected");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("selects what a box dragged on the empty canvas touches", async () => {
    setup();
    // The opening fit centres the board: its objects start at 1100, 1400 and 1700.
    press(viewport(), 1000, 800);
    pointer("pointermove", 1500, 950);
    await nextFrame();
    expect(screen.getByRole("status")).toHaveTextContent("2 selected");
    pointer("pointerup", 1500, 950);
    expect(screen.getByRole("status")).toHaveTextContent("2 selected");
  });

  it("leaves a finger moving the canvas rather than drawing a box", async () => {
    setup();
    press(viewport(), 1000, 800, { pointerType: "touch" });
    pointer("pointermove", 1500, 950);
    await nextFrame();
    pointer("pointerup", 1500, 950);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Acting on several objects", () => {
  function selectAll() {
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
  }

  it("moves them together by the same distance", async () => {
    const { onMoveItems } = setup();
    selectAll();
    press(screen.getByText("Body a"), 200, 200);
    pointer("pointermove", 230, 250);
    await nextFrame();
    expect(card("c").style.translate).toBe("30px 50px");
    pointer("pointerup", 230, 250);
    expect(onMoveItems).toHaveBeenCalledWith([
      { id: "a", x: 130, y: 150 },
      { id: "b", x: 430, y: 150 },
      { id: "c", x: 730, y: 150 },
    ]);
    expect(card("c").style.translate).toBe("");
  });

  it("narrows to one with a plain click, without moving anything", () => {
    const { onMoveItems } = setup();
    selectAll();
    press(screen.getByText("Body b"), 200, 200);
    pointer("pointerup", 200, 200);
    expect(onMoveItems).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Delete Sticky note" })).toBeInTheDocument();
  });

  it("deletes, nudges and duplicates them together", () => {
    const { onDeleteItems, onMoveItems, onDuplicateItems } = setup();
    selectAll();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onMoveItems.mock.calls[0][0]).toHaveLength(3);
    fireEvent.keyDown(window, { key: "d", ctrlKey: true });
    expect(onDuplicateItems).toHaveBeenCalledWith(["a", "b", "c"]);
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(onDuplicateItems).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: "Delete" });
    expect(onDeleteItems).toHaveBeenCalledWith(["a", "b", "c"]);
  });
});

describe("Clipboard events", () => {
  function clipboardEvent(type: string, text = "") {
    const event = new Event(type, { bubbles: true, cancelable: true });
    const setData = vi.fn();
    Object.assign(event, { clipboardData: { setData, getData: () => text } });
    return { event, setData };
  }

  it("puts the selection on the clipboard", () => {
    const { onCopyItems } = setup();
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    const { event, setData } = clipboardEvent("copy");
    window.dispatchEvent(event);
    expect(onCopyItems).toHaveBeenCalledWith(["a", "b", "c"]);
    expect(setData).toHaveBeenCalledWith("text/plain", "copied:a,b,c");
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves copying alone when nothing is selected", () => {
    const { onCopyItems } = setup();
    const { event } = clipboardEvent("copy");
    window.dispatchEvent(event);
    expect(onCopyItems).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("removes what's cut", () => {
    const { onDeleteItems } = setup();
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    window.dispatchEvent(clipboardEvent("cut").event);
    expect(onDeleteItems).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("hands a paste over, and doesn't also use the last copy", async () => {
    const { onPasteText, onPasteLastCopy } = setup();
    fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    window.dispatchEvent(clipboardEvent("paste", "something").event);
    expect(onPasteText).toHaveBeenCalledWith("something");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onPasteLastCopy).not.toHaveBeenCalled();
  });

  it("uses the last copy where the browser sends no paste event", async () => {
    const { onPasteLastCopy } = setup();
    fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onPasteLastCopy).toHaveBeenCalled();
  });
});

describe("Lining objects up while moving", () => {
  const guides = () => document.querySelectorAll("[data-mb-guide]");

  it("snaps to a neighbour's edge, shows a guide, and saves the lined-up spot", async () => {
    const { onMoveItem } = setup();
    press(screen.getByText("Body b"), 200, 200);
    // 4px off the row's top edge: close enough to line up.
    pointer("pointermove", 230, 204);
    await nextFrame();
    expect(card("b").style.translate).toBe("30px 0px");
    expect(guides().length).toBeGreaterThan(0);

    pointer("pointerup", 230, 204);
    expect(onMoveItem).toHaveBeenCalledWith("b", 430, 100);
    expect(guides()).toHaveLength(0);
  });

  it("leaves far-off positions alone", async () => {
    const { onMoveItem } = setup();
    press(screen.getByText("Body b"), 200, 200);
    pointer("pointermove", 230, 260);
    await nextFrame();
    expect(guides()).toHaveLength(0);
    pointer("pointerup", 230, 260);
    expect(onMoveItem).toHaveBeenCalledWith("b", 430, 160);
  });

  it("moves freely while Ctrl is held", async () => {
    const { onMoveItem } = setup();
    press(screen.getByText("Body b"), 200, 200);
    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 1,
          clientX: 230,
          clientY: 204,
          ctrlKey: true,
        }),
      );
    });
    await nextFrame();
    expect(guides()).toHaveLength(0);
    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointerup", { pointerId: 1, clientX: 230, clientY: 204, ctrlKey: true }),
      );
    });
    expect(onMoveItem).toHaveBeenCalledWith("b", 430, 104);
  });
});

describe("Adding files from the computer", () => {
  const image = () => new File(["png"], "shot.png", { type: "image/png" });

  it("adds a pasted screenshot", () => {
    const handlers = setup();
    handlers.onPasteText.mockReturnValue(false);
    const file = image();
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.assign(event, { clipboardData: { getData: () => "", setData: vi.fn(), files: [file] } });
    window.dispatchEvent(event);
    expect(handlers.onAddFiles).toHaveBeenCalledWith([file], null);
    expect(event.defaultPrevented).toBe(true);
  });

  it("pastes board objects rather than a file when the clipboard holds both", () => {
    const handlers = setup();
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.assign(event, {
      clipboardData: { getData: () => "board", setData: vi.fn(), files: [image()] },
    });
    window.dispatchEvent(event);
    expect(handlers.onAddFiles).not.toHaveBeenCalled();
  });

  it("shows where dropped files go and adds them at the drop point", () => {
    const { onAddFiles } = setup();
    const file = image();
    const dataTransfer = { types: ["Files"], files: [file], dropEffect: "none" };
    fireEvent.dragOver(viewport(), { dataTransfer });
    expect(screen.getByText("Drop to add to the board")).toBeInTheDocument();

    fireEvent.drop(viewport(), { dataTransfer, clientX: 1100, clientY: 900 });
    expect(onAddFiles).toHaveBeenCalledWith([file], {
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(screen.queryByText("Drop to add to the board")).toBeNull();
  });

  it("ignores text and links dragged in from elsewhere", () => {
    const { onAddFiles } = setup();
    const dataTransfer = { types: ["text/plain"], files: [] };
    fireEvent.dragOver(viewport(), { dataTransfer });
    expect(screen.queryByText("Drop to add to the board")).toBeNull();
    fireEvent.drop(viewport(), { dataTransfer });
    expect(onAddFiles).not.toHaveBeenCalled();
  });
});

describe("board history", () => {
  const board = {
    items: [note("a", 100), note("b", 400)],
    connections: [{ id: "c1", sourceItemId: "a", targetItemId: "b" }],
  };

  it("finds nothing to do between equal boards", () => {
    expect(isEmptyDiff(diffBoards(board, { ...board, items: [...board.items] }))).toBe(true);
  });

  it("finds what to remove, restore and change", () => {
    const diff = diffBoards(board, {
      items: [note("a", 150), note("z", 0)],
      connections: [],
    });
    expect(diff.remove).toEqual(["b"]);
    expect(diff.restore).toEqual(["z"]);
    expect(diff.change.map((i) => i.id)).toEqual(["a"]);
    expect(diff.connectionsChanged).toBe(true);
  });

  it("copies only the arrows that run between the chosen objects", () => {
    expect(buildClipboard("m1", board, ["a", "b"]).connections).toHaveLength(1);
    expect(buildClipboard("m1", board, ["a"]).connections).toHaveLength(0);
  });

  it("reads back its own clipboard format and nothing else", () => {
    const clipboard = buildClipboard("m1", board, ["a"]);
    expect(parseClipboard(serializeClipboard(clipboard))).toEqual(clipboard);
    expect(parseClipboard("hello")).toBeNull();
    expect(parseClipboard("brandbite-moodboard-v1:{broken")).toBeNull();
    expect(parseClipboard(null)).toBeNull();
  });
});

describe("canvas math", () => {
  it("moves every point of a drawing's path", () => {
    expect(shiftPath("M 10 20 Q 30 40 50 60 L -5.5 7", 1, 2)).toBe(
      "M 11 22 Q 31 42 51 62 L -4.5 9",
    );
  });

  it("knows when two boxes touch", () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    expect(rectsIntersect(box, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(rectsIntersect(box, { x: 20, y: 0, width: 10, height: 10 })).toBe(false);
  });
});
