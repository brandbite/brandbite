// -----------------------------------------------------------------------------
// @file: app/api/talent/applications/route.ts
// @purpose: Public submission endpoint for the /talent application form.
//           Anonymous (no UserAccount). The flow is, in order:
//             1. Per-IP rate limit (broad bucket, generous)
//             2. Zod validation of the JSON body
//             3. Per-email rate limit (tight bucket, prevents inbox-DoS
//                + brute spam from rotating IPs)
//             4. Cloudflare Turnstile token verification
//             5. Cross-validate categoryIds against active rows
//             6. Persist a TalentApplication with status=SUBMITTED
//
//           Mirrors the auth catch-all's two-layer rate limit posture
//           (lib/rate-limit.ts + app/api/auth/[...all]/route.ts) so the
//           ops mental model is the same.
//
//           Errors return `{ error: "..." }` with the appropriate status.
//           Success returns 201 with `{ id }` only — no PII echo so a
//           leaked log line can't reveal anything the candidate didn't
//           type themselves.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getAppSetting } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/schemas/helpers";
import { talentApplicationSubmitSchema } from "@/lib/schemas/talent-application.schemas";
import { turnstileErrorMessage, verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";

/** Build a 429 response with the surface-readable {message,error} shape +
 *  Retry-After header. Same envelope the auth route uses so the client
 *  rendering is consistent. */
function rateLimitedResponse(message: string, resetAt: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: message, message },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  // Kill-switch: admins can pause new applications from /admin/settings
  // by storing TALENT_APPLICATIONS_OPEN="false". Checked first so
  // pausing the funnel doesn't waste an IP-bucket token or a Turnstile
  // verification on candidates whose submit will be refused anyway.
  const openSetting = await getAppSetting("TALENT_APPLICATIONS_OPEN");
  if (openSetting === "false") {
    return NextResponse.json(
      {
        error:
          "Talent applications are currently closed. Follow @brandbite or check back soon — we'll re-open intake when capacity allows.",
      },
      { status: 503 },
    );
  }

  // Layer 1 — per-IP rate limit. Generous because legitimate users from a
  // shared NAT (office, conference WiFi) shouldn't be punished by one
  // accidental double-click. The per-email layer below catches the more
  // dangerous "many IPs, same email" abuse pattern.
  const ipBucket = await rateLimit(`talent:ip:${ip}`, {
    limit: 20,
    windowSeconds: 60,
  });
  if (!ipBucket.allowed) {
    return rateLimitedResponse(
      "Too many submissions from this network. Please try again in a minute.",
      ipBucket.resetAt,
    );
  }

  // Validate body. parseBody returns the pre-formed 400 response on fail.
  const parsed = await parseBody(req, talentApplicationSubmitSchema);
  if (!parsed.success) return parsed.response;
  const data = parsed.data;

  // Layer 2 — per-email rate limit. Same posture as the auth route: 5 per
  // 15 min. Aggressive enough to stop inbox-DoS / brute spam, loose
  // enough to tolerate honest mistypes + retries.
  const emailBucket = await rateLimit(`talent:email:${data.email}`, {
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (!emailBucket.allowed) {
    return rateLimitedResponse(
      "Too many submissions from this email. Please wait 15 minutes and try again.",
      emailBucket.resetAt,
    );
  }

  // Turnstile gate. Mirrors the signup form (PR #218): the client form
  // posts the token alongside the rest of the body and we verify here
  // before any DB write.
  const turnstile = await verifyTurnstileToken(data.turnstileToken, ip);
  if (!turnstile.ok) {
    const message = turnstileErrorMessage(turnstile.reason);
    return NextResponse.json({ error: message, message }, { status: 400 });
  }

  // Cross-validate categoryIds against the source-of-truth table. This
  // catches a tampered payload that references a deleted/disabled
  // category, and it's a cheap query (indexed primary-key IN lookup).
  const validCategoryRows = await prisma.jobTypeCategory.findMany({
    where: { id: { in: data.categoryIds }, isActive: true },
    select: { id: true },
  });
  if (validCategoryRows.length !== data.categoryIds.length) {
    return NextResponse.json(
      { error: "One or more selected categories are no longer available" },
      { status: 400 },
    );
  }

  try {
    const created = await prisma.talentApplication.create({
      data: {
        fullName: data.fullName,
        whatsappNumber: data.whatsappNumber,
        email: data.email,
        country: data.country,
        timezone: data.timezone,
        portfolioUrl: data.portfolioUrl,
        linkedinUrl: data.linkedinUrl ?? null,
        socialLinks: data.socialLinks,
        categoryIds: data.categoryIds,
        totalYears: data.totalYears,
        hasRemoteExp: data.hasRemoteExp,
        // Defensive: if the candidate flips hasRemoteExp off after typing
        // a years value, persist null instead of the stale value. The
        // refinement only enforces presence-when-true; this enforces
        // absence-when-false.
        yearsRemote: data.hasRemoteExp ? (data.yearsRemote ?? null) : null,
        workedWith: data.workedWith,
        workload: data.workload,
        preferredTasksPerWeek:
          data.workload === "FULL_TIME" ? (data.preferredTasksPerWeek ?? null) : null,
        turnaroundOk: data.turnaroundOk,
        turnaroundComment: data.turnaroundComment ?? "",
        tools: data.tools,
        toolsOther: data.tools.includes("OTHER") ? (data.toolsOther ?? null) : null,
        testTaskOk: data.testTaskOk,
        communicationConfirmed: data.communicationConfirmed,
        // status defaults to SUBMITTED at the schema level
        ipAddress: ip || null,
        // Trim long UA strings — some scanners send 1KB+. 500 is plenty.
        userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[api/talent/applications] POST error", err);
    return NextResponse.json(
      { error: "Submission failed. Please try again in a moment." },
      { status: 500 },
    );
  }
}
