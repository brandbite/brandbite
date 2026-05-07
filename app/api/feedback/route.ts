// -----------------------------------------------------------------------------
// @file: app/api/feedback/route.ts
// @purpose: Submit feedback from any signed-in user (CUSTOMER / DESIGNER /
//           SITE_ADMIN / SITE_OWNER). Body is a small JSON envelope; the
//           UI captures the page URL, user-agent, and viewport client-side
//           and forwards them so admins can triage in context.
//
//           Auth: signed-in only. Rate-limited per-user so the floating
//           widget can't be turned into a spam vector.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FeedbackType } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const FEEDBACK_TYPES = ["BUG", "FEATURE", "PRAISE", "QUESTION"] as const;

const submitSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  message: z.string().trim().min(1, "Message is required.").max(4000),
  subject: z.string().trim().max(120).optional().nullable(),
  // Auto-captured client-side. All optional so a curl submission still
  // succeeds — they're operational hints, not validation.
  pageUrl: z.string().trim().max(2048).optional().nullable(),
  userAgent: z.string().trim().max(512).optional().nullable(),
  viewport: z
    .string()
    .trim()
    .max(32)
    .regex(/^\d+x\d+$/, "viewport must be WxH")
    .optional()
    .nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    // Per-user rate limit: 10 submissions / 5 min. Generous enough that
    // a power user filing a few bugs in quick succession isn't blocked,
    // tight enough that a runaway script can't fill the table.
    const ip = getClientIp(req.headers);
    const rl = await rateLimit(`feedback:user:${user.id}`, {
      limit: 10,
      windowSeconds: 300,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many feedback submissions in a short window. Please wait a few minutes before sending another.",
        },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: first?.message ?? "Invalid feedback payload." },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const created = await prisma.feedback.create({
      data: {
        type: data.type as FeedbackType,
        message: data.message,
        subject: data.subject?.trim() || null,
        pageUrl: data.pageUrl ?? null,
        userAgent: data.userAgent ?? null,
        viewport: data.viewport ?? null,
        submittedById: user.id,
        submittedByEmail: user.email,
        submittedByRole: user.role,
      },
      select: { id: true },
    });

    // Defensive log — also doubles as a "we got new feedback" signal in
    // server logs / Sentry breadcrumbs without us needing to wire up a
    // separate notification channel for v1. Per-IP for forensic linkage
    // if the admin queue spots a spammer.
    console.info("[feedback] submitted", {
      id: created.id,
      type: data.type,
      userId: user.id,
      role: user.role,
      ip,
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[POST /api/feedback] error", err);
    return NextResponse.json({ error: "Failed to submit feedback." }, { status: 500 });
  }
}
