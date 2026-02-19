// -----------------------------------------------------------------------------
// @file: app/api/admin/plans/route.ts
// @purpose: Admin API for managing subscription plans (with Stripe mapping)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

type PlanResponseItem = {
  id: string;
  name: string;
  monthlyTokens: number;
  priceCents: number | null;
  isActive: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
  attachedCompanies: number;
  createdAt: string;
  updatedAt: string;
};

type PlansResponse = {
  plans: PlanResponseItem[];
};

type PlanPayload = {
  id?: string;
  name?: string;
  monthlyTokens?: number;
  priceCents?: number | null;
  isActive?: boolean;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
};

function requireAdmin(userRole: string) {
  if (userRole !== "SITE_OWNER" && userRole !== "SITE_ADMIN") {
    const error: Error & { code?: string; status?: number } = new Error(
      "You do not have permission to manage plans.",
    );
    error.code = "FORBIDDEN";
    error.status = 403;
    throw error;
  }
}

// -----------------------------------------------------------------------------
// GET: list plans
// -----------------------------------------------------------------------------

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    requireAdmin(user.role);

    const plans = await prisma.plan.findMany({
      orderBy: { monthlyTokens: "asc" },
      include: {
        _count: {
          select: { companies: true },
        },
      },
    });

    const payload: PlansResponse = {
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        monthlyTokens: p.monthlyTokens,
        priceCents: p.priceCents,
        isActive: p.isActive,
        stripeProductId: p.stripeProductId,
        stripePriceId: p.stripePriceId,
        attachedCompanies: p._count.companies,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }
    if (error?.code === "FORBIDDEN") {
      return NextResponse.json(
        { error: error.message },
        { status: error.status ?? 403 },
      );
    }

    console.error("[admin.plans] GET error", error);
    return NextResponse.json(
      { error: "Failed to load plans." },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// POST: create plan
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    requireAdmin(user.role);

    const body = (await req.json()) as PlanPayload;

    const name = body.name?.trim();
    const monthlyTokens = body.monthlyTokens;
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : true;
    const priceCents =
      typeof body.priceCents === "number"
        ? body.priceCents
        : body.priceCents === null
        ? null
        : null;

    if (!name) {
      return NextResponse.json(
        { error: "Plan name is required." },
        { status: 400 },
      );
    }

    if (
      typeof monthlyTokens !== "number" ||
      !Number.isFinite(monthlyTokens) ||
      monthlyTokens <= 0
    ) {
      return NextResponse.json(
        { error: "Monthly tokens must be a positive number." },
        { status: 400 },
      );
    }

    if (priceCents != null) {
      if (!Number.isFinite(priceCents) || priceCents < 0) {
        return NextResponse.json(
          {
            error:
              "Price (cents) must be null or a non-negative number.",
          },
          { status: 400 },
        );
      }
    }

    const stripeProductId =
      typeof body.stripeProductId === "string" &&
      body.stripeProductId.trim() !== ""
        ? body.stripeProductId.trim()
        : null;

    const stripePriceId =
      typeof body.stripePriceId === "string" &&
      body.stripePriceId.trim() !== ""
        ? body.stripePriceId.trim()
        : null;

    const created = await prisma.plan.create({
      data: {
        name,
        monthlyTokens,
        priceCents: priceCents ?? 0,
        isActive,
        stripeProductId,
        stripePriceId,
      },
    });

    return NextResponse.json(
      {
        id: created.id,
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }
    if (error?.code === "FORBIDDEN") {
      return NextResponse.json(
        { error: error.message },
        { status: error.status ?? 403 },
      );
    }

    console.error("[admin.plans] POST error", error);
    return NextResponse.json(
      { error: "Failed to create plan." },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// PATCH: update plan
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    requireAdmin(user.role);

    const body = (await req.json()) as PlanPayload;

    const id = body.id;
    if (!id) {
      return NextResponse.json(
        { error: "Plan id is required for update." },
        { status: 400 },
      );
    }

    const existing = await prisma.plan.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Plan not found." },
        { status: 404 },
      );
    }

    const updateData: any = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { error: "Plan name cannot be empty." },
          { status: 400 },
        );
      }
      updateData.name = name;
    }

    if (typeof body.monthlyTokens === "number") {
      if (
        !Number.isFinite(body.monthlyTokens) ||
        body.monthlyTokens <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Monthly tokens must be a positive number when provided.",
          },
          { status: 400 },
        );
      }
      updateData.monthlyTokens = body.monthlyTokens;
    }

    if (body.priceCents !== undefined) {
      const priceCents =
        typeof body.priceCents === "number"
          ? body.priceCents
          : body.priceCents === null
          ? null
          : null;

      if (priceCents != null) {
        if (!Number.isFinite(priceCents) || priceCents < 0) {
          return NextResponse.json(
            {
              error:
                "Price (cents) must be null or a non-negative number.",
            },
            { status: 400 },
          );
        }
      }

      updateData.priceCents = priceCents ?? 0;
    }

    if (typeof body.isActive === "boolean") {
      updateData.isActive = body.isActive;
    }

    if (body.stripeProductId !== undefined) {
      const productId =
        typeof body.stripeProductId === "string" &&
        body.stripeProductId.trim() !== ""
          ? body.stripeProductId.trim()
          : null;
      updateData.stripeProductId = productId;
    }

    if (body.stripePriceId !== undefined) {
      const priceId =
        typeof body.stripePriceId === "string" &&
        body.stripePriceId.trim() !== ""
          ? body.stripePriceId.trim()
          : null;
      updateData.stripePriceId = priceId;
    }

    const updated = await prisma.plan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      {
        id: updated.id,
      },
      { status: 200 },
    );
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }
    if (error?.code === "FORBIDDEN") {
      return NextResponse.json(
        { error: error.message },
        { status: error.status ?? 403 },
      );
    }

    console.error("[admin.plans] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update plan." },
      { status: 500 },
    );
  }
}
