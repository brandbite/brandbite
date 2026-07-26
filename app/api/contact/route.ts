// -----------------------------------------------------------------------------
// @file: app/api/contact/route.ts
// @purpose: Public submission endpoint for the /contact form. Anonymous.
//           Mirrors /api/talent/applications' defence layers, in order:
//             1. Per-IP rate limit (broad bucket)
//             2. Zod validation of the JSON body
//             3. Per-email rate limit (tight bucket, rotating-IP spam)
//             4. Cloudflare Turnstile token verification
//             5. Persist a ContactMessage (status=NEW)
//             6. Best-effort SITE_OWNER email fan-out
//
//           Success returns 201 with `{ id }` only — no PII echo.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { notifySiteOwnersOfEvent } from "@/lib/admin-event-email";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/schemas/helpers";
import { contactSubmitSchema } from "@/lib/schemas/contact.schemas";
import { turnstileErrorMessage, verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";

/** 429 with {message,error} + Retry-After — same envelope as the talent
 *  and auth routes so client rendering stays consistent. */
function rateLimitedResponse(message: string, resetAt: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: message, message },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  // Layer 1 — per-IP. Generous: shared-NAT visitors shouldn't be punished
  // for someone else's double-click.
  const ipBucket = await rateLimit(`contact:ip:${ip}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!ipBucket.allowed) {
    return rateLimitedResponse(
      "Too many messages from this network. Please try again in a minute.",
      ipBucket.resetAt,
    );
  }

  // Validate body. parseBody returns the pre-formed 400 response on fail.
  const parsed = await parseBody(req, contactSubmitSchema);
  if (!parsed.success) return parsed.response;
  const data = parsed.data;

  // Layer 2 — per-email. Stops inbox-DoS from rotating IPs.
  const emailBucket = await rateLimit(`contact:email:${data.email}`, {
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (!emailBucket.allowed) {
    return rateLimitedResponse(
      "Too many messages from this email. Please wait 15 minutes and try again.",
      emailBucket.resetAt,
    );
  }

  // Turnstile gate — verified before any DB write. Fails open only when
  // TURNSTILE_SECRET_KEY is unset (dev/CI).
  const turnstile = await verifyTurnstileToken(data.turnstileToken, ip);
  if (!turnstile.ok) {
    const message = turnstileErrorMessage(turnstile.reason);
    return NextResponse.json({ error: message, message }, { status: 400 });
  }

  try {
    const created = await prisma.contactMessage.create({
      data: {
        name: data.name,
        email: data.email,
        company: data.company?.trim() || null,
        topic: data.topic?.trim() || null,
        message: data.message,
        ipAddress: ip || null,
        userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      },
      select: { id: true },
    });

    // Best-effort SITE_OWNER notification. Fire-and-forget so the public
    // form doesn't block on Resend.
    void notifySiteOwnersOfEvent({
      kind: "NEW_CONTACT_MESSAGE",
      contactMessageId: created.id,
      name: data.name,
      email: data.email,
      company: data.company?.trim() || null,
      topic: data.topic?.trim() || null,
      message: data.message,
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[api/contact] POST error", err);
    return NextResponse.json(
      { error: "Sending failed. Please try again in a moment." },
      { status: 500 },
    );
  }
}
