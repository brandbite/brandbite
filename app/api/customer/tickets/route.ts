// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/route.ts
// @purpose: Customer-facing ticket list & creation API (company-scoped)
// @version: v1.1.1
// @status: active
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  TicketStatus,
  TicketPriority,
  CompanyRole,
} from "@prisma/client";

// For now we use a fixed demo slug. Once auth is in place, this will come
// from the current user's active company context.
const DEFAULT_COMPANY_SLUG = "acme-studio";

// -----------------------------------------------------------------------------
// GET: list tickets for a company
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const companySlug =
      searchParams.get("companySlug") ?? DEFAULT_COMPANY_SLUG;

    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 },
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
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// POST: create new ticket for a company
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companySlug =
      searchParams.get("companySlug") ?? DEFAULT_COMPANY_SLUG;

    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const title = String(body.title ?? "").trim();
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const projectId =
      typeof body.projectId === "string" && body.projectId.length > 0
        ? body.projectId
        : null;
    const jobTypeId =
      typeof body.jobTypeId === "string" && body.jobTypeId.length > 0
        ? body.jobTypeId
        : null;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    // For now, pick a default "requester" from company members:
    // Prefer PM, otherwise OWNER. When auth is ready, this will be the current user.
    const requesterMember = await prisma.companyMember.findFirst({
      where: {
        companyId: company.id,
        roleInCompany: { in: [CompanyRole.PM, CompanyRole.OWNER] },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!requesterMember) {
      return NextResponse.json(
        { error: "No eligible company member found to assign as requester" },
        { status: 400 },
      );
    }

    // Optional: validate project belongs to company
    let project: { id: string } | null = null;
    if (projectId) {
      project = await prisma.project.findFirst({
        where: {
          id: projectId,
          companyId: company.id,
        },
        select: { id: true },
      });

      if (!project) {
        return NextResponse.json(
          { error: "Project not found for this company" },
          { status: 400 },
        );
      }
    }

    // Optional: validate jobType exists
    let jobType: { id: string } | null = null;
    if (jobTypeId) {
      jobType = await prisma.jobType.findUnique({
        where: { id: jobTypeId },
        select: { id: true },
      });

      if (!jobType) {
        return NextResponse.json(
          { error: "Job type not found" },
          { status: 400 },
        );
      }
    }

    // Compute next company ticket number (simple max+1 strategy)
    const lastTicket = await prisma.ticket.findFirst({
      where: { companyId: company.id },
      orderBy: { companyTicketNumber: "desc" },
      select: { companyTicketNumber: true },
    });

    const nextCompanyTicketNumber =
      (lastTicket?.companyTicketNumber ?? 100) + 1;

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description: description || null,
        status: TicketStatus.TODO,
        priority: TicketPriority.MEDIUM,
        companyId: company.id,
        projectId: project?.id ?? null,
        createdById: requesterMember.userId,
        jobTypeId: jobType?.id ?? null,
        companyTicketNumber: nextCompanyTicketNumber,
      },
      include: {
        project: {
          select: { id: true, name: true, code: true },
        },
        jobType: {
          select: { id: true, name: true },
        },
      },
    });

    const code =
      ticket.project?.code && ticket.companyTicketNumber != null
        ? `${ticket.project.code}-${ticket.companyTicketNumber}`
        : ticket.companyTicketNumber != null
        ? `#${ticket.companyTicketNumber}`
        : ticket.id;

    return NextResponse.json(
      {
        ticket: {
          id: ticket.id,
          code,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          projectName: ticket.project?.name ?? null,
          projectCode: ticket.project?.code ?? null,
          jobTypeName: ticket.jobType?.name ?? null,
          createdAt: ticket.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[customer.tickets] POST error", error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 },
    );
  }
}
