// -----------------------------------------------------------------------------
// @file: app/api/admin/mfa/verify/route.ts
// @purpose: Verify an MFA challenge code and unlock the trust window for
//           money-moving admin actions (Security Precaution Plan — L4).
//
//           Client flow:
//             1. Money-action route returned 202 with { challengeId }
//             2. User pastes the 6-digit code from email
//             3. Client POSTs here with { challengeId, code }
//             4. On 200, client retries the original money-action POST;
//                this time the server sees a recent consumed challenge
//                and proceeds.
//
//           Auth: must be signed in. Currently limited to SITE_OWNER —
//           only owners ever hit money actions that trigger MFA, and
//           letting a SITE_ADMIN verify a challenge they were never
//           issued is either useless (challenge.userId mismatch) or
//           confusing. Restrict up front.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteOwnerRole } from "@/lib/roles";
import { verifyChallenge } from "@/lib/mfa";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteOwnerRole(user.role)) {
      return NextResponse.json(
        { error: "MFA challenges are only issued to site owners." },
        { status: 403 },
      );
    }

    const body = (await req.json().catch(() => null)) as {
      challengeId?: string;
      code?: string;
    } | null;

    const result = await verifyChallenge(user.id, body?.challengeId ?? "", body?.code ?? "");

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/mfa/verify] POST error", error);
    return NextResponse.json({ error: "Failed to verify MFA" }, { status: 500 });
  }
}
