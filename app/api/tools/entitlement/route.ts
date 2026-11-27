// -----------------------------------------------------------------------------
// @file: app/api/tools/entitlement/route.ts
// @purpose: Tells a public hub tool (e.g. /mockups) whether the visitor gets
//           its Pro features, and the brand colors to offer a signed-in
//           customer. Public on purpose: a signed-out visitor gets a plain
//           "not signed in" answer instead of a redirect to /login.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { AI_EXTEND_DAILY_LIMIT } from "@/lib/image-tools/ai-extend";
import { NEWSLETTER_AI_DAILY_LIMIT } from "@/lib/newsletter/ai";
import { toolEntitlement } from "@/lib/tools/entitlement";
import {
  aiExtendAvailable,
  getToolAccess,
  newsletterAiAvailable,
  newsletterUploadAvailable,
} from "@/lib/tools/entitlement.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await getToolAccess();
    return NextResponse.json({
      ...access.entitlement,
      brandColors: access.brandColors,
      companyName: access.companyName,
      hasBrandLogo: access.hasBrandLogo,
      aiExtend: aiExtendAvailable(access.entitlement),
      aiExtendDailyLimit: AI_EXTEND_DAILY_LIMIT,
      newsletterAi: newsletterAiAvailable(access.entitlement),
      newsletterAiDailyLimit: NEWSLETTER_AI_DAILY_LIMIT,
      newsletterUpload: newsletterUploadAvailable(access.entitlement),
      newsletterTest: access.entitlement.pro && Boolean(process.env.RESEND_API_KEY),
    });
  } catch (error) {
    console.error("[tools/entitlement] failed", error);
    // The tool still works without this: treat the visitor as signed out.
    return NextResponse.json({
      ...toolEntitlement({ signedIn: false, plan: null }),
      brandColors: [],
      companyName: null,
      hasBrandLogo: false,
      aiExtend: false,
      aiExtendDailyLimit: AI_EXTEND_DAILY_LIMIT,
      newsletterAi: false,
      newsletterAiDailyLimit: NEWSLETTER_AI_DAILY_LIMIT,
      newsletterUpload: false,
      newsletterTest: false,
    });
  }
}
