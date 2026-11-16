import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const stream = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { create, stream, parse: vi.fn() } };
  },
}));

import { AiRefusalError, generateText, generateTextStream } from "@/lib/ai/anthropic";

beforeEach(() => {
  create.mockReset();
  stream.mockReset();
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
});

describe("Claude text", () => {
  it("asks Claude with fallbacks on and no sampling settings", async () => {
    create.mockResolvedValue({
      stop_reason: "end_turn",
      model: "claude-opus-5-5",
      content: [
        { type: "thinking", thinking: "" },
        { type: "text", text: "Fresh beans, " },
        { type: "text", text: "every Monday." },
      ],
      usage: { input_tokens: 12, output_tokens: 7 },
    });

    const result = await generateText("Write a tagline", "You write copy.");

    expect(result).toEqual({
      text: "Fresh beans, every Monday.",
      usage: { promptTokens: 12, completionTokens: 7 },
      model: "claude-opus-5-5",
    });
    const params = create.mock.calls[0]![0];
    expect(params).toMatchObject({
      model: "claude-opus-5-5",
      system: "You write copy.",
      messages: [{ role: "user", content: "Write a tagline" }],
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01"],
      output_config: { effort: "low" },
    });
    // Current models reject these.
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("thinking");
  });

  it("fails when the model declines, so the caller refunds", async () => {
    create.mockResolvedValue({
      stop_reason: "refusal",
      model: "claude-opus-5-5",
      content: [],
      usage: { input_tokens: 5, output_tokens: 0 },
    });
    await expect(generateText("x", "y")).rejects.toBeInstanceOf(AiRefusalError);
  });

  it("streams text as it is written and ends with the usage", async () => {
    const events = [
      { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "hm" } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "One" } },
      { type: "content_block_delta", delta: { type: "text_delta", text: " two" } },
      { type: "message_stop" },
    ];
    stream.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield* events;
      },
      finalMessage: async () => ({
        stop_reason: "end_turn",
        usage: { input_tokens: 3, output_tokens: 2 },
      }),
    });

    const chunks = [];
    for await (const chunk of generateTextStream("p", "s")) chunks.push(chunk);

    expect(chunks).toEqual([
      { text: "One", done: false },
      { text: " two", done: false },
      { text: "", usage: { promptTokens: 3, completionTokens: 2 }, done: true },
    ]);
  });

  it("fails a stream the model declined part-way", async () => {
    stream.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield { type: "content_block_delta", delta: { type: "text_delta", text: "Half" } };
      },
      finalMessage: async () => ({
        stop_reason: "refusal",
        usage: { input_tokens: 3, output_tokens: 1 },
      }),
    });

    const run = async () => {
      for await (const chunk of generateTextStream("p", "s")) void chunk;
    };
    await expect(run()).rejects.toBeInstanceOf(AiRefusalError);
  });
});
