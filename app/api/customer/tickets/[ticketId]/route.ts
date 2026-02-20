// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/route.ts
// @purpose: Get or update a single customer ticket (detail + status changes)
// @version: v1.1.1
// @status: active
// @lastUpdate: 2025-11-18
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TicketStatus, TicketPriority, CompanyRole } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    ticketId: string;
  }>;
};

// Board üzerinden status değiştirebilecek roller:
// - OWNER
// - PM
// - MEMBER
// (BILLING sadece finans odaklı, o yüzden şimdilik hariç bırakıyoruz)
const ALLOWED_UPDATE_ROLES: CompanyRole[] = ["OWNER", "PM", "MEMBER"];

// Güvenli tarafta kalmak için izin verilen status seti:
const ALLOWED_STATUSES: TicketStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

// -----------------------------------------------------------------------------
// GET /api/customer/tickets/[ticketId]
// Tek bir ticket'ın detayını döner (sadece current company scope'unda)
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: RouteContext) {
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

    const { ticketId } = await params;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Missing ticketId in route params" },
        { status: 400 },
      );
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        companyId: user.activeCompanyId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        jobType: {
          select: {
            id: true,
            name: true,
            tokenCost: true,
            creativePayoutTokens: true,
          },
        },
        tagAssignments: {
          select: {
            tag: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found for current company" },
        { status: 404 },
      );
    }

    const code =
      ticket.project?.code && ticket.companyTicketNumber != null
        ? `${ticket.project.code}-${ticket.companyTicketNumber}`
        : ticket.companyTicketNumber != null
        ? `#${ticket.companyTicketNumber}`
        : ticket.id;

    // Effective cost/payout (quantity × base, with possible override)
    const qty = ticket.quantity ?? 1;
    const effectiveCost = ticket.jobType
      ? (ticket.tokenCostOverride ?? ticket.jobType.tokenCost * qty)
      : null;
    const effectivePayout = ticket.jobType
      ? (ticket.creativePayoutOverride ?? ticket.jobType.creativePayoutTokens * qty)
      : null;

    return NextResponse.json(
      {
        ticket: {
          id: ticket.id,
          code,
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          dueDate: ticket.dueDate?.toISOString() ?? null,
          companyTicketNumber: ticket.companyTicketNumber,
          quantity: qty,
          effectiveCost,
          effectivePayout,
          tokenCostOverride: ticket.tokenCostOverride ?? null,
          creativePayoutOverride: ticket.creativePayoutOverride ?? null,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          project: ticket.project
            ? {
                id: ticket.project.id,
                name: ticket.project.name,
                code: ticket.project.code,
              }
            : null,
          isAssigned: ticket.creativeId != null,
          jobType: ticket.jobType
            ? {
                id: ticket.jobType.id,
                name: ticket.jobType.name,
                tokenCost: ticket.jobType.tokenCost,
                creativePayoutTokens:
                  ticket.jobType.creativePayoutTokens,
              }
            : null,
          tags: ticket.tagAssignments.map((ta) => ({
            id: ta.tag.id,
            name: ta.tag.name,
            color: ta.tag.color,
          })),
          createdBy: ticket.createdBy
            ? {
                id: ticket.createdBy.id,
                name: ticket.createdBy.name,
                email: ticket.createdBy.email,
              }
            : null,
        },
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

    console.error("[GET /api/customer/tickets/[ticketId]] error", error);
    return NextResponse.json(
      { error: "Failed to load ticket" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// PATCH /api/customer/tickets/[ticketId]
// Body: { status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" }
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    // Sadece CUSTOMER rolü ticket update edebilsin
    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can update tickets" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "User has no active company" },
        { status: 400 },
      );
    }

    if (
      !user.companyRole ||
      !ALLOWED_UPDATE_ROLES.includes(user.companyRole as CompanyRole)
    ) {
      return NextResponse.json(
        {
          error:
            "Only company owners, project managers or members can update tickets",
        },
        { status: 403 },
      );
    }

    const { ticketId } = await params;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Missing ticketId in route params" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    // Determine request type: status change vs field edit
    const hasStatusField = "status" in body;
    const EDITABLE_KEYS = ["title", "description", "priority", "dueDate", "projectId", "jobTypeId", "tagIds"];
    const hasEditFields = EDITABLE_KEYS.some((key) => key in body);

    // Verify ticket belongs to user's company
    const existing = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        companyId: user.activeCompanyId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Ticket not found for current company" },
        { status: 404 },
      );
    }

    // -----------------------------------------------------------------------
    // Branch A: Status change (existing behavior — drag-and-drop on board)
    // -----------------------------------------------------------------------
    if (hasStatusField && !hasEditFields) {
      const rawStatus = String((body as any).status ?? "")
        .trim()
        .toUpperCase();

      if (!ALLOWED_STATUSES.includes(rawStatus as TicketStatus)) {
        return NextResponse.json(
          {
            error:
              "Invalid status. Allowed values: TODO, IN_PROGRESS, IN_REVIEW, DONE",
          },
          { status: 400 },
        );
      }

      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: rawStatus as TicketStatus,
        },
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      });

      return NextResponse.json(
        {
          ticket: {
            id: updated.id,
            status: updated.status,
            updatedAt: updated.updatedAt.toISOString(),
          },
        },
        { status: 200 },
      );
    }

    // -----------------------------------------------------------------------
    // Branch B: Field edit (inline editing from detail modal)
    // -----------------------------------------------------------------------
    if (hasEditFields) {
      // CRITICAL BUSINESS RULE: only editable when status = TODO
      if (existing.status !== "TODO") {
        return NextResponse.json(
          {
            error:
              "Ticket can only be edited while in To do status. Once a creative starts working, the ticket is locked.",
          },
          { status: 403 },
        );
      }

      const updateData: Record<string, unknown> = {};

      // title
      if ("title" in body) {
        const title = String(body.title ?? "").trim();
        if (!title) {
          return NextResponse.json(
            { error: "Title cannot be empty" },
            { status: 400 },
          );
        }
        updateData.title = title;
      }

      // description
      if ("description" in body) {
        updateData.description =
          typeof body.description === "string"
            ? body.description.trim() || null
            : null;
      }

      // priority
      if ("priority" in body) {
        const p = String(body.priority ?? "").toUpperCase();
        if (!["LOW", "MEDIUM", "HIGH", "URGENT"].includes(p)) {
          return NextResponse.json(
            { error: "Invalid priority" },
            { status: 400 },
          );
        }
        updateData.priority = p as TicketPriority;
      }

      // dueDate
      if ("dueDate" in body) {
        if (body.dueDate === null || body.dueDate === "") {
          updateData.dueDate = null;
        } else {
          const d = new Date(String(body.dueDate));
          if (Number.isNaN(d.getTime())) {
            return NextResponse.json(
              { error: "Invalid due date" },
              { status: 400 },
            );
          }
          updateData.dueDate = d;
        }
      }

      // projectId
      if ("projectId" in body) {
        if (body.projectId === null || body.projectId === "") {
          updateData.projectId = null;
        } else {
          const project = await prisma.project.findFirst({
            where: {
              id: String(body.projectId),
              companyId: user.activeCompanyId!,
            },
            select: { id: true },
          });
          if (!project) {
            return NextResponse.json(
              { error: "Project not found for this company" },
              { status: 400 },
            );
          }
          updateData.projectId = project.id;
        }
      }

      // jobTypeId
      if ("jobTypeId" in body) {
        if (body.jobTypeId === null || body.jobTypeId === "") {
          updateData.jobTypeId = null;
        } else {
          const jt = await prisma.jobType.findUnique({
            where: { id: String(body.jobTypeId) },
            select: { id: true },
          });
          if (!jt) {
            return NextResponse.json(
              { error: "Job type not found" },
              { status: 400 },
            );
          }
          updateData.jobTypeId = jt.id;
        }
      }

      // tagIds — replace all tag assignments
      let newTagIds: string[] | null = null;
      if ("tagIds" in body) {
        const raw = Array.isArray(body.tagIds) ? body.tagIds : [];
        newTagIds = (raw as unknown[])
          .filter((id): id is string => typeof id === "string" && id.length > 0)
          .slice(0, 5);

        // Validate all tags belong to user's company
        if (newTagIds.length > 0) {
          const validTags = await prisma.ticketTag.findMany({
            where: {
              id: { in: newTagIds },
              companyId: user.activeCompanyId!,
            },
            select: { id: true },
          });
          const validIds = new Set(validTags.map((t) => t.id));
          newTagIds = newTagIds.filter((id) => validIds.has(id));
        }
      }

      // Need at least one scalar field to update OR tag changes
      if (Object.keys(updateData).length === 0 && newTagIds === null) {
        return NextResponse.json(
          { error: "No valid fields to update" },
          { status: 400 },
        );
      }

      // Use transaction so ticket update + tag replacement are atomic
      const updated = await prisma.$transaction(async (tx) => {
        // Update scalar fields (if any)
        const ticket = Object.keys(updateData).length > 0
          ? await tx.ticket.update({
              where: { id: ticketId },
              data: updateData,
            })
          : await tx.ticket.findUniqueOrThrow({
              where: { id: ticketId },
            });

        // Replace tag assignments (if tagIds was provided)
        if (newTagIds !== null) {
          await tx.ticketTagAssignment.deleteMany({
            where: { ticketId },
          });
          if (newTagIds.length > 0) {
            await tx.ticketTagAssignment.createMany({
              data: newTagIds.map((tagId) => ({
                ticketId,
                tagId,
              })),
            });
          }
        }

        // Re-fetch with all includes for the response
        return tx.ticket.findUniqueOrThrow({
          where: { id: ticketId },
          include: {
            project: { select: { id: true, name: true, code: true } },
            jobType: {
              select: {
                id: true,
                name: true,
                tokenCost: true,
                creativePayoutTokens: true,
              },
            },
            tagAssignments: {
              select: {
                tag: { select: { id: true, name: true, color: true } },
              },
            },
          },
        });
      });

      const code =
        updated.project?.code && updated.companyTicketNumber != null
          ? `${updated.project.code}-${updated.companyTicketNumber}`
          : updated.companyTicketNumber != null
            ? `#${updated.companyTicketNumber}`
            : updated.id;

      return NextResponse.json(
        {
          ticket: {
            id: updated.id,
            code,
            title: updated.title,
            description: updated.description,
            status: updated.status,
            priority: updated.priority,
            dueDate: updated.dueDate?.toISOString() ?? null,
            updatedAt: updated.updatedAt.toISOString(),
            createdAt: updated.createdAt.toISOString(),
            companyTicketNumber: updated.companyTicketNumber,
            projectId: updated.project?.id ?? null,
            projectName: updated.project?.name ?? null,
            projectCode: updated.project?.code ?? null,
            jobTypeId: updated.jobType?.id ?? null,
            jobTypeName: updated.jobType?.name ?? null,
            isAssigned: updated.creativeId != null,
            tags: updated.tagAssignments.map((ta) => ({
              id: ta.tag.id,
              name: ta.tag.name,
              color: ta.tag.color,
            })),
          },
        },
        { status: 200 },
      );
    }

    // Neither status nor editable fields
    return NextResponse.json(
      { error: "No recognized fields in request body" },
      { status: 400 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error(
      "[PATCH /api/customer/tickets/[ticketId]] error",
      error,
    );
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 },
    );
  }
}
