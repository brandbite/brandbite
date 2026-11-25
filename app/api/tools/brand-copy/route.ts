// -----------------------------------------------------------------------------
// @file: app/api/tools/brand-copy/route.ts
// @purpose: Brand-voice copy. GET tells the page whether the tool is open to
//           this customer and what their brand guide says about language;
//           POST writes three options in that voice. Included with a plan,
//           limited per company per day, never open to signed-out visitors.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { AiRefusalError, writeCopyOptions } from "@/lib/ai/anthropic";
import {
  BRAND_COPY_DAILY_LIMIT,
  BRAND_COPY_WINDOW_SECONDS,
  cleanOptions,
  copySystemPrompt,
  copyUserPrompt,
  hasVoice,
  parseCopyRequest,
  voiceSummary,
} from "@/lib/brand-copy/copy";
import { prisma } from "@/lib/prisma";
import { holdRun, returnRun } from "@/lib/tools/daily-runs";
import { getToolAccess } from "@/lib/tools/entitlement.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });

function brandOf(companyId: string) {
  return prisma.brand.findFirst({
    where: { companyId, isDefault: true },
    select: {
      name: true,
      tagline: true,
      description: true,
      audience: true,
      values: true,
      toneWords: true,
      voiceNotes: true,
      voiceDo: true,
      voiceDont: true,
      wordsToUse: true,
      wordsToAvoid: true,
      sampleCopy: true,
    },
  });
}

export async function GET() {
  const access = await getToolAccess().catch(() => null);
  if (!access?.userId) return fail(401, "Sign in first.");
  const open = access.entitlement.pro && Boolean(access.companyId);
  const brand = open ? await brandOf(access.companyId!) : null;
  return NextResponse.json({
    open,
    ready: Boolean(process.env.ANTHROPIC_API_KEY),
    dailyLimit: BRAND_COPY_DAILY_LIMIT,
    companyName: access.companyName,
    hasVoice: hasVoice(brand),
    voice: voiceSummary(brand),
  });
}

export async function POST(req: NextRequest) {
  const access = await getToolAccess().catch(() => null);
  if (!access?.userId) return fail(401, "Sign in to use Brand-voice copy.");
  if (!access.entitlement.pro || !access.companyId) {
    return fail(403, "Brand-voice copy is included with a brandbite plan.");
  }
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, "Brand-voice copy isn't set up yet.");

  const request = parseCopyRequest(await req.json().catch(() => null));
  if ("error" in request) return fail(400, request.error);

  const runsKey = `brand-copy:${access.companyId}`;
  const runs = { limit: BRAND_COPY_DAILY_LIMIT, windowSeconds: BRAND_COPY_WINDOW_SECONDS };
  const limit = await holdRun(runsKey, runs);
  if (!limit.allowed) {
    return fail(
      429,
      `Your company has used its ${BRAND_COPY_DAILY_LIMIT} writing runs for now. More open up over the next 24 hours.`,
      { remaining: 0, resetAt: limit.resetAt },
    );
  }

  // A run that fails is given back: it doesn't count against the day.
  const giveBack = async () => (await returnRun(runsKey, runs)) ?? limit.remaining + 1;

  try {
    const brand = await brandOf(access.companyId);
    const result = await writeCopyOptions(
      copySystemPrompt(access.companyName ?? brand?.name ?? "", brand),
      copyUserPrompt(request),
    );
    const options = cleanOptions(result.options);
    if (!options.length) {
      return fail(502, "The writer came back empty. Try again.", { remaining: await giveBack() });
    }
    return NextResponse.json({ options, remaining: limit.remaining, usedVoice: hasVoice(brand) });
  } catch (error) {
    const remaining = await giveBack();
    if (error instanceof AiRefusalError) {
      return fail(
        422,
        "The writer declined this one. Describe what the copy is for in a different way.",
        { remaining },
      );
    }
    console.error("[tools/brand-copy] failed", error);
    return fail(502, "The copy couldn't be written. Try again in a moment.", { remaining });
  }
}
