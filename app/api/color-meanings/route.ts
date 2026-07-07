// -----------------------------------------------------------------------------
// @file: app/api/color-meanings/route.ts
// @purpose: Public read of PUBLISHED color meanings for the /colors hub list.
//           No auth (mirrors /api/showcase); listed in proxy PUBLIC_PATHS.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const meanings = await prisma.colorMeaning.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        hex: true,
        summary: true,
        associations: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ meanings });
  } catch (err) {
    console.error("[color-meanings] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
