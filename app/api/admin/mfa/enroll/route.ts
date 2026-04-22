// -----------------------------------------------------------------------------
// @file: app/api/admin/mfa/enroll/route.ts
// @purpose: TOTP enrolment flow. Two-step:
//             GET  → generate a pending secret, return the otpauth URL
//                    + QR data URL. Secret NOT persisted yet.
//             POST → user supplies the secret (echo back from GET) + a
//                    6-digit TOTP code they generated from it. If the
//                    code verifies, we persist the secret and set
//                    `totpEnrolledAt`. If wrong, reject — user should
//                    scan again and retry.
//             DELETE → disable TOTP on the caller's account (falls back
//                    to email codes).
//
//           SITE_OWNER only. Clears any existing secret-change from the
//           TOTP trust window so the cofounder can't inherit a stale
//           "recent MFA" when they re-enrol.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { buildOtpauthUrl, generateTotpSecret, verifyTotpCode } from "@/lib/mfa";
import { prisma } from "@/lib/prisma";
import { isSiteOwnerRole, type AppUserRole } from "@/lib/roles";

function requireOwner(role: AppUserRole) {
  if (!isSiteOwnerRole(role)) {
    return NextResponse.json({ error: "Only site owners can enrol TOTP." }, { status: 403 });
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET — start enrolment: returns a pending secret + QR to scan.
// The secret is NOT persisted until POST confirms a valid code from it.
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    const gate = requireOwner(user.role);
    if (gate) return gate;

    const secret = generateTotpSecret();
    const otpauthUrl = buildOtpauthUrl(secret, user.email);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 4,
    });

    return NextResponse.json({
      // Pending — client must echo this back with a valid code to finalise.
      secret,
      otpauthUrl,
      qrDataUrl,
      // Also useful for the "type manually" fallback if the user can't scan.
      label: user.email,
      issuer: "Brandbite",
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/mfa/enroll] GET error", error);
    return NextResponse.json({ error: "Failed to start enrolment" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — finalise enrolment by verifying a code the user generated.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const gate = requireOwner(user.role);
    if (gate) return gate;

    const body = (await req.json().catch(() => null)) as {
      secret?: string;
      code?: string;
    } | null;

    if (!body?.secret || !body?.code) {
      return NextResponse.json({ error: "Missing secret or code." }, { status: 400 });
    }

    if (!verifyTotpCode(body.secret, body.code)) {
      return NextResponse.json(
        { error: "That code didn't match. Scan the QR and try the current code." },
        { status: 400 },
      );
    }

    await prisma.userAccount.update({
      where: { id: user.id },
      data: {
        totpSecret: body.secret,
        totpEnrolledAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/mfa/enroll] POST error", error);
    return NextResponse.json({ error: "Failed to enrol TOTP" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — disable TOTP on the caller's account. Future money actions
// fall back to email codes.
// ---------------------------------------------------------------------------

export async function DELETE() {
  try {
    const user = await getCurrentUserOrThrow();
    const gate = requireOwner(user.role);
    if (gate) return gate;

    await prisma.userAccount.update({
      where: { id: user.id },
      data: { totpSecret: null, totpEnrolledAt: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/mfa/enroll] DELETE error", error);
    return NextResponse.json({ error: "Failed to disable TOTP" }, { status: 500 });
  }
}
