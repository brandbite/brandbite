// -----------------------------------------------------------------------------
// @file: app/api/debug/demo-user/route.ts
// @purpose: Set demo auth persona via cookie (bb-demo-user) - JSON based
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { isValidDemoPersona } from "@/lib/demo-personas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const persona = String((body as any).persona ?? "");
    const redirectTo =
      typeof (body as any).redirectTo === "string"
        ? (body as any).redirectTo
        : "/";

    if (!isValidDemoPersona(persona)) {
      return NextResponse.json(
        { error: "Unknown demo persona" },
        { status: 400 },
      );
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
