// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/route.ts
// @purpose: Customer-facing ticket list & creation API (session-based company)
// @version: v1.4.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  TicketStatus,
  TicketPriority,
  CompanyRole,
  LedgerDirection,
} from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canCreateTickets } from "@/lib/permissions/companyRoles";

// -----------------------------------------------------------------------------
// GET: list tickets for the current customer's active company
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can access customer tickets" },
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
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company not found for current user" },
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
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[customer.tickets] GET error", error);
    return NextResponse.json(
      { error: "Failed to load customer tickets" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// POST: create new ticket for current customer's company + debit tokens
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
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
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company not found for current user" },
        { status: 404 },
      );
    }

    // Company-level permission check: who can create tickets
    if (!canCreateTickets(user.companyRole ?? null)) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to create tickets for this company. Please ask your company owner or project manager.",
        },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const title = String((body as any).title ?? "").trim();
    const description =
      typeof (body as any).description === "string"
        ? (body as any).description.trim()
        : "";
    const projectId =
      typeof (body as any).projectId === "string" &&
      (body as any).projectId.length > 0
        ? (body as any).projectId
        : null;
    const jobTypeId =
      typeof (body as any).jobTypeId === "string" &&
      (body as any).jobTypeId.length > 0
        ? (body as any).jobTypeId
        : null;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    // For now, pick a default "requester" from company members:
    // Prefer PM, otherwise OWNER. When auth is ready for real,
    // we may switch this to "current user".
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

    // Optional: validate jobType exists (and grab tokenCost)
    let jobType: { id: string; tokenCost: number } | null = null;
    if (jobTypeId) {
      jobType = await prisma.jobType.findUnique({
        where: { id: jobTypeId },
        select: { id: true, tokenCost: true },
      });

      if (!jobType) {
        return NextResponse.json(
          { error: "Job type not found" },
          { status: 400 },
        );
      }
    }

    // If there is a job type, make sure the company has enough tokens
    if (jobType && company.tokenBalance < jobType.tokenCost) {
      return NextResponse.json(
        { error: "Not enough tokens for this job type" },
        { status: 400 },
      );
    }

    // Single transaction: create ticket + (optional) debit tokens + ledger entry
    const ticket = await prisma.$transaction(async (tx) => {
      const lastTicket = await tx.ticket.findFirst({
        where: { companyId: company.id },
        orderBy: { companyTicketNumber: "desc" },
        select: { companyTicketNumber: true },
      });

      const nextCompanyTicketNumber =
        (lastTicket?.companyTicketNumber ?? 100) + 1;

      const createdTicket = await tx.ticket.create({
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

      // If there is a job type, debit company tokens and create ledger entry
      if (jobType) {
        const balanceBefore = company.tokenBalance;
        const balanceAfter = balanceBefore - jobType.tokenCost;

        await tx.company.update({
          where: { id: company.id },
          data: {
            tokenBalance: balanceAfter,
          },
        });

        await tx.tokenLedger.create({
          data: {
            companyId: company.id,
            ticketId: createdTicket.id,
            direction: LedgerDirection.DEBIT,
            amount: jobType.tokenCost,
            reason: "JOB_REQUEST_CREATED",
            notes: `New ticket created: ${createdTicket.title}`,
            metadata: {
              jobTypeId: jobType.id,
              companyTicketNumber: createdTicket.companyTicketNumber,
              createdByUserId: requesterMember.userId,
            },
            balanceBefore,
            balanceAfter,
          },
        });
      }

      return createdTicket;
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
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[customer.tickets] POST error", error);
    return NextResponse.json(
      { error: "Failed to create customer ticket" },
      { status: 500 },
    );
  }
}
