// -----------------------------------------------------------------------------
// @file: app/api/tools/newsletter-copy/route.ts
// @purpose: The newsletter builder's AI writing, in the customer's brand
//           voice: a whole draft from a short description, a rewrite of one
//           block's text, or subject line ideas. Included with a plan; the
//           three share one limit per company per day and are never open to
//           signed-out visitors.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { AiRefusalError, writeCopyOptions, writeNewsletterDraft } from "@/lib/ai/anthropic";
import { hasVoice } from "@/lib/brand-copy/copy";
import {
  cleanDraft,
  cleanRewrite,
  cleanSubjects,
  NEWSLETTER_AI_DAILY_LIMIT,
  NEWSLETTER_AI_WINDOW_SECONDS,
  newsletterSystemPrompt,
  newsletterUserPrompt,
  parseNewsletterRequest,
  rewritePrompts,
  subjectPrompts,
} from "@/lib/newsletter/ai";
import { prisma } from "@/lib/prisma";
import { holdRun, returnRun } from "@/lib/tools/daily-runs";
import { getToolAccess } from "@/lib/tools/entitlement.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });

export async function POST(req: NextRequest) {
  const access = await getToolAccess().catch(() => null);
  if (!access?.userId) return fail(401, "Sign in to write with AI.");
  if (!access.entitlement.pro || !access.companyId) {
    return fail(403, "Writing with AI is included with a brandbite plan.");
  }
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, "Writing with AI isn't set up yet.");

  const request = parseNewsletterRequest(await req.json().catch(() => null));
  if ("error" in request) return fail(400, request.error);

  const runsKey = `newsletter-copy:${access.companyId}`;
  const runs = { limit: NEWSLETTER_AI_DAILY_LIMIT, windowSeconds: NEWSLETTER_AI_WINDOW_SECONDS };
  const limit = await holdRun(runsKey, runs);
  if (!limit.allowed) {
    return fail(
      429,
      `Your company has used its ${NEWSLETTER_AI_DAILY_LIMIT} writing runs for now. More open up over the next 24 hours.`,
      { remaining: 0, resetAt: limit.resetAt },
    );
  }

  // A run that fails is given back: it doesn't count against the day.
  const giveBack = async () => (await returnRun(runsKey, runs)) ?? limit.remaining + 1;
  const empty = async () =>
    fail(502, "The writer came back empty. Try again.", { remaining: await giveBack() });

  try {
    const brand = await prisma.brand.findFirst({
      where: { companyId: access.companyId, isDefault: true },
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
    const company = access.companyName ?? brand?.name ?? "";
    const answer = { remaining: limit.remaining, usedVoice: hasVoice(brand) };

    if (request.mode === "rewrite") {
      const prompts = rewritePrompts(company, brand, request);
      const result = await writeCopyOptions(prompts.system, prompts.user);
      const text = cleanRewrite(result.options, request.heading);
      return text ? NextResponse.json({ text, ...answer }) : await empty();
    }

    if (request.mode === "subjects") {
      const prompts = subjectPrompts(company, brand, request.content);
      const result = await writeCopyOptions(prompts.system, prompts.user);
      const subjects = cleanSubjects(result.options);
      return subjects.length ? NextResponse.json({ subjects, ...answer }) : await empty();
    }

    const result = await writeNewsletterDraft(
      newsletterSystemPrompt(company, brand),
      newsletterUserPrompt(request),
    );
    const draft = cleanDraft(result.draft);
    return draft ? NextResponse.json({ draft, ...answer }) : await empty();
  } catch (error) {
    const remaining = await giveBack();
    if (error instanceof AiRefusalError) {
      return fail(422, "The writer declined this one. Try describing it in a different way.", {
        remaining,
      });
    }
    console.error("[tools/newsletter-copy] failed", error);
    return fail(502, "It couldn't be written. Try again in a moment.", { remaining });
  }
}
