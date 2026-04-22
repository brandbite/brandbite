// -----------------------------------------------------------------------------
// @file: app/api/admin/mfa/verify/route.ts
// @purpose: Verify an MFA challenge and unlock the 30-minute trust window.
//           Two methods:
//             - method="email" → validates the 6-digit code against the
//               challenge row's hashed codeHash (legacy flow).
//             - method="totp"  → validates against the user's TOTP secret
//               (RFC 6238 + ±1 window). Writes a synthetic consumed
//               challenge row so the trust window check still passes.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { MFA_ACTION_TAG_MONEY, verifyChallenge, verifyTotp } from "@/lib/mfa";
import { isSiteOwnerRole } from "@/lib/roles";

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
      method?: "email" | "totp";
      challengeId?: string;
      code?: string;
      actionTag?: string;
    } | null;

    // Default to "email" for back-compat with any client that doesn't yet
    // send the method field. TOTP clients always send it explicitly.
    const method = body?.method === "totp" ? "totp" : "email";
    const code = body?.code ?? "";

    if (method === "totp") {
      const actionTag = body?.actionTag || MFA_ACTION_TAG_MONEY;
      const result = await verifyTotp(user.id, actionTag, code);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ ok: true });
    }

    // method === "email"
    const result = await verifyChallenge(user.id, body?.challengeId ?? "", code);
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
