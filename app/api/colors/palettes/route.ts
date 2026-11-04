// -----------------------------------------------------------------------------
// @file: app/api/colors/palettes/route.ts
// @purpose: List and create a signed-in user's Color Studio palettes. Any
//           authenticated role may use it (NOT company-scoped, unlike moodboards);
//           ownership is by createdById. Gated by the proxy's session-cookie check
//           plus getCurrentUserOrThrow here. Guests keep palettes in their browser
//           and never call this route.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { MAX_SAVED_PALETTES, studioPaletteSchema } from "@/lib/colors/palette-schema";
import { savedPaletteFromRow, savedPaletteToRowData } from "@/lib/colors/saved-palette-row";
import type { StudioPalette } from "@/lib/colors";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/schemas/helpers";

const createSchema = z.union([
  z.object({ palette: studioPaletteSchema }),
  z.object({ palettes: z.array(studioPaletteSchema).min(1).max(MAX_SAVED_PALETTES) }),
]);

function toErrorResponse(err: unknown, method: string) {
  if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  console.error(`[colors/palettes] ${method} error:`, err);
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    const rows = await prisma.savedPalette.findMany({
      where: { createdById: user.id },
      orderBy: { updatedAt: "desc" },
    });
    const palettes = rows.map(savedPaletteFromRow).filter((p): p is StudioPalette => p !== null);
    return NextResponse.json({ palettes });
  } catch (err) {
    return toErrorResponse(err, "GET");
  }
}

/** Create one palette ({ palette }) or several at once ({ palettes }). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    const parsed = await parseBody(req, createSchema);
    if (!parsed.success) return parsed.response;
    const incoming = "palette" in parsed.data ? [parsed.data.palette] : parsed.data.palettes;

    const existing = await prisma.savedPalette.count({ where: { createdById: user.id } });
    if (existing + incoming.length > MAX_SAVED_PALETTES) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_SAVED_PALETTES} palettes.`, code: "LIMIT_REACHED" },
        { status: 409 },
      );
    }

    const rows = await prisma.savedPalette.createManyAndReturn({
      data: incoming.map((palette) => ({
        ...savedPaletteToRowData(palette),
        createdById: user.id,
      })),
    });
    return NextResponse.json(
      { palettes: rows.map(savedPaletteFromRow).filter((p): p is StudioPalette => p !== null) },
      { status: 201 },
    );
  } catch (err) {
    return toErrorResponse(err, "POST");
  }
}
