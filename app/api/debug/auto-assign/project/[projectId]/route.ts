// -----------------------------------------------------------------------------
// @file: app/api/debug/auto-assign/project/[projectId]/route.ts
// @purpose: SiteOwner / SiteAdmin API to update project-level auto-assign mode
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-20
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

type ProjectAutoAssignMode = "INHERIT" | "ON" | "OFF";

type ProjectPatchPayload = {
  autoAssignMode?: ProjectAutoAssignMode;
};

type ProjectPatchResponse = {
  id: string;
  autoAssignMode: ProjectAutoAssignMode;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "SITE_OWNER" && user.role !== "SITE_ADMIN") {
      return NextResponse.json(
        { error: "Only site owners and admins can update this setting." },
        { status: 403 },
      );
    }

    // Next.js 16: params bir Promise
    const { projectId } = await params;

    const body = (await req.json().catch(() => null)) as
      | ProjectPatchPayload
      | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const mode = body.autoAssignMode;

    if (mode !== "INHERIT" && mode !== "ON" && mode !== "OFF") {
      return NextResponse.json(
        {
          error:
            "autoAssignMode must be one of: INHERIT, ON, OFF",
        },
        { status: 400 },
      );
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        autoAssignMode: mode,
      } as any,
    });

    const response: ProjectPatchResponse = {
      id: updated.id,
      autoAssignMode:
        ((updated as any).autoAssignMode as ProjectAutoAssignMode | undefined) ??
        "INHERIT",
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[debug.autoAssign.project] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update project auto-assign mode" },
      { status: 500 },
    );
  }
}
