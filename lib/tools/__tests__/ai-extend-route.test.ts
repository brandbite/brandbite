// @vitest-environment node
// "Extend with AI" costs money per image, so who may call it and how often is
// checked here: plan customers only, ten runs per company in 24 hours, and
// nothing reaches the image model until every check has passed.
import { beforeEach, describe, expect, it, vi } from "vitest";

const getToolAccess = vi.fn();
const rateLimit = vi.fn();
const recomposeImage = vi.fn();

vi.mock("@/lib/tools/entitlement.server", () => ({ getToolAccess: () => getToolAccess() }));
const returnRun = vi.fn();
vi.mock("@/lib/tools/daily-runs", () => ({
  holdRun: (...args: unknown[]) => rateLimit(...args),
  returnRun: (...args: unknown[]) => returnRun(...args),
}));
vi.mock("@/lib/ai/openai", () => ({
  recomposeImage: (...args: unknown[]) => recomposeImage(...args),
}));

import { POST } from "@/app/api/tools/ai-extend/route";

const PRO = {
  entitlement: { signedIn: true, pro: true, reason: null },
  userId: "user-1",
  companyId: "company-1",
  brandColors: [],
};

function request({
  image = new File([new Uint8Array(10)], "design.webp", { type: "image/webp" }),
  width = "1080",
  height = "566",
}: { image?: File | null; width?: string; height?: string } = {}) {
  const body = new FormData();
  if (image) body.set("image", image);
  body.set("targetWidth", width);
  body.set("targetHeight", height);
  return new Request("http://localhost/api/tools/ai-extend", { method: "POST", body }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  getToolAccess.mockResolvedValue(PRO);
  rateLimit.mockResolvedValue({ allowed: true, remaining: 7, resetAt: 0 });
  returnRun.mockResolvedValue(8);
  recomposeImage.mockResolvedValue({ bytes: Buffer.from([1, 2, 3]), contentType: "image/jpeg" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/tools/ai-extend", () => {
  it("returns the extended image and how many runs are left", async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("X-AI-Extend-Remaining")).toBe("7");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    const sent = recomposeImage.mock.calls[0][0];
    expect(sent.userId).toBe("user-1");
    // The target's own shape first, then a size every model takes.
    expect(sent.canvases).toEqual([
      { width: 1536, height: 800 },
      { width: 1536, height: 1024 },
    ]);
    expect(sent.promptFor(sent.canvases[0])).toMatch(/1536 by 800/);
    expect(sent.promptFor(sent.canvases[1])).toMatch(/will be cut away/);
  });

  it("counts runs per company, ten in 24 hours", async () => {
    await POST(request());
    expect(rateLimit).toHaveBeenCalledWith("ai-extend:company-1", {
      limit: 10,
      windowSeconds: 86_400,
    });
  });

  it("turns away visitors who aren't signed in, without touching the model or the count", async () => {
    getToolAccess.mockResolvedValue({
      entitlement: { signedIn: false, pro: false, reason: "signedOut" },
      userId: null,
      companyId: null,
      brandColors: [],
    });
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(recomposeImage).not.toHaveBeenCalled();
  });

  it("turns away signed-in people whose company has no active plan", async () => {
    getToolAccess.mockResolvedValue({
      ...PRO,
      entitlement: { signedIn: true, pro: false, reason: "noPlan" },
    });
    const res = await POST(request());
    expect(res.status).toBe(403);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(recomposeImage).not.toHaveBeenCalled();
  });

  it("counts a run only when it works: a failed one is given back", async () => {
    await POST(request());
    expect(returnRun).not.toHaveBeenCalled();

    recomposeImage.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(request());
    expect(res.status).toBe(502);
    expect(returnRun).toHaveBeenCalledWith("ai-extend:company-1", {
      limit: 10,
      windowSeconds: 86_400,
    });
    expect(await res.json()).toMatchObject({ remaining: 8 });
  });

  it("stops at the daily limit before calling the model", async () => {
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 123 });
    const res = await POST(request());
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ remaining: 0, resetAt: 123 });
    expect(recomposeImage).not.toHaveBeenCalled();
  });

  it("rejects a bad request before it uses up a run", async () => {
    const cases = [
      request({ width: "0" }),
      request({ height: "90000" }),
      request({ image: null }),
      request({ image: new File([new Uint8Array(10)], "a.gif", { type: "image/gif" }) }),
      request({
        image: new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.webp", { type: "image/webp" }),
      }),
    ];
    for (const req of cases) expect((await POST(req)).status).toBe(400);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(recomposeImage).not.toHaveBeenCalled();
  });

  it("says so when the image model isn't set up on this deployment", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("explains a refusal and an outage differently", async () => {
    recomposeImage.mockRejectedValueOnce(
      Object.assign(new Error("blocked"), { status: 400, code: "moderation_blocked" }),
    );
    const refused = await POST(request());
    expect(refused.status).toBe(422);
    expect((await refused.json()).error).toMatch(/wouldn't work on this image/);

    // A request the model couldn't read is our fault, not the picture's.
    recomposeImage.mockRejectedValueOnce(
      Object.assign(new Error("400 unknown parameter"), { status: 400, code: "invalid_request" }),
    );
    const ours = await POST(request());
    expect(ours.status).toBe(502);
    expect((await ours.json()).error).toMatch(/on our side/);

    recomposeImage.mockRejectedValueOnce(Object.assign(new Error("down"), { status: 500 }));
    const down = await POST(request());
    expect(down.status).toBe(502);
    expect((await down.json()).error).toMatch(/didn't answer/);
  });
});
