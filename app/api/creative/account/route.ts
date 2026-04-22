// -----------------------------------------------------------------------------
// @file: app/api/creative/account/route.ts
// @purpose: GDPR right-to-erasure for creatives (DESIGNER role). Mirrors
//           /api/customer/account — both delegate to lib/account-deletion.ts
//           so anonymize / cascade / auth-cookie drop stay in lock-step.
//
//           Ledger + withdrawal + completed-ticket rows stay on purpose:
//           they are financial records with tax/audit retention rules.
//           Identity fields on UserAccount are anonymized; the rows remain
//           queryable with "Deleted user".
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { deleteOwnAccount } from "@/lib/account-deletion";

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "This endpoint is for creative accounts only." },
        { status: 403 },
      );
    }

    const body = (await req.json().catch(() => null)) as {
      confirmEmail?: string;
    } | null;

    const result = await deleteOwnAccount({
      userId: user.id,
      sessionEmail: user.email,
      expectedRole: "DESIGNER",
      confirmEmail: body?.confirmEmail,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

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
    console.error("[creative/account] DELETE error", error);
    return NextResponse.json({ error: "Failed to delete account." }, { status: 500 });
  }
}
