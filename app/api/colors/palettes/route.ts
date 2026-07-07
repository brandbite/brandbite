// -----------------------------------------------------------------------------
// @file: app/api/colors/palettes/route.ts
// @purpose: Save / list a signed-in user's color palettes from the /colors tools.
//           Any authenticated role may use it (NOT company-scoped, unlike
//           moodboards) — ownership is by createdById. Gated by the proxy's
//           session-cookie check plus getCurrentUserOrThrow here.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { normalizeHex } from "@/lib/colors";

const VALID_SOURCES = new Set(["WHEEL", "GENERATOR", "EXTRACTOR"]);

// ---------------------------------------------------------------------------
// GET — list the current user's saved palettes (newest first)
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();

    const palettes = await prisma.savedPalette.findMany({
      where: { createdById: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, colors: true, source: true, createdAt: true },
    });

    return NextResponse.json({
      palettes: palettes.map((p) => ({
        id: p.id,
        name: p.name,
        colors: Array.isArray(p.colors) ? (p.colors as string[]) : [],
        source: p.source,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[colors/palettes] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a palette { name, colors: string[], source? }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
      colors?: unknown;
      source?: unknown;
    } | null;

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) {
      return NextResponse.json(
        { error: "Name is required and must be 80 characters or fewer." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body?.colors) || body.colors.length < 1 || body.colors.length > 12) {
      return NextResponse.json(
        { error: "A palette must have between 1 and 12 colors." },
        { status: 400 },
      );
    }

    // Normalize + reject any invalid hex.
    const colors: string[] = [];
    for (const raw of body.colors) {
      const hex = typeof raw === "string" ? normalizeHex(raw) : null;
      if (!hex) {
        return NextResponse.json(
          { error: "All colors must be valid hex values." },
          { status: 400 },
        );
      }
      colors.push(hex);
    }

    const source =
      typeof body?.source === "string" && VALID_SOURCES.has(body.source) ? body.source : null;

    const created = await prisma.savedPalette.create({
      data: { name, colors, source, createdById: user.id },
      select: { id: true, name: true, colors: true, source: true, createdAt: true },
    });

    return NextResponse.json(
      {
        palette: {
          id: created.id,
          name: created.name,
          colors: Array.isArray(created.colors) ? (created.colors as string[]) : [],
          source: created.source,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[colors/palettes] POST error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
