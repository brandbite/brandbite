// -----------------------------------------------------------------------------
// @file: app/api/colors/palettes/[paletteId]/route.ts
// @purpose: Update or delete one of the signed-in user's palettes. Another user's
//           palette answers 404, the same as one that doesn't exist.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { studioPaletteSchema } from "@/lib/colors/palette-schema";
import { savedPaletteFromRow, savedPaletteToRowData } from "@/lib/colors/saved-palette-row";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/schemas/helpers";

type RouteContext = { params: Promise<{ paletteId: string }> };

const updateSchema = z.object({ palette: studioPaletteSchema });

const NOT_FOUND = () => NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

function toErrorResponse(err: unknown, method: string) {
  if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  console.error(`[colors/palettes/:id] ${method} error:`, err);
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();
    const { paletteId } = await params;

    const parsed = await parseBody(req, updateSchema);
    if (!parsed.success) return parsed.response;

    const { count } = await prisma.savedPalette.updateMany({
      where: { id: paletteId, createdById: user.id },
      data: savedPaletteToRowData(parsed.data.palette),
    });
    if (count === 0) return NOT_FOUND();

    const row = await prisma.savedPalette.findFirst({
      where: { id: paletteId, createdById: user.id },
    });
    const palette = row ? savedPaletteFromRow(row) : null;
    return palette ? NextResponse.json({ palette }) : NOT_FOUND();
  } catch (err) {
    return toErrorResponse(err, "PATCH");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();
    const { paletteId } = await params;

    const { count } = await prisma.savedPalette.deleteMany({
      where: { id: paletteId, createdById: user.id },
    });
    return count === 0 ? NOT_FOUND() : NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err, "DELETE");
  }
}
