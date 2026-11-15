// -----------------------------------------------------------------------------
// @file: app/api/brand-form/[token]/route.ts
// @purpose: Public: someone with a brand form link sends their answers. No
//           account; the unguessable token in the link is the key. A link
//           takes one submission, and nothing reaches the brand guide until
//           the company reviews it.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { readAnswers, submitQuestionnaireSchema } from "@/lib/brand/questionnaire";
import { findQuestionnaireByToken } from "@/lib/brand/questionnaire.server";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/schemas/helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const ip = getClientIp(req.headers);
    const limit = await rateLimit(`brand-form:min:${ip}`, { limit: 10, windowSeconds: 60 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute and try again." },
        { status: 429 },
      );
    }

    const found = await findQuestionnaireByToken((await params).token);
    if (found.state !== "open") {
      return NextResponse.json(
        { error: "This link has already been used or is no longer open." },
        { status: found.state === "missing" ? 404 : 410 },
      );
    }

    const parsed = await parseBody(req, submitQuestionnaireSchema);
    if (!parsed.success) return parsed.response;
    const answers = readAnswers(parsed.data.answers);
    if (Object.keys(answers).length === 0) {
      return NextResponse.json({ error: "Please answer at least one question." }, { status: 400 });
    }

    // Only an OPEN form can be answered, so two submissions can't both land.
    const saved = await prisma.brandQuestionnaire.updateMany({
      where: { id: found.form.id, status: "OPEN" },
      data: {
        status: "SUBMITTED",
        respondentName: parsed.data.respondentName,
        respondentRole: parsed.data.respondentRole || null,
        answers,
        submittedAt: new Date(),
      },
    });
    if (saved.count === 0) {
      return NextResponse.json({ error: "This link has already been used." }, { status: 410 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[brand-form] POST error", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
