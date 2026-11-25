// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getToolAccess, rateLimit, returnRun, writeCopyOptions, findFirst, AiRefusalError } =
  vi.hoisted(() => ({
    getToolAccess: vi.fn(),
    rateLimit: vi.fn(),
    returnRun: vi.fn(),
    writeCopyOptions: vi.fn(),
    findFirst: vi.fn(),
    AiRefusalError: class extends Error {},
  }));

vi.mock("@/lib/tools/entitlement.server", () => ({ getToolAccess }));
vi.mock("@/lib/tools/daily-runs", () => ({ holdRun: rateLimit, returnRun }));
vi.mock("@/lib/ai/anthropic", () => ({ writeCopyOptions, AiRefusalError }));
vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findFirst } } }));

import { GET, POST } from "@/app/api/tools/brand-copy/route";

import {
  BRAND_COPY_DAILY_LIMIT,
  BRIEF_MAX,
  brandVoiceLines,
  cleanOptions,
  copySystemPrompt,
  copyUserPrompt,
  hasVoice,
  parseCopyRequest,
  voiceSummary,
} from "../copy";

const BRAND = {
  name: "Acme",
  tagline: "Baked this morning",
  description: "A family bakery",
  audience: "Neighbours who like real bread",
  values: ["honesty"],
  toneWords: ["warm", "plain"],
  voiceNotes: "Talk like a neighbour.",
  voiceDo: ["Use short sentences"],
  voiceDont: ["Use jargon"],
  wordsToUse: ["fresh"],
  wordsToAvoid: ["artisanal"],
  sampleCopy: "Come in. It's warm.",
};

const PRO = {
  entitlement: { signedIn: true, pro: true, reason: null },
  userId: "user-1",
  companyId: "company-1",
  companyName: "Acme Bakery",
  brandColors: [],
  hasBrandLogo: false,
};

