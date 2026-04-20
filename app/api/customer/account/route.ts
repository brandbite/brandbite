// -----------------------------------------------------------------------------
// @file: app/api/customer/account/route.ts
// @purpose: GDPR right-to-erasure — soft-delete the UserAccount (anonymize
//           email + name + set deletedAt) and hard-delete the associated
//           BetterAuth user/session/account rows so the email is freed up
//           for re-registration. Ledger + ticket rows stay for financial /
//           audit compliance; those contain no direct PII.
//
//           Requires the caller to echo their own email back in the body as
//           a "yes I meant it" safeguard (matches the modal UX). Only the
//           user themselves can delete their own account — admins cannot
//           delete users here; they use a different flow.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    const body = (await req.json().catch(() => null)) as {
      confirmEmail?: string;
    } | null;

    if (
      !body?.confirmEmail ||
      body.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error:
            "Confirmation email did not match the account email. Type your exact email to confirm.",
        },
        { status: 400 },
      );
    }

    // Fetch the full record so we know the BetterAuth user id to clean up.
    const userAccount = await prisma.userAccount.findUnique({
      where: { id: user.id },
      select: { id: true, authUserId: true, email: true, deletedAt: true },
    });
    if (!userAccount) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    if (userAccount.deletedAt) {
      return NextResponse.json({ error: "Account is already deleted." }, { status: 400 });
    }

    // ------------------------------------------------------------------
    // All writes inside a transaction so we either fully delete or not at
    // all. Ordering: BetterAuth tables first (FK to authUser), then the
    // app's UserAccount row (anonymize, keep for ledger).
    // ------------------------------------------------------------------
    await prisma.$transaction(async (tx) => {
      // BetterAuth side: sessions → accounts → user.
      await tx.authSession.deleteMany({ where: { userId: userAccount.authUserId } });
      await tx.authAccount.deleteMany({ where: { userId: userAccount.authUserId } });
      await tx.authUser.deleteMany({ where: { id: userAccount.authUserId } });

      // App side: anonymize in place. New email + random authUserId to free
      // the uniques up for a re-register. Keep id, role, relations so
      // ledger / tickets / ratings stay queryable with "deleted account".
      const anonymizedEmail = `deleted-${userAccount.id}@deleted.brandbite.local`;
      const anonymizedAuthId = `deleted-${userAccount.id}-${Date.now()}`;

      await tx.userAccount.update({
        where: { id: userAccount.id },
        data: {
          deletedAt: new Date(),
          email: anonymizedEmail,
          authUserId: anonymizedAuthId,
          name: null,
        },
      });
    });

    // Best-effort: instruct the browser to drop our auth cookies. BetterAuth
    // won't recognise them anyway since the session rows are gone.
    const res = NextResponse.json({ ok: true });
    res.cookies.delete("better-auth.session_token");
    res.cookies.delete("bb-demo-user");
    return res;
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[customer/account] DELETE error", error);
    return NextResponse.json({ error: "Failed to delete account." }, { status: 500 });
  }
}
