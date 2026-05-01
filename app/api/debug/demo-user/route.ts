// -----------------------------------------------------------------------------
// @file: app/api/debug/demo-user/route.ts
// @purpose: Set or clear the demo auth persona cookie (bb-demo-user).
// @version: v1.3.0
// @status: active
// @lastUpdate: 2026-05-01
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { isValidDemoPersona } from "@/lib/demo-personas";

/**
 * Clear the persona cookie. Used by the "Clear active persona" button on
 * /debug/demo-user so a user can leave the demo persona overlay without
 * needing to delete the cookie via DevTools. After this, getCurrentUser()
 * resolves through the BetterAuth path only.
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true, cleared: true });
  // Setting an empty value with maxAge:0 deletes the cookie. We mirror the
  // attributes the POST handler set (path:/, httpOnly, sameSite:lax) so
  // the browser actually matches and removes it.
  res.cookies.set("bb-demo-user", "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const persona = String((body as any).persona ?? "");
    const redirectTo =
      typeof (body as any).redirectTo === "string" ? (body as any).redirectTo : "/";

    if (!isValidDemoPersona(persona)) {
      return NextResponse.json({ error: "Unknown demo persona" }, { status: 400 });
    }

    const res = NextResponse.json({
      ok: true,
      persona,
      redirectTo,
    });

    res.cookies.set("bb-demo-user", persona, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });

    return res;
  } catch (error) {
    console.error("[debug.demo-user] POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
