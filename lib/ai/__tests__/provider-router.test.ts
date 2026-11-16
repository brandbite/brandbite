import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeImageSize } from "@/lib/ai/openai";
import {
  AI_TOOL_TYPES,
  getProviderForTool,
  isAiToolAvailable,
  isProviderAvailable,
} from "@/lib/ai/provider-router";

afterEach(() => vi.unstubAllEnvs());

function keys(env: { anthropic?: string; openai?: string; replicate?: string }) {
  vi.stubEnv("ANTHROPIC_API_KEY", env.anthropic ?? "");
  vi.stubEnv("OPENAI_API_KEY", env.openai ?? "");
  vi.stubEnv("REPLICATE_API_TOKEN", env.replicate ?? "");
}

describe("which AI tools are set up", () => {
  it("covers every tool", () => {
    expect([...AI_TOOL_TYPES].sort()).toEqual([
      "BACKGROUND_REMOVAL",
      "BRIEF_PARSING",
      "DESIGN_SUGGESTION",
      "IMAGE_GENERATION",
      "TEXT_GENERATION",
      "UPSCALE_IMAGE",
    ]);
  });

  it("holds every tool back when no key is set", () => {
    keys({});
    expect(AI_TOOL_TYPES.filter(isAiToolAvailable)).toEqual([]);
  });

  it("opens the text tools with the Claude key only", () => {
    keys({ anthropic: "sk-ant-test" });
    expect(AI_TOOL_TYPES.filter(isAiToolAvailable).sort()).toEqual([
      "BRIEF_PARSING",
      "DESIGN_SUGGESTION",
      "TEXT_GENERATION",
    ]);
    expect(isProviderAvailable("openai")).toBe(false);
  });

  it("opens image generation with the OpenAI key, not the Replicate tools", () => {
    keys({ openai: "sk-test" });
    expect(AI_TOOL_TYPES.filter(isAiToolAvailable)).toEqual(["IMAGE_GENERATION"]);
  });

  it("opens background removal and upscaling with the Replicate key", () => {
    keys({ replicate: "r8-test" });
    expect(AI_TOOL_TYPES.filter(isAiToolAvailable).sort()).toEqual([
      "BACKGROUND_REMOVAL",
      "UPSCALE_IMAGE",
    ]);
  });

  it("names the provider and model of each tool, with env overrides", () => {
    expect(getProviderForTool("TEXT_GENERATION")).toEqual({
      provider: "anthropic",
      model: "claude-opus-5-5",
    });
    expect(getProviderForTool("IMAGE_GENERATION")).toEqual({
      provider: "openai",
      model: "gpt-image-2.6-flare",
    });
    vi.stubEnv("ANTHROPIC_TEXT_MODEL", "claude-sonnet-5-5");
    vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-2.6-sunburst");
    expect(getProviderForTool("BRIEF_PARSING").model).toBe("claude-sonnet-5-5");
    expect(getProviderForTool("IMAGE_GENERATION").model).toBe("gpt-image-2.6-sunburst");
  });
});

describe("image sizes", () => {
  it("keeps today's sizes and maps the older portrait and landscape", () => {
    expect(normalizeImageSize("1024x1536")).toBe("1024x1536");
    expect(normalizeImageSize("1024x1792")).toBe("1024x1536");
    expect(normalizeImageSize("1792x1024")).toBe("1536x1024");
    expect(normalizeImageSize("9999x1")).toBe("1024x1024");
    expect(normalizeImageSize(undefined)).toBe("1024x1024");
  });
});

describe("Replicate output", () => {
  it("reads the link from a plain string, a list, and the SDK's file object", async () => {
    const { extractUrl } = await import("@/lib/ai/replicate");
    expect(extractUrl("https://r.example/a.png")).toBe("https://r.example/a.png");
    expect(extractUrl(["https://r.example/b.png"])).toBe("https://r.example/b.png");
    // FileOutput: url is a method that returns a URL object.
    const file = { url: () => new URL("https://r.example/c.png") };
    expect(extractUrl(file)).toBe("https://r.example/c.png");
    expect(extractUrl([file])).toBe("https://r.example/c.png");
    expect(extractUrl({ url: "https://r.example/d.png" })).toBe("https://r.example/d.png");
    expect(extractUrl(null)).toBeNull();
  });
});

describe("images a customer hands to a tool", () => {
  it("accepts PNG, JPG and WebP up to 20 MB", async () => {
    const { aiInputImageProblem } = await import("@/lib/ai/input-images");
    expect(aiInputImageProblem({ type: "image/png", size: 10 })).toBeNull();
    expect(aiInputImageProblem({ type: "image/webp", size: 20 * 1024 * 1024 })).toBeNull();
    expect(aiInputImageProblem({ type: "image/svg+xml", size: 10 })).toMatch(/PNG, JPG or WebP/);
    expect(aiInputImageProblem({ type: "image/jpeg", size: 20 * 1024 * 1024 + 1 })).toMatch(
      /20 MB/,
    );
    expect(aiInputImageProblem({ type: "image/png", size: 0 })).toMatch(/empty/);
  });

  it("only reads a company's own uploads", async () => {
    const { aiInputKey, isAiInputKeyOf } = await import("@/lib/ai/input-images");
    const id = "123e4567-e89b-42d3-a456-426614174000";
    const key = aiInputKey("c1", id, "image/jpeg");
    expect(key).toBe(`ai-inputs/c1/${id}.jpg`);
    expect(isAiInputKeyOf(key, "c1")).toBe(true);
    // Another company's file, another folder, or a path that climbs out.
    expect(isAiInputKeyOf(key, "c2")).toBe(false);
    expect(isAiInputKeyOf(`brand/c1/${id}.jpg`, "c1")).toBe(false);
    expect(isAiInputKeyOf(`ai-inputs/c1/../c2/${id}.jpg`, "c1")).toBe(false);
    expect(isAiInputKeyOf(`ai-inputs/c1/${id}.svg`, "c1")).toBe(false);
    expect(isAiInputKeyOf(key, "")).toBe(false);
  });
});
