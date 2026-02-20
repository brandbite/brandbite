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

// -----------------------------------------------------------------------------
// GET: list all job types
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can access job types" },
        { status: 403 },
      );
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
      designerPayoutTokens: jt.designerPayoutTokens,
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
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[admin.job-types] GET error", error);
    return NextResponse.json(
      { error: "Failed to load job types" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// POST: create new job type
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can create job types" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const name = (body?.name as string | undefined)?.trim();
    const category = (body?.category as string | undefined)?.trim() || null;
    const categoryId = (body?.categoryId as string | undefined) || null;
    const description = (body?.description as string | undefined)?.trim();
    const estimatedHoursRaw = body?.estimatedHours;
    const isActiveRaw = body?.isActive;
    const hasQuantity = typeof body?.hasQuantity === "boolean" ? body.hasQuantity : false;
    const quantityLabel = (body?.quantityLabel as string | undefined)?.trim() || null;
    const defaultQuantity = typeof body?.defaultQuantity === "number" ? Math.max(1, body.defaultQuantity) : 1;

    if (!name) {
      return NextResponse.json(
        { error: "Job type name is required" },
        { status: 400 },
      );
    }

    const estimatedHours =
      typeof estimatedHoursRaw === "string"
        ? parseInt(estimatedHoursRaw, 10)
        : estimatedHoursRaw;

    if (
      typeof estimatedHours !== "number" ||
      !Number.isFinite(estimatedHours) ||
      estimatedHours <= 0
    ) {
      return NextResponse.json(
        { error: "estimatedHours must be a positive integer" },
        { status: 400 },
      );
    }

    // Derive token values from estimated hours
    const tokenCost = estimatedHours;
    const designerPayoutTokens = Math.round(
      estimatedHours * (BASE_PAYOUT_PERCENT / 100),
    );

    const isActive =
      typeof isActiveRaw === "boolean" ? isActiveRaw : true;

    const created = await prisma.jobType.create({
      data: {
        name,
        category,
        categoryId,
        description: description || null,
        estimatedHours,
        tokenCost,
        designerPayoutTokens,
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
          designerPayoutTokens: created.designerPayoutTokens,
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
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[admin.job-types] POST error", error);
    return NextResponse.json(
      { error: "Failed to create job type" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// PATCH: update an existing job type
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can update job types" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const id = body?.id as string | undefined;
    if (!id) {
      return NextResponse.json(
        { error: "Job type id is required" },
        { status: 400 },
      );
    }

    const data: {
      name?: string;
      category?: string | null;
      categoryId?: string | null;
      description?: string | null;
      estimatedHours?: number;
      tokenCost?: number;
      designerPayoutTokens?: number;
      hasQuantity?: boolean;
      quantityLabel?: string | null;
      defaultQuantity?: number;
      isActive?: boolean;
    } = {};

    if (typeof body?.name === "string") {
      const trimmed = body.name.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "Job type name cannot be empty" },
          { status: 400 },
        );
      }
      data.name = trimmed;
    }

    if (body?.description === null) {
      data.description = null;
    } else if (typeof body?.description === "string") {
      data.description = body.description.trim() || null;
    }

    if (body?.estimatedHours !== undefined) {
      const estimatedHours =
        typeof body.estimatedHours === "string"
          ? parseInt(body.estimatedHours, 10)
          : body.estimatedHours;
      if (
        typeof estimatedHours !== "number" ||
        !Number.isFinite(estimatedHours) ||
        estimatedHours <= 0
      ) {
        return NextResponse.json(
          { error: "estimatedHours must be a positive integer" },
          { status: 400 },
        );
      }
      data.estimatedHours = estimatedHours;
      data.tokenCost = estimatedHours;
      data.designerPayoutTokens = Math.round(
        estimatedHours * (BASE_PAYOUT_PERCENT / 100),
      );
    }

    if (body?.category === null) {
      data.category = null;
    } else if (typeof body?.category === "string") {
      data.category = body.category.trim() || null;
    }

    if (body?.categoryId === null) {
      data.categoryId = null;
    } else if (typeof body?.categoryId === "string") {
      data.categoryId = body.categoryId;
    }

    if (typeof body?.hasQuantity === "boolean") {
      data.hasQuantity = body.hasQuantity;
    }

    if (body?.quantityLabel === null) {
      data.quantityLabel = null;
    } else if (typeof body?.quantityLabel === "string") {
      data.quantityLabel = body.quantityLabel.trim() || null;
    }

    if (typeof body?.defaultQuantity === "number" && body.defaultQuantity >= 1) {
      data.defaultQuantity = body.defaultQuantity;
    }

    if (typeof body?.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
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
        designerPayoutTokens: updated.designerPayoutTokens,
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
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[admin.job-types] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update job type" },
      { status: 500 },
    );
  }
}
