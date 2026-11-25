// @vitest-environment node
// "Resize with AI" asks the image model to lay a design out again on a new
// canvas. Models differ in what they take: an optional setting may be
// refused (the first real call failed on one), and older models only draw at
// three fixed sizes. Either way the call must adapt and try again, not fail.
import { beforeEach, describe, expect, it, vi } from "vitest";

const edit = vi.fn();
vi.mock("openai", () => ({
  default: class {
    images = { edit: (...args: unknown[]) => edit(...args) };
  },
}));

import { recomposeImage, rejectedEditSetting, rejectedSize } from "../openai";

const WANTED = { width: 1536, height: 800 };
const FALLBACK = { width: 1536, height: 1024 };

const call = () =>
  recomposeImage({
    image: new File([new Uint8Array(4)], "design.webp", { type: "image/webp" }),
    canvases: [WANTED, FALLBACK],
    promptFor: (canvas) => `layout for ${canvas.width}x${canvas.height}`,
    userId: "user-1",
  });
const refuse = (message: string) => Object.assign(new Error(`400 ${message}`), { status: 400 });
const unsupported = (name: string) =>
  refuse(`The model 'x' does not support the '${name}' parameter.`);
const ok = { data: [{ b64_json: Buffer.from([9, 8, 7]).toString("base64") }] };

beforeEach(() => {
  edit.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

describe("recomposeImage", () => {
  it("asks for the wanted canvas with its own instructions, as a JPG, with no mask", async () => {
    edit.mockResolvedValue(ok);
    const result = await call();
    expect(result).toEqual({
      bytes: Buffer.from([9, 8, 7]),
      contentType: "image/jpeg",
      canvas: WANTED,
    });
    const sent = edit.mock.calls[0][0];
    expect(sent).toMatchObject({
      size: "1536x800",
      prompt: "layout for 1536x800",
      output_format: "jpeg",
      user: "user-1",
      n: 1,
    });
    expect(sent).not.toHaveProperty("mask");
    // The setting the project's model refused must not come back.
    expect(sent).not.toHaveProperty("input_fidelity");
  });

  it("falls back to a fixed size, with that size's instructions, when the model refuses the canvas", async () => {
    edit
      .mockRejectedValueOnce(refuse("Invalid value: '1536x800'. Supported sizes are …"))
      .mockResolvedValueOnce(ok);
    const result = await call();
    expect(edit).toHaveBeenCalledTimes(2);
    expect(edit.mock.calls[1][0]).toMatchObject({
      size: "1536x1024",
      prompt: "layout for 1536x1024",
    });
    expect(result.canvas).toEqual(FALLBACK);
  });

  it("drops a setting the model refuses and tries the same canvas again", async () => {
    edit.mockRejectedValueOnce(unsupported("background")).mockResolvedValueOnce(ok);
    await call();
    expect(edit).toHaveBeenCalledTimes(2);
    expect(edit.mock.calls[1][0]).not.toHaveProperty("background");
    expect(edit.mock.calls[1][0]).toMatchObject({ size: "1536x800", output_format: "jpeg" });
  });

  it("falls back to a PNG when the model can't write a JPG", async () => {
    edit.mockRejectedValueOnce(unsupported("output_format")).mockResolvedValueOnce(ok);
    const result = await call();
    expect(result.contentType).toBe("image/png");
    expect(edit.mock.calls[1][0]).not.toHaveProperty("output_compression");
  });

  it("gives up on errors that are about neither a setting nor the size", async () => {
    edit.mockRejectedValue(refuse("blocked"));
    await expect(call()).rejects.toThrow("blocked");
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it("stops when every canvas and every optional setting has been refused", async () => {
    edit.mockImplementation(async (params: Record<string, unknown>) => {
      if ("background" in params) throw unsupported("background");
      throw refuse("Invalid size");
    });
    await expect(call()).rejects.toThrow("Invalid size");
    // Once without the setting, once per canvas.
    expect(edit).toHaveBeenCalledTimes(3);
  });

  it("tries a canvas only once when the wanted one and the fallback are the same", async () => {
    edit.mockRejectedValue(refuse("Invalid size"));
    await expect(
      recomposeImage({
        image: new File([new Uint8Array(4)], "design.webp", { type: "image/webp" }),
        canvases: [FALLBACK, FALLBACK],
        promptFor: () => "x",
      }),
    ).rejects.toThrow();
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it("recognises what a refusal is about", () => {
    expect(rejectedEditSetting(unsupported("output_compression"))).toBe("output_compression");
    expect(rejectedEditSetting(unsupported("mask"))).toBeNull();
    expect(rejectedEditSetting(Object.assign(new Error("background"), { status: 500 }))).toBeNull();
    expect(rejectedSize(refuse("Invalid size '1536x800'"))).toBe(true);
    expect(
      rejectedSize(refuse("Invalid value: '1536x800'. Supported values are: '1024x1024'")),
    ).toBe(true);
    expect(rejectedSize(Object.assign(refuse("Invalid value"), { param: "size" }))).toBe(true);
    expect(rejectedSize(refuse("blocked by the safety system"))).toBe(false);
    expect(rejectedSize(Object.assign(new Error("size"), { status: 500 }))).toBe(false);
  });
});
