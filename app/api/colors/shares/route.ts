// -----------------------------------------------------------------------------
// @file: app/api/colors/shares/route.ts
// @purpose: Create a read-only palette snapshot behind an unguessable link. Open
//           to guests, because guests can save palettes too, so it is rate limited
//           per IP. Stores only the name, colors and roles the request sends.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { COLOR_ROLES, type StudioRoles } from "@/lib/colors";
import { sharedPaletteSchema } from "@/lib/colors/palette-schema";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/schemas/helpers";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const perMinute = await rateLimit(`palette-share:min:${ip}`, { limit: 10, windowSeconds: 60 });
    const perDay = await rateLimit(`palette-share:day:${ip}`, {
      limit: 100,
      windowSeconds: 86400,
    });
    if (!perMinute.allowed || !perDay.allowed) {
      const resetAt = perMinute.allowed ? perDay.resetAt : perMinute.resetAt;
      return NextResponse.json(
        { error: "Too many links created. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))),
          },
        },
      );
    }

    const parsed = await parseBody(req, sharedPaletteSchema);
    if (!parsed.success) return parsed.response;
    const { name, colors, roles } = parsed.data;

    const colorIds = new Set(colors.map((c) => c.id));
    const keptRoles: StudioRoles = {};
    for (const role of COLOR_ROLES) {
      const colorId = roles[role];
      if (colorId && colorIds.has(colorId)) keptRoles[role] = colorId;
    }

    const row = await prisma.sharedPalette.create({
      data: {
        id: randomBytes(16).toString("base64url"),
        name,
        colors: colors.map((c) => ({ id: c.id, hex: c.hex })),
        roles: keptRoles,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (err) {
    console.error("[colors/shares] POST error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
