// -----------------------------------------------------------------------------
// @file: app/api/customer/tags/route.ts
// @purpose: List and create company-scoped ticket tags
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-18
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  normalizeCompanyRole,
  canManageTags,
} from "@/lib/permissions/companyRoles";
import { TAG_COLOR_KEYS } from "@/lib/tag-colors";

// ---------------------------------------------------------------------------
// GET — List all tags for the current user's company
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can access tags." },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company selected." },
        { status: 400 },
      );
    }

    const tags = await prisma.ticketTag.findMany({
      where: { companyId: user.activeCompanyId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ tags }, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[customer.tags] GET error", error);
    return NextResponse.json(
      { error: "Failed to load tags." },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create a new tag for the current user's company
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can create tags." },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company selected." },
        { status: 400 },
      );
    }

    const companyRole = normalizeCompanyRole(user.companyRole);
    if (!canManageTags(companyRole)) {
      return NextResponse.json(
        {
          error:
            "Only company owners or project managers can create tags.",
        },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body is required." },
        { status: 400 },
      );
    }

    // Validate name
    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 30) {
      return NextResponse.json(
        { error: "Tag name must be 1-30 characters." },
        { status: 400 },
      );
    }

    // Validate color
    const color =
      typeof body.color === "string" ? body.color : "GRAY";
    if (!TAG_COLOR_KEYS.includes(color as any)) {
      return NextResponse.json(
        { error: "Invalid tag color." },
        { status: 400 },
      );
    }

    // Create (catch unique constraint violation)
    try {
      const tag = await prisma.ticketTag.create({
        data: {
          name,
          color: color as any,
          companyId: user.activeCompanyId,
        },
        select: { id: true, name: true, color: true },
      });

      return NextResponse.json({ tag }, { status: 201 });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return NextResponse.json(
          {
            error: `A tag named "${name}" already exists in your company.`,
          },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[customer.tags] POST error", error);
    return NextResponse.json(
      { error: "Failed to create tag." },
      { status: 500 },
    );
  }
}
