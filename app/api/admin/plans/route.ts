// -----------------------------------------------------------------------------
// @file: app/api/admin/plans/route.ts
// @purpose: Admin API for managing subscription plans (monthly tokens & pricing)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

// -----------------------------------------------------------------------------
// GET: list all plans
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can access plans" },
        { status: 403 },
      );
    }

    const plans = await prisma.plan.findMany({
      orderBy: { monthlyTokens: "asc" },
      include: {
        _count: {
          select: {
            companies: true,
          },
        },
      },
    });

    const items = plans.map((p) => ({
      id: p.id,
      name: p.name,
      monthlyTokens: p.monthlyTokens,
      priceCents: p.priceCents,
      isActive: p.isActive,
      attachedCompanies: p._count.companies,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return NextResponse.json({ plans: items });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[admin.plans] GET error", error);
    return NextResponse.json(
      { error: "Failed to load plans" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// POST: create new plan
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can create plans" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const name = (body?.name as string | undefined)?.trim();
    const monthlyTokensRaw = body?.monthlyTokens;
    const priceCentsRaw = body?.priceCents;
    const isActiveRaw = body?.isActive;

    if (!name) {
      return NextResponse.json(
        { error: "Plan name is required" },
        { status: 400 },
      );
    }

    const monthlyTokens =
      typeof monthlyTokensRaw === "string"
        ? parseInt(monthlyTokensRaw, 10)
        : monthlyTokensRaw;

    if (
      typeof monthlyTokens !== "number" ||
      !Number.isFinite(monthlyTokens) ||
      monthlyTokens <= 0
    ) {
      return NextResponse.json(
        { error: "monthlyTokens must be a positive integer" },
        { status: 400 },
      );
    }

    let priceCents: number | null = null;
    if (priceCentsRaw !== undefined && priceCentsRaw !== null) {
      const parsed =
        typeof priceCentsRaw === "string"
          ? parseInt(priceCentsRaw, 10)
          : priceCentsRaw;
      if (
        typeof parsed !== "number" ||
        !Number.isFinite(parsed) ||
        parsed < 0
      ) {
        return NextResponse.json(
          { error: "priceCents must be a non-negative integer" },
          { status: 400 },
        );
      }
      priceCents = parsed;
    }

    const isActive =
      typeof isActiveRaw === "boolean" ? isActiveRaw : true;

    const created = await prisma.plan.create({
      data: {
        name,
        monthlyTokens,
        priceCents,
        isActive,
      },
    });

    return NextResponse.json(
      {
        plan: {
          id: created.id,
          name: created.name,
          monthlyTokens: created.monthlyTokens,
          priceCents: created.priceCents,
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

    console.error("[admin.plans] POST error", error);
    return NextResponse.json(
      { error: "Failed to create plan" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// PATCH: update existing plan
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can update plans" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const id = body?.id as string | undefined;
    if (!id) {
      return NextResponse.json(
        { error: "Plan id is required" },
        { status: 400 },
      );
    }

    const data: {
      name?: string;
      monthlyTokens?: number;
      priceCents?: number | null;
      isActive?: boolean;
    } = {};

    if (typeof body?.name === "string") {
      const trimmed = body.name.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "Plan name cannot be empty" },
          { status: 400 },
        );
      }
      data.name = trimmed;
    }

    if (body?.monthlyTokens !== undefined) {
      const mt =
        typeof body.monthlyTokens === "string"
          ? parseInt(body.monthlyTokens, 10)
          : body.monthlyTokens;
      if (
        typeof mt !== "number" ||
        !Number.isFinite(mt) ||
        mt <= 0
      ) {
        return NextResponse.json(
          { error: "monthlyTokens must be a positive integer" },
          { status: 400 },
        );
      }
      data.monthlyTokens = mt;
    }

    if (body?.priceCents !== undefined) {
      if (body.priceCents === null) {
        data.priceCents = null;
      } else {
        const pc =
          typeof body.priceCents === "string"
            ? parseInt(body.priceCents, 10)
            : body.priceCents;
        if (
          typeof pc !== "number" ||
          !Number.isFinite(pc) ||
          pc < 0
        ) {
          return NextResponse.json(
            {
              error: "priceCents must be a non-negative integer",
            },
            { status: 400 },
          );
        }
        data.priceCents = pc;
      }
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

    const updated = await prisma.plan.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      plan: {
        id: updated.id,
        name: updated.name,
        monthlyTokens: updated.monthlyTokens,
        priceCents: updated.priceCents,
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

    console.error("[admin.plans] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update plan" },
      { status: 500 },
    );
  }
}
