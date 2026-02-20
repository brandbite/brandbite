// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/route.ts
// @purpose: Customer-facing ticket list & creation API (session-based company,
//           with company/project-based auto-assign configuration)
// @version: v1.8.0
// @status: active
// @lastUpdate: 2025-11-20
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  TicketStatus,
  TicketPriority,
  CompanyRole,
  LedgerDirection,
  UserRole,
  AutoAssignMode,
} from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canCreateTickets } from "@/lib/permissions/companyRoles";
import { createNotification } from "@/lib/notifications";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function isAutoAssignEnabled(
  companyDefault: boolean,
  projectMode?: AutoAssignMode | null,
): boolean {
  if (!projectMode || projectMode === AutoAssignMode.INHERIT) {
    return companyDefault;
  }
  if (projectMode === AutoAssignMode.ON) return true;
  if (projectMode === AutoAssignMode.OFF) return false;
  return companyDefault;
}

// -----------------------------------------------------------------------------
// GET: list tickets for the current customer's active company
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
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
        assets: {
          where: { kind: "BRIEF_INPUT", deletedAt: null },
          select: {
            id: true,
            url: true,
            mimeType: true,
          },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        tagAssignments: {
          select: {
            tag: {
              select: { id: true, name: true, color: true },
            },
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
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        projectId: t.project?.id ?? null,
        projectName: t.project?.name ?? null,
        projectCode: t.project?.code ?? null,
        designerName: t.designer?.name ?? null,
        jobTypeId: t.jobType?.id ?? null,
        jobTypeName: t.jobType?.name ?? null,
        createdAt: t.createdAt.toISOString(),
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        thumbnailUrl: t.assets?.[0]?.url ?? null,
        thumbnailAssetId: t.assets?.[0]?.id ?? null,
        tags: t.tagAssignments.map((ta: any) => ({
          id: ta.tag.id,
          name: ta.tag.name,
          color: ta.tag.color,
        })),
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

    const raw = body as Record<string, unknown>;

    const title = String(raw.title ?? "").trim();
    const description =
      typeof raw.description === "string" ? raw.description.trim() : "";
    const projectId =
      typeof raw.projectId === "string" && raw.projectId.length > 0
        ? (raw.projectId as string)
        : null;
    const jobTypeId =
      typeof raw.jobTypeId === "string" && raw.jobTypeId.length > 0
        ? (raw.jobTypeId as string)
        : null;

    // Parse quantity (integer 1–10, default 1)
    const rawQuantity =
      typeof raw.quantity === "number"
        ? raw.quantity
        : typeof raw.quantity === "string"
        ? parseInt(raw.quantity, 10)
        : 1;
    const quantity = Math.max(1, Math.min(10, Math.floor(rawQuantity) || 1));

    const priorityRaw =
      typeof raw.priority === "string"
        ? raw.priority.toUpperCase()
        : "MEDIUM";

    let selectedPriority: TicketPriority;
    switch (priorityRaw) {
      case "LOW":
        selectedPriority = TicketPriority.LOW;
        break;
      case "HIGH":
        selectedPriority = TicketPriority.HIGH;
        break;
      case "URGENT":
        selectedPriority = TicketPriority.URGENT;
        break;
      case "MEDIUM":
      default:
        selectedPriority = TicketPriority.MEDIUM;
        break;
    }

    // Parse optional dueDate (ISO 8601 string or YYYY-MM-DD)
    let parsedDueDate: Date | null = null;
    if (typeof raw.dueDate === "string" && raw.dueDate.trim().length > 0) {
      const d = new Date(raw.dueDate.trim());
      if (!Number.isNaN(d.getTime())) {
        parsedDueDate = d;
      }
    }

    // Parse optional tagIds (max 5)
    const rawTagIds: string[] = Array.isArray(raw.tagIds)
      ? (raw.tagIds as unknown[])
          .filter((id): id is string => typeof id === "string" && id.length > 0)
          .slice(0, 5)
      : [];

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    // For now, pick a default "requester" from company members:
    // Prefer PM, otherwise OWNER.
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

    // Optional: validate project belongs to company (and read autoAssignMode)
    let project: { id: string; autoAssignMode: AutoAssignMode } | null =
      null;

    if (projectId) {
      project = await prisma.project.findFirst({
        where: {
          id: projectId,
          companyId: company.id,
        },
        select: {
          id: true,
          autoAssignMode: true,
        },
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
    // Effective cost accounts for quantity multiplier.
    const effectiveCost = jobType ? jobType.tokenCost * quantity : 0;

    if (jobType && company.tokenBalance < effectiveCost) {
      return NextResponse.json(
        { error: "Not enough tokens for this job type" },
        { status: 400 },
      );
    }

    // -------------------------------------------------------------------------
    // Auto-assign effective flag (company + project)
    // -------------------------------------------------------------------------
    const companyAutoAssignDefault =
      company.autoAssignDefaultEnabled ?? false;
    const projectAutoAssignMode = project?.autoAssignMode ?? null;

    const autoAssignEffective = isAutoAssignEnabled(
      companyAutoAssignDefault,
      projectAutoAssignMode,
    );

    // -------------------------------------------------------------------------
    // Transaction:
    //  - Compute next companyTicketNumber
    //  - Auto-assign designer based on effective flag (or fallback/unassigned)
    //  - Create ticket
    //  - (Optional) debit tokens + ledger
    //  - (Optional) write TicketAssignmentLog (AUTO_ASSIGN / FALLBACK)
// -------------------------------------------------------------------------
    const ticket = await prisma.$transaction(async (tx) => {
      // 1) Next company ticket number
      const lastTicket = await tx.ticket.findFirst({
        where: { companyId: company.id },
        orderBy: { companyTicketNumber: "desc" },
        select: { companyTicketNumber: true },
      });

      const nextCompanyTicketNumber =
        (lastTicket?.companyTicketNumber ?? 100) + 1;

      // 2) Decide designer assignment based on settings
      let assignedDesignerId: string | null = null;
      let assignmentReason: "AUTO_ASSIGN" | "FALLBACK" | null = null;
      let fallbackMode:
        | "settings_disabled"
        | "no_designers"
        | "no_skilled_designers"
        | null = null;
      let skillFiltered = false;
      let skilledDesignerCount = 0;

      if (autoAssignEffective) {
        // auto-assign açık: skill-filtered + load-based algoritma
        let designers: { id: string }[];

        if (jobType) {
          // Find designers who have this job type as a skill
          const skilledDesigners = await tx.designerSkill.findMany({
            where: { jobTypeId: jobType.id },
            select: { designerId: true },
          });
          designers = skilledDesigners.map((s) => ({ id: s.designerId }));
          skilledDesignerCount = designers.length;
          skillFiltered = true;

          // Fallback: no skilled designers → use all designers
          if (designers.length === 0) {
            designers = await tx.userAccount.findMany({
              where: { role: UserRole.DESIGNER },
              select: { id: true },
            });
            skillFiltered = false;
            fallbackMode = "no_skilled_designers";
          }
        } else {
          // No job type specified: use all designers
          designers = await tx.userAccount.findMany({
            where: { role: UserRole.DESIGNER },
            select: { id: true },
          });
        }

        if (designers.length > 0) {
          const designerIds = designers.map((d) => d.id);

          // Current open tickets per designer with jobType + priority
          const openTickets = await tx.ticket.findMany({
            where: {
              designerId: { in: designerIds },
              status: {
                in: [
                  TicketStatus.TODO,
                  TicketStatus.IN_PROGRESS,
                  TicketStatus.IN_REVIEW,
                ],
              },
            },
            select: {
              id: true,
              designerId: true,
              priority: true,
              quantity: true,
              jobType: {
                select: { tokenCost: true },
              },
            },
          });

          const priorityWeights: Record<TicketPriority, number> = {
            LOW: 1,
            MEDIUM: 2,
            HIGH: 3,
            URGENT: 4,
          };

          const loadByDesigner = new Map<string, number>();
          for (const id of designerIds) {
            loadByDesigner.set(id, 0);
          }

          for (const t of openTickets) {
            if (!t.designerId) continue;
            if (!loadByDesigner.has(t.designerId)) continue;

            const weight = priorityWeights[t.priority as TicketPriority];
            const tokenCost = (t.jobType?.tokenCost ?? 1) * (t.quantity ?? 1);
            const delta = weight * tokenCost;

            loadByDesigner.set(
              t.designerId,
              (loadByDesigner.get(t.designerId) ?? 0) + delta,
            );
          }

          assignedDesignerId = designerIds.reduce(
            (bestId: string | null, currentId: string) => {
              if (!bestId) return currentId;
              const bestLoad = loadByDesigner.get(bestId) ?? 0;
              const currentLoad = loadByDesigner.get(currentId) ?? 0;
              if (currentLoad < bestLoad) return currentId;
              return bestId;
            },
            null as string | null,
          );

          assignmentReason = "AUTO_ASSIGN";
        } else {
          // Auto-assign açık ama hiç designer yok → fallback
          assignedDesignerId = null;
          assignmentReason = "FALLBACK";
          fallbackMode = "no_designers";
        }
      } else {
        // Auto-assign ayarlardan kapalı → fallback/unassigned
        assignedDesignerId = null;
        assignmentReason = "FALLBACK";
        fallbackMode = "settings_disabled";
      }

      // 3) Create ticket
      const createdTicket = await tx.ticket.create({
        data: {
          title,
          description: description || null,
          status: TicketStatus.TODO,
          priority: selectedPriority,
          dueDate: parsedDueDate,
          companyId: company.id,
          projectId: project?.id ?? null,
          createdById: requesterMember.userId,
          jobTypeId: jobType?.id ?? null,
          quantity,
          companyTicketNumber: nextCompanyTicketNumber,
          designerId: assignedDesignerId,
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

      // 4) If there is a job type, debit company tokens and create ledger entry
      if (jobType) {
        const balanceBefore = company.tokenBalance;
        const balanceAfter = balanceBefore - effectiveCost;

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
            amount: effectiveCost,
            reason: "JOB_REQUEST_CREATED",
            notes: `New ticket created: ${createdTicket.title}`,
            metadata: {
              jobTypeId: jobType.id,
              unitCost: jobType.tokenCost,
              quantity,
              companyTicketNumber: createdTicket.companyTicketNumber,
              createdByUserId: requesterMember.userId,
            },
            balanceBefore,
            balanceAfter,
          },
        });
      }

      // 5) TicketAssignmentLog (AUTO_ASSIGN or FALLBACK)
      if (assignmentReason === "AUTO_ASSIGN" && createdTicket.designerId) {
        await tx.ticketAssignmentLog.create({
          data: {
            ticketId: createdTicket.id,
            designerId: createdTicket.designerId,
            reason: "AUTO_ASSIGN",
            metadata: {
              algorithm: "v3-skill-weighted-token-cost",
              source: "customer-ticket-create",
              autoAssignEffective: true,
              companyAutoAssignDefault,
              projectAutoAssignMode: projectAutoAssignMode ?? "INHERIT",
              skillFiltered,
              skilledDesignerCount,
              jobTypeId: jobType?.id ?? null,
            },
          },
        });
      } else if (assignmentReason === "FALLBACK") {
        await tx.ticketAssignmentLog.create({
          data: {
            ticketId: createdTicket.id,
            designerId: createdTicket.designerId ?? null,
            reason: "FALLBACK",
            metadata: {
              source: "customer-ticket-create",
              autoAssignEffective,
              companyAutoAssignDefault,
              projectAutoAssignMode: projectAutoAssignMode ?? "INHERIT",
              fallbackMode,
              skillFiltered,
              skilledDesignerCount,
              jobTypeId: jobType?.id ?? null,
              note:
                fallbackMode === "settings_disabled"
                  ? "Auto-assign disabled by company/project settings."
                  : fallbackMode === "no_skilled_designers"
                  ? "No designers with matching skill found; fell back to all designers."
                  : "No active designers available in pool at assignment time.",
            },
          },
        });
      }

      // 6) Attach tags (if any)
      if (rawTagIds.length > 0) {
        const validTags = await tx.ticketTag.findMany({
          where: { id: { in: rawTagIds }, companyId: company.id },
          select: { id: true },
        });
        if (validTags.length > 0) {
          await tx.ticketTagAssignment.createMany({
            data: validTags.map((t) => ({
              ticketId: createdTicket.id,
              tagId: t.id,
            })),
          });
        }
      }

      return createdTicket;
    });

    // Fire notification to assigned designer (fire-and-forget)
    if (ticket.designerId) {
      const code =
        ticket.project?.code && ticket.companyTicketNumber != null
          ? `${ticket.project.code}-${ticket.companyTicketNumber}`
          : ticket.companyTicketNumber != null
          ? `#${ticket.companyTicketNumber}`
          : ticket.id;
      createNotification({
        userId: ticket.designerId,
        type: "TICKET_ASSIGNED",
        title: "New ticket assigned",
        message: `${code} "${ticket.title}" was assigned to you`,
        ticketId: ticket.id,
        actorId: user.id,
      });
    }

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
