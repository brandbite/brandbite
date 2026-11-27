// -----------------------------------------------------------------------------
// @file: app/api/tools/newsletter-test/route.ts
// @purpose: "Send test" in the newsletter builder: sends the newsletter once,
//           to the signed-in person's own address and nowhere else, so they
//           can see it in a real inbox. The address is never taken from the
//           request. Included with a plan, a few a day per person; brandbite
//           still doesn't send a newsletter to anyone's list.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";

import { sendEmail } from "@/lib/email";
import {
  hasContent,
  NEWSLETTER_TEST_DAILY_LIMIT,
  readNewsletter,
} from "@/lib/newsletter/newsletter";
import { newsletterHtml, newsletterText } from "@/lib/newsletter/render";
import { rateLimit } from "@/lib/rate-limit";
import { getToolAccess } from "@/lib/tools/entitlement.server";

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const access = await getToolAccess().catch(() => null);
  if (!access?.userId || !access.userEmail) return fail(401, "Sign in to send a test.");
  if (!access.entitlement.pro || !access.companyId) {
    return fail(403, "Test emails are included with a brandbite plan.");
  }

  const body = (await req.json().catch(() => null)) as { data?: unknown } | null;
  const data = readNewsletter(body?.data);
  if (!data || !hasContent(data)) return fail(400, "Add some content before sending a test.");

  const limit = await rateLimit(`newsletter-test:${access.userId}`, {
    limit: NEWSLETTER_TEST_DAILY_LIMIT,
    windowSeconds: 86400,
  });
  if (!limit.allowed) {
    return fail(429, "You've sent a lot of tests today. Try again tomorrow.");
  }

  const subject = `[Test] ${data.subject.trim() || data.name.trim() || "Your newsletter"}`;
  const sent = await sendEmail(
    access.userEmail,
    subject.slice(0, 200),
    newsletterHtml(data, { test: true }),
    newsletterText(data),
  );
  if (!sent.ok) {
    return fail(
      sent.reason === "not_configured" ? 503 : 502,
      sent.reason === "not_configured"
        ? "Test emails aren't set up yet."
        : "The test couldn't be sent. Try again in a moment.",
    );
  }
  return NextResponse.json({ ok: true, to: access.userEmail });
}
