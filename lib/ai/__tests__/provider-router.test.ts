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
