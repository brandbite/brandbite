// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/new-metadata/route.ts
// @purpose: Metadata for customer ticket creation (projects, job types, slug)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-12
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can create tickets" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "User has no active company" },
        { status: 400 },
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: user.activeCompanyId },
      select: {
        id: true,
        slug: true,
        tokenBalance: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company not found for current user" },
        { status: 404 },
      );
    }

    const [projects, jobTypes, tags] = await Promise.all([
      prisma.project.findMany({
        where: { companyId: company.id },
        select: {
          id: true,
          name: true,
          code: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.jobType.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          tokenCost: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.ticketTag.findMany({
        where: { companyId: company.id },
        select: {
          id: true,
          name: true,
          color: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    return NextResponse.json(
      {
        companySlug: company.slug,
        tokenBalance: company.tokenBalance,
        projects,
        jobTypes,
        tags,
      },
      { status: 200 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error(
      "[customer.tickets.new-metadata] GET error",
      error,
    );

    return NextResponse.json(
      { error: "Failed to load ticket metadata" },
      { status: 500 },
    );
  }
}
