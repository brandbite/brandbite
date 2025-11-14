// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/route.ts
// @purpose: Customer-facing ticket list API (company-scoped)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // NOTE (2025-11-14):
    // For now we use a simple companySlug query param to scope tickets.
    // Once BetterAuth is integrated, this will be replaced by the
    // current user's active company context.
    const companySlug = searchParams.get("companySlug") ?? "acme-studio";

    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        companyId: company.id,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        designer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        jobType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    });

    const payload = tickets.map((t) => {
      const code =
        t.project?.code && t.companyTicketNumber != null
          ? `${t.project.code}-${t.companyTicketNumber}`
          : t.companyTicketNumber != null
          ? `#${t.companyTicketNumber}`
          : t.id;

      return {
        id: t.id,
        code,
        title: t.title,
        status: t.status,
        priority: t.priority,
        projectName: t.project?.name ?? null,
        projectCode: t.project?.code ?? null,
        designerName: t.designer?.name ?? t.designer?.email ?? null,
        jobTypeName: t.jobType?.name ?? null,
        createdAt: t.createdAt.toISOString(),
        dueDate: t.dueDate?.toISOString() ?? null,
      };
    });

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
      tickets: payload,
    });
  } catch (error) {
    console.error("[customer.tickets] GET error", error);
    return NextResponse.json(
      { error: "Failed to load customer tickets" },
      { status: 500 }
    );
  }
}
