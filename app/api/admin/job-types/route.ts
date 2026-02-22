// -----------------------------------------------------------------------------
// @file: app/api/admin/job-types/route.ts
// @purpose: Admin API for managing job types (estimated hours → auto token pricing)
// @version: v2.0.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { BASE_PAYOUT_PERCENT } from "@/lib/token-engine";
import { parseBody } from "@/lib/schemas/helpers";
import { createJobTypeSchema, updateJobTypeSchema } from "@/lib/schemas/job-type.schemas";

// -----------------------------------------------------------------------------
// GET: list all job types
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Only site admins can access job types" }, { status: 403 });
    }

    const jobTypes = await prisma.jobType.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        categoryRef: {
          select: { id: true, name: true, slug: true, icon: true },
        },
      },
    });

    const items = jobTypes.map((jt) => ({
      id: jt.id,
      name: jt.name,
      category: jt.category,
      categoryId: jt.categoryId,
      categoryRef: jt.categoryRef
        ? {
            id: jt.categoryRef.id,
            name: jt.categoryRef.name,
            slug: jt.categoryRef.slug,
            icon: jt.categoryRef.icon,
          }
        : null,
      description: jt.description,
      tokenCost: jt.tokenCost,
      creativePayoutTokens: jt.creativePayoutTokens,
      estimatedHours: jt.estimatedHours,
      hasQuantity: jt.hasQuantity,
      quantityLabel: jt.quantityLabel,
      defaultQuantity: jt.defaultQuantity,
      isActive: jt.isActive,
      createdAt: jt.createdAt.toISOString(),
      updatedAt: jt.updatedAt.toISOString(),
    }));

    return NextResponse.json({ jobTypes: items });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[admin.job-types] GET error", error);
    return NextResponse.json({ error: "Failed to load job types" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST: create new job type
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Only site admins can create job types" }, { status: 403 });
    }

    const parsed = await parseBody(req, createJobTypeSchema);
    if (!parsed.success) return parsed.response;
    const {
      name,
      category,
      categoryId,
      description,
      estimatedHours,
      isActive,
      hasQuantity,
      quantityLabel,
      defaultQuantity,
    } = parsed.data;

    // Derive token values from estimated hours
    const tokenCost = estimatedHours;
    const creativePayoutTokens = Math.round(estimatedHours * (BASE_PAYOUT_PERCENT / 100));

    const created = await prisma.jobType.create({
      data: {
        name,
        category,
        categoryId,
        description: description || null,
        estimatedHours,
        tokenCost,
        creativePayoutTokens,
        hasQuantity,
        quantityLabel,
        defaultQuantity,
        isActive,
      },
    });

    // Fetch with category relation for response
    const withCategory = await prisma.jobType.findUnique({
      where: { id: created.id },
      include: {
        categoryRef: {
          select: { id: true, name: true, slug: true, icon: true },
        },
      },
    });

    return NextResponse.json(
      {
        jobType: {
          id: created.id,
          name: created.name,
          category: created.category,
          categoryId: created.categoryId,
          categoryRef: withCategory?.categoryRef ?? null,
          description: created.description,
          tokenCost: created.tokenCost,
          creativePayoutTokens: created.creativePayoutTokens,
          estimatedHours: created.estimatedHours,
          hasQuantity: created.hasQuantity,
          quantityLabel: created.quantityLabel,
          defaultQuantity: created.defaultQuantity,
          isActive: created.isActive,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[admin.job-types] POST error", error);
    return NextResponse.json({ error: "Failed to create job type" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH: update an existing job type
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Only site admins can update job types" }, { status: 403 });
    }

    const parsed = await parseBody(req, updateJobTypeSchema);
    if (!parsed.success) return parsed.response;
    const { id, ...fields } = parsed.data;

    const data: Record<string, unknown> = {};

    if (fields.name !== undefined) data.name = fields.name;
    if (fields.description !== undefined) data.description = fields.description;
    if (fields.category !== undefined) data.category = fields.category;
    if (fields.categoryId !== undefined) data.categoryId = fields.categoryId;
    if (fields.hasQuantity !== undefined) data.hasQuantity = fields.hasQuantity;
    if (fields.quantityLabel !== undefined) data.quantityLabel = fields.quantityLabel;
    if (fields.defaultQuantity !== undefined) data.defaultQuantity = fields.defaultQuantity;
    if (fields.isActive !== undefined) data.isActive = fields.isActive;

    if (fields.estimatedHours !== undefined) {
      data.estimatedHours = fields.estimatedHours;
      data.tokenCost = fields.estimatedHours;
      data.creativePayoutTokens = Math.round(fields.estimatedHours * (BASE_PAYOUT_PERCENT / 100));
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.jobType.update({
      where: { id },
      data,
      include: {
        categoryRef: {
          select: { id: true, name: true, slug: true, icon: true },
        },
      },
    });

    return NextResponse.json({
      jobType: {
        id: updated.id,
        name: updated.name,
        category: updated.category,
        categoryId: updated.categoryId,
        categoryRef: updated.categoryRef ?? null,
        description: updated.description,
        tokenCost: updated.tokenCost,
        creativePayoutTokens: updated.creativePayoutTokens,
        estimatedHours: updated.estimatedHours,
        hasQuantity: updated.hasQuantity,
        quantityLabel: updated.quantityLabel,
        defaultQuantity: updated.defaultQuantity,
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[admin.job-types] PATCH error", error);
    return NextResponse.json({ error: "Failed to update job type" }, { status: 500 });
  }
}
