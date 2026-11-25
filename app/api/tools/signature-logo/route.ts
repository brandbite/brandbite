// -----------------------------------------------------------------------------
// @file: app/api/tools/signature-logo/route.ts
// @purpose: Shows the email signature tool's preview the logo at the address
//           the visitor typed. The site's policy stops a page loading
//           pictures from other websites, so the preview asks for it here.
//           Public, like the tool; lib/net/public-image.ts decides what may
//           be fetched, and each visitor gets a limited number of requests.
//           The copied signature still points at the logo's own address.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { fetchPublicImage, PublicImageError } from "@/lib/net/public-image";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("url") ?? "";
  if (!address || address.length > 500) return fail(400, "Add the address of your logo.");

  const limit = await rateLimit(`signature-logo:${getClientIp(req.headers)}`, {
    limit: 40,
    windowSeconds: 600,
  });
  if (!limit.allowed) return fail(429, "Too many tries. Wait a few minutes and try again.");

  try {
    const image = await fetchPublicImage(address);
    return new NextResponse(image.bytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": image.contentType,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (error) {
    if (error instanceof PublicImageError) return fail(error.status, error.message);
    console.error("[tools/signature-logo] failed", error);
    return fail(502, "We couldn't load that picture.");
  }
}
