// -----------------------------------------------------------------------------
// @file: app/api/tools/ai-extend/route.ts
// @purpose: "Resize with AI" for the social resizer: takes a design and the
//           size it is wanted in, has the image model lay the same design out
//           again for that shape, and returns the result as an image.
//
//           For signed-in customers whose company is on an active plan. It
//           costs money per image and no tokens, so each company gets
//           AI_EXTEND_DAILY_LIMIT runs in any 24 hours. A run that fails still
//           counts: the limiter has no way to hand one back.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { recomposeImage } from "@/lib/ai/openai";
import {
  AI_EXTEND_DAILY_LIMIT,
  AI_EXTEND_WINDOW_SECONDS,
  AI_IMAGE_MAX_BYTES,
  AI_IMAGE_TYPES,
  aiCanvas,
  aiResizePrompt,
  fallbackCanvas,
  parseTarget,
} from "@/lib/image-tools/ai-extend";
import { holdRun, returnRun } from "@/lib/tools/daily-runs";
import { getToolAccess } from "@/lib/tools/entitlement.server";

export const dynamic = "force-dynamic";
// The model takes its time on a full image.
export const maxDuration = 180;

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  const access = await getToolAccess().catch(() => null);
  if (!access?.userId) return fail(401, "Sign in to use AI resize.");
  if (!access.entitlement.pro || !access.companyId) {
    return fail(403, "AI resize is included with a brandbite plan.");
  }
  if (!process.env.OPENAI_API_KEY) return fail(503, "AI resize isn't set up yet.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "The image didn't arrive. Try again.");
  }
  const image = form.get("image");
  const target = parseTarget(form.get("targetWidth"), form.get("targetHeight"));
  if (!(image instanceof File) || !target) {
    return fail(400, "The request is missing the image or the size.");
  }
  if (!AI_IMAGE_TYPES.includes(image.type) || image.size > AI_IMAGE_MAX_BYTES) {
    return fail(400, "The image must be a PNG, JPG or WebP under 4 MB.");
  }

  const runsKey = `ai-extend:${access.companyId}`;
  const runs = { limit: AI_EXTEND_DAILY_LIMIT, windowSeconds: AI_EXTEND_WINDOW_SECONDS };
  const limit = await holdRun(runsKey, runs);
  if (!limit.allowed) {
    return fail(
      429,
      `Your company has used its ${AI_EXTEND_DAILY_LIMIT} AI resizes for now. More open up over the next 24 hours.`,
      { remaining: 0, resetAt: limit.resetAt },
    );
  }

  // The target's own shape first; a model that only takes fixed sizes gets
  // the closest one, with instructions to keep everything inside what survives the cut.
  const canvases = [
    aiCanvas(target.width, target.height),
    fallbackCanvas(target.width, target.height),
  ];

  try {
    const result = await recomposeImage({
      image,
      canvases,
      promptFor: (canvas) => aiResizePrompt(canvas, target.width, target.height),
      userId: access.userId,
    });
    return new NextResponse(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        "X-AI-Extend-Remaining": String(limit.remaining),
      },
    });
  } catch (error) {
    // A run that failed is given back: it doesn't count against the day.
    const remaining = (await returnRun(runsKey, runs)) ?? limit.remaining + 1;
    const status = (error as { status?: number })?.status;
    const code = (error as { code?: string })?.code;
    const message = (error as Error)?.message ?? "";
    console.error("[tools/ai-extend] failed", { status, code, message });
    if (code === "MISSING_ENV") return fail(503, "AI resize isn't set up yet.");
    // The model's own refusal of the picture, as opposed to a request it couldn't read.
    if (code === "moderation_blocked" || /safety|moderation|content policy/i.test(message)) {
      return fail(
        422,
        "The image model wouldn't work on this image. Try a different image, or crop it instead.",
        { remaining },
      );
    }
    if (status === 400) {
      return fail(
        502,
        "AI resize couldn't run on our side. We've logged it; crop this size for now.",
        { remaining },
      );
    }
    return fail(502, "The image model didn't answer. Try again in a moment.", {
      remaining,
    });
  }
}
