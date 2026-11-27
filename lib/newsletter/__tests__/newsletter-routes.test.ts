// @vitest-environment node
// The newsletter builder's two paid parts: writing with AI costs money per
// run, and an uploaded image is stored for good on the public asset domain.
// Who may use them and how often is checked here; nothing reaches the model
// or storage until every check has passed.
import { beforeEach, describe, expect, it, vi } from "vitest";

const getToolAccess = vi.fn();
const holdRun = vi.fn();
const returnRun = vi.fn();
const rateLimit = vi.fn();
const writeNewsletterDraft = vi.fn();
const findBrand = vi.fn();
const getSignedUrl = vi.fn();
const r2Send = vi.fn();

const { AiRefusalError } = vi.hoisted(() => ({ AiRefusalError: class extends Error {} }));

vi.mock("@/lib/tools/entitlement.server", () => ({ getToolAccess: () => getToolAccess() }));
vi.mock("@/lib/tools/daily-runs", () => ({
  holdRun: (...args: unknown[]) => holdRun(...args),
  returnRun: (...args: unknown[]) => returnRun(...args),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...args: unknown[]) => rateLimit(...args) }));
vi.mock("@/lib/ai/anthropic", () => ({
  AiRefusalError,
  writeNewsletterDraft: (...args: unknown[]) => writeNewsletterDraft(...args),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { brand: { findFirst: (...args: unknown[]) => findBrand(...args) } },
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrl(...args),
}));
vi.mock("@/lib/r2", () => ({
  createR2Client: () => ({ send: (...args: unknown[]) => r2Send(...args) }),
  getR2BucketName: () => "bucket",
  getR2PublicBaseUrl: () => process.env.R2_PUBLIC_BASE_URL || null,
}));

import { POST as writeCopy } from "@/app/api/tools/newsletter-copy/route";
import { GET as listUploads, POST as startUpload } from "@/app/api/tools/newsletter-image/route";

const PRO = {
  entitlement: { signedIn: true, pro: true, reason: null },
  userId: "user-1",
  companyId: "company-1",
  companyName: "Acme",
  brandColors: [],
};
const NO_PLAN = { ...PRO, entitlement: { signedIn: true, pro: false, reason: "noPlan" } };
const SIGNED_OUT = { ...PRO, entitlement: { signedIn: false, pro: false }, userId: null };

const DRAFT = {
  subject: "Spring menu",
  preheader: "Three new dishes",
  headline: "Spring is here",
  intro: "We have a new menu.",
  sections: [],
  buttonLabel: "See it",
};

const json = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;

const copyRequest = (
  body: unknown = { kind: "announcement", brief: "Our spring menu starts on Friday." },
) => json("/api/tools/newsletter-copy", body);
const uploadRequest = (body: unknown = { contentType: "image/jpeg", sizeBytes: 5000 }) =>
  json("/api/tools/newsletter-image", body);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("R2_PUBLIC_BASE_URL", "https://media.example.com/");
  getToolAccess.mockResolvedValue(PRO);
  holdRun.mockResolvedValue({ allowed: true, remaining: 6, resetAt: 0 });
  returnRun.mockResolvedValue(7);
  rateLimit.mockResolvedValue({ allowed: true });
  findBrand.mockResolvedValue({ name: "Acme", toneWords: ["warm"] });
  writeNewsletterDraft.mockResolvedValue({ draft: DRAFT });
  getSignedUrl.mockResolvedValue("https://storage.example.com/put?signed=1");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/tools/newsletter-copy", () => {
  it("writes a draft in the brand's voice and says how many runs are left", async () => {
    const res = await writeCopy(copyRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ draft: DRAFT, remaining: 6, usedVoice: true });
    const [system, prompt] = writeNewsletterDraft.mock.calls[0];
    expect(system).toContain("Tone: warm");
    expect(prompt).toContain("Our spring menu starts on Friday.");
  });

  it("counts runs per company, ten in 24 hours", async () => {
    await writeCopy(copyRequest());
    expect(holdRun).toHaveBeenCalledWith("newsletter-copy:company-1", {
      limit: 10,
      windowSeconds: 86_400,
    });
  });

  it("turns away visitors, companies without a plan and a deployment without the model", async () => {
    getToolAccess.mockResolvedValue(SIGNED_OUT);
    expect((await writeCopy(copyRequest())).status).toBe(401);
    getToolAccess.mockResolvedValue(NO_PLAN);
    expect((await writeCopy(copyRequest())).status).toBe(403);
    getToolAccess.mockResolvedValue(PRO);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await writeCopy(copyRequest())).status).toBe(503);
    expect(holdRun).not.toHaveBeenCalled();
    expect(writeNewsletterDraft).not.toHaveBeenCalled();
  });

  it("refuses a bad request before a run is taken", async () => {
    expect((await writeCopy(copyRequest({ kind: "announcement", brief: "short" }))).status).toBe(
      400,
    );
    expect(holdRun).not.toHaveBeenCalled();
  });

  it("stops at the daily limit without calling the model", async () => {
    holdRun.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 123 });
    const res = await writeCopy(copyRequest());
    expect(res.status).toBe(429);
    expect(writeNewsletterDraft).not.toHaveBeenCalled();
  });

  it("gives the run back when the writing fails, is declined or comes back empty", async () => {
    writeNewsletterDraft.mockRejectedValueOnce(new Error("down"));
    let res = await writeCopy(copyRequest());
    expect(res.status).toBe(502);
    expect((await res.json()).remaining).toBe(7);

    writeNewsletterDraft.mockRejectedValueOnce(new AiRefusalError());
    res = await writeCopy(copyRequest());
    expect(res.status).toBe(422);

    writeNewsletterDraft.mockResolvedValueOnce({ draft: { subject: "Only this", sections: [] } });
    res = await writeCopy(copyRequest());
    expect(res.status).toBe(502);
    expect(returnRun).toHaveBeenCalledTimes(3);
  });
});

