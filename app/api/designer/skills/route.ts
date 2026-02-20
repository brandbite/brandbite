// -----------------------------------------------------------------------------
// @file: app/api/designer/skills/route.ts
// @purpose: Designer skill management — GET current skills, PUT to replace all
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

// -----------------------------------------------------------------------------
// GET: Return designer's selected skills + all active job types
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only designers can access skills" },
        { status: 403 },
      );
    }

    const [skills, jobTypes] = await Promise.all([
      prisma.designerSkill.findMany({
        where: { designerId: user.id },
        select: { jobTypeId: true },
      }),
      prisma.jobType.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, category: true, description: true },
      }),
    ]);

    return NextResponse.json({
      selectedJobTypeIds: skills.map((s) => s.jobTypeId),
      jobTypes,
    });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[designer.skills] GET error", error);
    return NextResponse.json(
      { error: "Failed to load designer skills" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// PUT: Replace all designer skills (idempotent)
// -----------------------------------------------------------------------------

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only designers can manage skills" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.jobTypeIds)) {
      return NextResponse.json(
        { error: "jobTypeIds array is required" },
        { status: 400 },
      );
    }

    const rawIds: string[] = body.jobTypeIds.filter(
      (id: unknown): id is string => typeof id === "string" && id.length > 0,
    );

    // Validate all IDs are active job types
    const validJobTypes = await prisma.jobType.findMany({
      where: { id: { in: rawIds }, isActive: true },
      select: { id: true },
    });
    const validIds = validJobTypes.map((jt) => jt.id);

    // Replace all skills in a transaction
    await prisma.$transaction([
      prisma.designerSkill.deleteMany({ where: { designerId: user.id } }),
      prisma.designerSkill.createMany({
        data: validIds.map((jobTypeId) => ({
          designerId: user.id,
          jobTypeId,
        })),
      }),
    ]);

    return NextResponse.json({ selectedJobTypeIds: validIds });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[designer.skills] PUT error", error);
    return NextResponse.json(
      { error: "Failed to update designer skills" },
      { status: 500 },
    );
  }
}
