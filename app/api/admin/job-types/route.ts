// -----------------------------------------------------------------------------
// @file: app/api/admin/job-types/route.ts
// @purpose: Admin API for managing job types (token cost & designer payout)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

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
    });

    const items = jobTypes.map((jt) => ({
      id: jt.id,
      name: jt.name,
      category: jt.category,
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
    const description = (body?.description as string | undefined)?.trim();
    const tokenCostRaw = body?.tokenCost;
    const designerPayoutTokensRaw = body?.designerPayoutTokens;
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

    const tokenCost =
      typeof tokenCostRaw === "string"
        ? parseInt(tokenCostRaw, 10)
        : tokenCostRaw;
    const designerPayoutTokens =
      typeof designerPayoutTokensRaw === "string"
        ? parseInt(designerPayoutTokensRaw, 10)
        : designerPayoutTokensRaw;

    if (
      typeof tokenCost !== "number" ||
      !Number.isFinite(tokenCost) ||
      tokenCost <= 0
    ) {
      return NextResponse.json(
        { error: "tokenCost must be a positive integer" },
        { status: 400 },
      );
    }

    if (
      typeof designerPayoutTokens !== "number" ||
      !Number.isFinite(designerPayoutTokens) ||
      designerPayoutTokens < 0
    ) {
      return NextResponse.json(
        {
          error:
            "designerPayoutTokens must be a non-negative integer",
        },
        { status: 400 },
      );
    }

    const isActive =
      typeof isActiveRaw === "boolean" ? isActiveRaw : true;

    const created = await prisma.jobType.create({
      data: {
        name,
        category,
        description: description || null,
        tokenCost,
        designerPayoutTokens,
        hasQuantity,
        quantityLabel,
        defaultQuantity,
        isActive,
      },
    });

    return NextResponse.json(
      {
        jobType: {
          id: created.id,
          name: created.name,
          category: created.category,
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
      description?: string | null;
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

    if (body?.tokenCost !== undefined) {
      const tokenCost =
        typeof body.tokenCost === "string"
          ? parseInt(body.tokenCost, 10)
          : body.tokenCost;
      if (
        typeof tokenCost !== "number" ||
        !Number.isFinite(tokenCost) ||
        tokenCost <= 0
      ) {
        return NextResponse.json(
          { error: "tokenCost must be a positive integer" },
          { status: 400 },
        );
      }
      data.tokenCost = tokenCost;
    }

    if (body?.designerPayoutTokens !== undefined) {
      const designerPayoutTokens =
        typeof body.designerPayoutTokens === "string"
          ? parseInt(body.designerPayoutTokens, 10)
          : body.designerPayoutTokens;
      if (
        typeof designerPayoutTokens !== "number" ||
        !Number.isFinite(designerPayoutTokens) ||
        designerPayoutTokens < 0
      ) {
        return NextResponse.json(
          {
            error:
              "designerPayoutTokens must be a non-negative integer",
          },
          { status: 400 },
        );
      }
      data.designerPayoutTokens = designerPayoutTokens;
    }

    if (body?.category === null) {
      data.category = null;
    } else if (typeof body?.category === "string") {
      data.category = body.category.trim() || null;
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
    });

    return NextResponse.json({
      jobType: {
        id: updated.id,
        name: updated.name,
        category: updated.category,
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