describe("POST /api/tools/newsletter-image", () => {
  it("answers with an upload link and the image's public address", async () => {
    const res = await startUpload(uploadRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploadUrl).toBe("https://storage.example.com/put?signed=1");
    expect(body.url).toMatch(
      /^https:\/\/media\.example\.com\/newsletter-images\/company-1\/[a-f0-9-]{36}\.jpg$/,
    );
    expect(rateLimit).toHaveBeenCalledWith("newsletter-image:company-1", {
      limit: 40,
      windowSeconds: 86_400,
    });
  });

  it("turns away visitors and companies without a plan", async () => {
    getToolAccess.mockResolvedValue(SIGNED_OUT);
    expect((await startUpload(uploadRequest())).status).toBe(401);
    getToolAccess.mockResolvedValue(NO_PLAN);
    expect((await startUpload(uploadRequest())).status).toBe(403);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("needs the public asset domain, because an email can't use an address that expires", async () => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", "");
    expect((await startUpload(uploadRequest())).status).toBe(503);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("refuses files an email can't show, and stops at the daily limit", async () => {
    expect(
      (await startUpload(uploadRequest({ contentType: "image/svg+xml", sizeBytes: 5000 }))).status,
    ).toBe(400);
    expect(
      (await startUpload(uploadRequest({ contentType: "image/png", sizeBytes: 3 * 1024 * 1024 })))
        .status,
    ).toBe(400);
    expect(rateLimit).not.toHaveBeenCalled();
    rateLimit.mockResolvedValue({ allowed: false });
    expect((await startUpload(uploadRequest())).status).toBe(429);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});

describe("GET /api/tools/newsletter-image", () => {
  it("lists only the company's own pictures, newest first, with their public addresses", async () => {
    r2Send.mockResolvedValue({
      Contents: [
        {
          Key: "newsletter-images/company-1/old.jpg",
          Size: 10,
          LastModified: new Date("2026-01-01"),
        },
        {
          Key: "newsletter-images/company-1/new.png",
          Size: 20,
          LastModified: new Date("2026-06-01"),
        },
        {
          Key: "newsletter-images/company-1/notes.txt",
          Size: 5,
          LastModified: new Date("2026-07-01"),
        },
      ],
    });
    const res = await listUploads();
    expect(res.status).toBe(200);
    expect((await res.json()).images).toEqual([
      {
        url: "https://media.example.com/newsletter-images/company-1/new.png",
        bytes: 20,
        uploadedAt: "2026-06-01T00:00:00.000Z",
      },
      {
        url: "https://media.example.com/newsletter-images/company-1/old.jpg",
        bytes: 10,
        uploadedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(r2Send.mock.calls[0][0].input).toMatchObject({
      Bucket: "bucket",
      Prefix: "newsletter-images/company-1/",
    });
  });

  it("turns away visitors and companies without a plan, and needs the public asset domain", async () => {
    getToolAccess.mockResolvedValue(SIGNED_OUT);
    expect((await listUploads()).status).toBe(401);
    getToolAccess.mockResolvedValue(NO_PLAN);
    expect((await listUploads()).status).toBe(403);
    getToolAccess.mockResolvedValue(PRO);
    vi.stubEnv("R2_PUBLIC_BASE_URL", "");
    expect((await listUploads()).status).toBe(503);
    expect(r2Send).not.toHaveBeenCalled();
  });
});