const post = (body: unknown) =>
  new Request("http://localhost/api/tools/brand-copy", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as never;

const GOOD = { kind: "caption", length: "short", brief: "Our summer sale starts on Friday." };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  getToolAccess.mockResolvedValue(PRO);
  rateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 });
  returnRun.mockResolvedValue(10);
  findFirst.mockResolvedValue(BRAND);
  writeCopyOptions.mockResolvedValue({ options: ["One", "Two", "Three"] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("brand voice in words", () => {
  it("lists only what the brand guide holds", () => {
    const lines = brandVoiceLines(BRAND);
    expect(lines).toContain("Tone: warm, plain");
    expect(lines).toContain("Never: Use jargon");
    expect(lines).toContain("Words to avoid: artisanal");
    expect(brandVoiceLines({ name: "Acme", toneWords: [] })).toEqual([]);
    expect(brandVoiceLines(null)).toEqual([]);
  });

  it("knows whether the guide describes a voice", () => {
    expect(hasVoice(BRAND)).toBe(true);
    expect(hasVoice({ description: "A bakery", audience: "Everyone" })).toBe(false);
    expect(hasVoice(null)).toBe(false);
    expect(voiceSummary(BRAND).map((row) => row.label)).toEqual([
      "Tone",
      "Audience",
      "Words to use",
      "Words to avoid",
    ]);
    expect(voiceSummary({ toneWords: ["bold"] })).toEqual([{ label: "Tone", value: "bold" }]);
  });

  it("gives the model the voice, the rules and a plain fallback", () => {
    const withVoice = copySystemPrompt("Acme Bakery", BRAND);
    expect(withVoice).toContain("copywriter for Acme Bakery");
    expect(withVoice).toContain("<brand_voice>");
    expect(withVoice).toContain("Never invent prices, dates");
    expect(withVoice).toContain("language the brief is written in");
    const plain = copySystemPrompt("", null);
    expect(plain).toContain("copywriter for the brand");
    expect(plain).toContain("has not described its voice");
    expect(plain).not.toContain("<brand_voice>");
  });

  it("asks for the right kind, with a length only where it applies", () => {
    const caption = copyUserPrompt({ kind: "caption", length: "short", brief: "Sale on Friday." });
    expect(caption).toContain("Write 3 options for a social media caption.");
    expect(caption).toContain("as short as it can be");
    expect(caption).toContain("<brief>\nSale on Friday.\n</brief>");
    const slogan = copyUserPrompt({ kind: "slogan", length: "long", brief: "For our bakery." });
    expect(slogan).toContain("At most eight words");
    expect(slogan).not.toContain("say a little more");
  });

  it("checks a request", () => {
    expect(parseCopyRequest(GOOD)).toEqual(GOOD);
    expect(parseCopyRequest({ ...GOOD, length: "huge" })).toMatchObject({ length: "medium" });
    expect(parseCopyRequest({ ...GOOD, kind: "poem" })).toEqual({ error: "Choose what to write." });
    expect(parseCopyRequest({ ...GOOD, brief: "hi" })).toHaveProperty("error");
    expect(parseCopyRequest({ ...GOOD, brief: "x".repeat(BRIEF_MAX + 1) })).toHaveProperty("error");
    expect(parseCopyRequest(null)).toHaveProperty("error");
  });

  it("cleans what the model returns", () => {
    expect(
      cleanOptions([
        '  "Fresh bread daily"  ',
        "Option 2: Warm from the oven",
        "fresh bread daily",
        "",
        4,
        "A",
        "B",
      ]),
    ).toEqual(["Fresh bread daily", "Warm from the oven", "A"]);
    expect(cleanOptions("nope")).toEqual([]);
  });
});

describe("POST /api/tools/brand-copy", () => {
  it("writes options in the brand's voice and says how many runs are left", async () => {
    const res = await POST(post(GOOD));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      options: ["One", "Two", "Three"],
      remaining: 9,
      usedVoice: true,
    });
    expect(rateLimit).toHaveBeenCalledWith("brand-copy:company-1", {
      limit: BRAND_COPY_DAILY_LIMIT,
      windowSeconds: 86400,
    });
    const [system, prompt] = writeCopyOptions.mock.calls[0];
    expect(system).toContain("Tone: warm, plain");
    expect(prompt).toContain("Our summer sale starts on Friday.");
    expect(findFirst.mock.calls[0][0].where).toEqual({ companyId: "company-1", isDefault: true });
  });

  it("is closed to signed-out visitors and companies without a plan", async () => {
    getToolAccess.mockResolvedValue({ ...PRO, userId: null });
    expect((await POST(post(GOOD))).status).toBe(401);
    getToolAccess.mockResolvedValue({
      ...PRO,
      entitlement: { signedIn: true, pro: false, reason: "noPlan" },
    });
    expect((await POST(post(GOOD))).status).toBe(403);
    expect(writeCopyOptions).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("refuses a bad request before it counts against the day's runs", async () => {
    expect((await POST(post({ ...GOOD, brief: "hi" }))).status).toBe(400);
    expect((await POST(post("{not json"))).status).toBe(400);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("stops at the daily limit without calling the model", async () => {
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 123 });
    const res = await POST(post(GOOD));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ remaining: 0, resetAt: 123 });
    expect(writeCopyOptions).not.toHaveBeenCalled();
  });

  it("counts a run only when copy is written: a failed one is given back", async () => {
    await POST(post(GOOD));
    expect(returnRun).not.toHaveBeenCalled();

    for (const outcome of [new AiRefusalError(), new Error("boom")]) {
      writeCopyOptions.mockRejectedValueOnce(outcome);
      const res = await POST(post(GOOD));
      expect(await res.json()).toMatchObject({ remaining: 10 });
    }
    writeCopyOptions.mockResolvedValueOnce({ options: [] });
    expect(await (await POST(post(GOOD))).json()).toMatchObject({ remaining: 10 });
    expect(returnRun).toHaveBeenCalledTimes(3);
    expect(returnRun).toHaveBeenCalledWith("brand-copy:company-1", {
      limit: 10,
      windowSeconds: 86400,
    });
  });

  it("says so when the key is missing, the model declines or it fails", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await POST(post(GOOD))).status).toBe(503);
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    writeCopyOptions.mockRejectedValueOnce(new AiRefusalError());
    expect((await POST(post(GOOD))).status).toBe(422);
    writeCopyOptions.mockRejectedValueOnce(new Error("boom"));
    expect((await POST(post(GOOD))).status).toBe(502);
    writeCopyOptions.mockResolvedValueOnce({ options: ["", "  "] });
    expect((await POST(post(GOOD))).status).toBe(502);
  });
});

describe("GET /api/tools/brand-copy", () => {
  it("tells the page what the tool will read", async () => {
    const data = await (await GET()).json();
    expect(data).toMatchObject({
      open: true,
      ready: true,
      dailyLimit: 10,
      companyName: "Acme Bakery",
      hasVoice: true,
    });
    expect(data.voice[0]).toEqual({ label: "Tone", value: "warm, plain" });
  });

  it("shows nothing of the brand to a company without a plan", async () => {
    getToolAccess.mockResolvedValue({
      ...PRO,
      entitlement: { signedIn: true, pro: false, reason: "noPlan" },
    });
    const data = await (await GET()).json();
    expect(data).toMatchObject({ open: false, hasVoice: false, voice: [] });
    expect(findFirst).not.toHaveBeenCalled();
    getToolAccess.mockResolvedValue({ ...PRO, userId: null });
    expect((await GET()).status).toBe(401);
  });
});
