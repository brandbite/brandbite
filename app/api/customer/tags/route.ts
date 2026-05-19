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
import { normalizeCompanyRole, canManageTags } from "@/lib/permissions/companyRoles";
import { parseBody } from "@/lib/schemas/helpers";
import { createTagSchema } from "@/lib/schemas/tag.schemas";
import { isTagsEnabled } from "@/lib/feature-flags";

// ---------------------------------------------------------------------------
// GET — List all tags for the current user's company
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can access tags." }, { status: 403 });
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company selected." }, { status: 400 });
    }

    // Feature flag: when TAGS_ENABLED is off, return an empty list +
    // tagsEnabled=false so the client can hide its tag UI entirely.
    // We deliberately don't 403 here — a GET returning [] is the least
    // disruptive behaviour for any page that fetches tags on mount.
    const tagsEnabled = await isTagsEnabled();
    if (!tagsEnabled) {
      return NextResponse.json({ tags: [], tagsEnabled: false }, { status: 200 });
    }

    const tags = await prisma.ticketTag.findMany({
      where: { companyId: user.activeCompanyId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ tags, tagsEnabled: true }, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.tags] GET error", error);
    return NextResponse.json({ error: "Failed to load tags." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Create a new tag for the current user's company
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can create tags." }, { status: 403 });
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company selected." }, { status: 400 });
    }

    // Feature-flag gate before the permission check — when tags are
    // globally disabled, no one (even an OWNER) should be able to mint
    // new rows. The UI hides the entry point already, so this is just
    // defence in depth against a direct API call.
    const tagsEnabled = await isTagsEnabled();
    if (!tagsEnabled) {
      return NextResponse.json({ error: "Tag system is currently disabled." }, { status: 403 });
    }

    const companyRole = normalizeCompanyRole(user.companyRole);
    if (!canManageTags(companyRole)) {
      return NextResponse.json(
        {
          error: "Only company owners or project managers can create tags.",
        },
        { status: 403 },
      );
    }

    const parsed = await parseBody(req, createTagSchema);
    if (!parsed.success) return parsed.response;
    const { name, color } = parsed.data;

    // Create (catch unique constraint violation)
    try {
      const tag = await prisma.ticketTag.create({
        data: {
          name,
          color,
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
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.tags] POST error", error);
    return NextResponse.json({ error: "Failed to create tag." }, { status: 500 });
  }
}
