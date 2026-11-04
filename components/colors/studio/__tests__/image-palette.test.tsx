import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkImageFile, extractFromImageData, locateColors, MAX_IMAGE_BYTES } from "@/lib/colors";

import { ImagePaletteView } from "../image-palette-view";
import { resetWorkspaceStoreForTests } from "../workspace-store";

const { analyzeImage } = vi.hoisted(() => ({ analyzeImage: vi.fn() }));

vi.mock("@/lib/colors", async (original) => ({
  ...(await original<typeof import("@/lib/colors")>()),
  analyzeImage,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

function imageData(pixels: number[][], width: number, height: number): ImageData {
  return { data: new Uint8ClampedArray(pixels.flat()), width, height } as ImageData;
}

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const CLEAR = [0, 255, 0, 0];

describe("image analysis", () => {
  it("accepts JPG, PNG and WEBP up to 10 MB", () => {
    expect(checkImageFile({ type: "image/jpeg", size: 100 })).toBeNull();
    expect(checkImageFile({ type: "image/webp", size: MAX_IMAGE_BYTES })).toBeNull();
    expect(checkImageFile({ type: "image/webp", size: MAX_IMAGE_BYTES + 1 })).toBe("size");
    expect(checkImageFile({ type: "image/gif", size: 100 })).toBe("type");
    expect(checkImageFile({ type: "image/svg+xml", size: 100 })).toBe("type");
  });

  it("gives the same palette for the same image and settings", () => {
    const data = imageData([RED, RED, BLUE, BLUE, RED, BLUE], 3, 2);
    expect(extractFromImageData(data, 2)).toEqual(extractFromImageData(data, 2));
  });

  it("ignores transparent pixels", () => {
    const palette = extractFromImageData(imageData([RED, CLEAR, CLEAR, RED], 2, 2), 3);
    expect(palette.every((color) => color.hex === "#ff0000")).toBe(true);
  });

  it("locates a color at its closest visible pixel", () => {
    const data = imageData([CLEAR, RED, BLUE, CLEAR], 2, 2);
    const palette = extractFromImageData(data, 2);
    const located = locateColors(data, palette);
    const blueIndex = palette.findIndex((c) => c.hex === "#0000ff");
    expect(located[blueIndex]).toEqual({ x: 0.25, y: 0.75 });
  });
});

describe("ImagePaletteView", () => {
  const result = {
    palette: ["#173b59", "#41c2d0", "#f6e5d5"].map((hex) => ({
      hex,
      rgb: { r: 0, g: 0, b: 0 },
      hsl: { h: 0, s: 0, l: 0 },
    })),
    locations: [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.5 },
      { x: 0.9, y: 0.9 },
    ],
  };

  function choose(file: File) {
    fireEvent.change(screen.getByLabelText("Image file"), { target: { files: [file] } });
  }

  const png = (size = 10) => {
    const file = new File(["x"], "coast.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: size });
    return file;
  };

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetWorkspaceStoreForTests();
    analyzeImage.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
  });

  it("gives separate messages for type, size and decode problems", async () => {
    render(<ImagePaletteView />);

    choose(new File(["x"], "a.gif", { type: "image/gif" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't supported/);

    choose(png(MAX_IMAGE_BYTES + 1));
    expect(await screen.findByRole("alert")).toHaveTextContent(/over 10 MB/);
    expect(analyzeImage).not.toHaveBeenCalled();

    analyzeImage.mockRejectedValue(new Error("bad"));
    await act(async () => choose(png()));
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't be read/);
  });

  it("shows colors, numbered markers, roles and the privacy note", async () => {
    analyzeImage.mockResolvedValue(result);
    render(<ImagePaletteView />);
    expect(screen.getByText(/never uploaded/)).toBeInTheDocument();

    await act(async () => choose(png()));
    expect(screen.getByAltText("Preview of coast.png")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy #41C2D0" })).toBeInTheDocument();
    expect(screen.getByText(/starting point/)).toBeInTheDocument();
    expect(screen.getByLabelText("Primary")).toBeInTheDocument();
  });

  it("re-analyzes within the 3 to 8 limit", async () => {
    analyzeImage.mockResolvedValue(result);
    render(<ImagePaletteView />);
    await act(async () => choose(png()));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "More colors" }));
    });
    expect(analyzeImage).toHaveBeenLastCalledWith(expect.any(File), 6);

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Fewer colors" }));
      });
    }
    expect(screen.getByRole("button", { name: "Fewer colors" })).toBeDisabled();
  });

  it("releases the image on removal and keeps nothing", async () => {
    analyzeImage.mockResolvedValue(result);
    render(<ImagePaletteView />);
    await act(async () => choose(png()));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
    expect(screen.queryByRole("button", { name: "Copy #41C2D0" })).toBeNull();
    expect(screen.getByText("Drop an image here")).toBeInTheDocument();
  });
});
