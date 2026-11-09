import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BoardHeader } from "../board-header";
import { exportBounds, exportFileName, exportPixelRatio, jpegToPdf } from "../export-board";

describe("export area", () => {
  it("wraps every object with padding, or is null for an empty board", () => {
    expect(
      exportBounds([
        { x: 0, y: 0, width: 100, height: 50 },
        { x: 300, y: 200, width: 100, height: 100 },
      ]),
    ).toEqual({ x: -48, y: -48, width: 496, height: 396 });
    expect(exportBounds([])).toBeNull();
  });

  it("keeps huge boards inside what a canvas can hold", () => {
    expect(exportPixelRatio({ x: 0, y: 0, width: 1000, height: 800 })).toBe(2);
    expect(exportPixelRatio({ x: 0, y: 0, width: 16000, height: 800 })).toBe(0.5);
  });

  it("names the file after the board", () => {
    expect(exportFileName("Spring / launch: ideas", "png")).toBe("Spring launch ideas.png");
    expect(exportFileName("   ", "pdf")).toBe("moodboard.pdf");
  });
});

describe("jpegToPdf", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  const text = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

  it("writes a one-page PDF whose cross-reference table points at each object", () => {
    const pdf = jpegToPdf(jpeg, 200, 100, 150, 75);
    const body = text(pdf);
    expect(body.startsWith("%PDF-1.4\n")).toBe(true);
    expect(body).toContain("/MediaBox [0 0 150.00 75.00]");
    expect(body).toContain("/Width 200 /Height 100");
    expect(body).toContain(`/Length ${jpeg.length}`);
    expect(body.trimEnd().endsWith("%%EOF")).toBe(true);

    const startxref = Number(body.match(/startxref\n(\d+)/)![1]);
    expect(body.slice(startxref, startxref + 4)).toBe("xref");
    const offsets = [...body.slice(startxref).matchAll(/(\d{10}) 00000 n/g)].map((m) =>
      Number(m[1]),
    );
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset, i) =>
      expect(body.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true),
    );
  });

  it("shrinks pages past the PDF size limit, keeping the shape", () => {
    const body = text(jpegToPdf(jpeg, 10, 10, 28800, 7200));
    expect(body).toContain("/MediaBox [0 0 14400.00 3600.00]");
  });
});

describe("download menu", () => {
  const base = {
    title: "Board",
    itemCount: 2,
    onTitleChange: vi.fn(),
    onBack: vi.fn(),
    onDelete: vi.fn(),
  };

  it("lets viewers download too, and shows progress", async () => {
    let finish: () => void = () => {};
    const onExport = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(
      <BoardHeader {...base} readOnly canDelete={false} canShare={false} onExport={onExport} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /More/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Download as PDF" }));
    expect(onExport).toHaveBeenCalledWith("pdf");
    expect(screen.getByRole("menuitem", { name: "Preparing download…" })).toBeDisabled();
    expect(screen.queryByRole("menuitem", { name: "Delete moodboard" })).toBeNull();
    finish();
  });
});
