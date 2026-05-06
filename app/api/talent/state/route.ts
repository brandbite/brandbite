// -----------------------------------------------------------------------------
// @file: app/api/talent/state/route.ts
// @purpose: Public read of the TALENT_APPLICATIONS_OPEN kill-switch so the
//           /talent page can render a closed-state banner without rendering
//           the form first. Mirrors the AppSetting the admin settings page
//           writes; default (unset / "true") = open.
//
//           Public on purpose — the only thing it leaks is whether intake
//           is currently open, which is already discoverable by anyone
//           submitting the form. Cached for 60s so a popular landing
//           page doesn't fan out to one DB read per visitor.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getAppSetting } from "@/lib/app-settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const value = await getAppSetting("TALENT_APPLICATIONS_OPEN");
    const open = value !== "false"; // default to open when unset
    return NextResponse.json(
      { open },
      {
        headers: {
          // Short cache — admins flipping the toggle want it to take
          // effect within a minute, but we also don't want to hit
          // the DB on every visitor render.
          "Cache-Control": "public, max-age=60, s-maxage=60",
        },
      },
    );
  } catch (err) {
    console.error("[GET /api/talent/state] error", err);
    // Fail open — better to let one candidate submit during a transient
    // DB hiccup than to falsely show "closed" and lose a real applicant.
    return NextResponse.json({ open: true });
  }
}
