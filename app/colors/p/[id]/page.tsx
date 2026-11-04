// -----------------------------------------------------------------------------
// @file: app/colors/p/[id]/page.tsx
// @purpose: Public read-only view of a shared palette. Not indexed: a link is only
//           meant for the people it was given to. The id "example" renders a sample
//           outside production, so the design can be reviewed without a database
//           row. In production it behaves like any other unknown id.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import {
  PaletteUnavailable,
  SharedPaletteView,
} from "@/components/colors/studio/shared-palette-view";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { savedPaletteFromRow, type SavedPaletteRow } from "@/lib/colors/saved-palette-row";
import type { StudioPalette } from "@/lib/colors";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Shared palette",
  robots: { index: false, follow: false },
};

const EXAMPLE_ROW = {
  id: "example",
  name: "Ocean Breeze",
  colors: [
    { id: "a", hex: "#173b59" },
    { id: "b", hex: "#41c2d0" },
    { id: "c", hex: "#c9f1ed" },
    { id: "d", hex: "#ff6426" },
    { id: "e", hex: "#f6e5d5" },
  ],
  roles: { text: "a", primary: "b", surface: "c", accent: "d", background: "e" },
  createdAt: new Date("2026-11-04T12:00:00.000Z"),
};

function toPalette(row: Omit<SavedPaletteRow, "tags" | "source" | "updatedAt">) {
  return savedPaletteFromRow({ ...row, tags: [], source: "shared", updatedAt: row.createdAt });
}

async function loadPalette(id: string): Promise<StudioPalette | null> {
  if (id === "example" && process.env.VERCEL_ENV !== "production") return toPalette(EXAMPLE_ROW);
  try {
    const row = await prisma.sharedPalette.findUnique({ where: { id } });
    return row ? toPalette(row) : null;
  } catch (err) {
    console.error("[colors/p] load error:", err);
    return null;
  }
}

export default async function SharedPalettePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const palette = await loadPalette(id);

  return (
    <StudioShell
      title={palette ? `${palette.name}.` : "Shared palette."}
      blurb="A palette worth passing around."
      breadcrumb="Shared palette"
    >
      {palette ? <SharedPaletteView palette={palette} /> : <PaletteUnavailable />}
    </StudioShell>
  );
}
