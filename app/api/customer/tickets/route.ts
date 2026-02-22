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
import { isCreativePaused } from "@/lib/creative-availability";
import { parseBody } from "@/lib/schemas/helpers";
import { createTicketSchema } from "@/lib/schemas/ticket.schemas";
import { buildTicketCode } from "@/lib/ticket-code";

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
      return NextResponse.json({ error: "User has no active company" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.activeCompanyId },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found for current user" }, { status: 404 });
    }

    // ── Parse query params ──────────────────────────────────────────────
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const status = url.searchParams.get("status") || "";
    const projectId = url.searchParams.get("project") || "";
    const priority = url.searchParams.get("priority") || "";
    const tagId = url.searchParams.get("tag") || "";
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortDir = url.searchParams.get("sortDir") || "desc";
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    // ── Build where clause ──────────────────────────────────────────────
    const where: any = { companyId: company.id };

    if (status && ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].includes(status)) {
      where.status = status;
    }

    if (priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) {
      where.priority = priority;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (tagId) {
      where.tagAssignments = { some: { tagId } };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { project: { name: { contains: search, mode: "insensitive" } } },
        { jobType: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // ── Build orderBy ───────────────────────────────────────────────────
    const dir = sortDir === "asc" ? "asc" : "desc";
    const validSortFields: Record<string, any> = {
      createdAt: { createdAt: dir },
      dueDate: { dueDate: dir },
      status: { status: dir },
      priority: { priority: dir },
      title: { title: dir },
    };
    const orderBy = validSortFields[sortBy] || { createdAt: "desc" };

    // ── Execute query + count in parallel ───────────────────────────────
    const [tickets, totalCount] = await Promise.all([
      prisma.ticket.findMany({
        where,
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
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.ticket.count({ where }),
    ]);

    const payload = tickets.map((t) => {
      const code = buildTicketCode({
        projectCode: t.project?.code,
        companyTicketNumber: t.companyTicketNumber,
        ticketId: t.id,
      });

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
        isAssigned: t.creativeId != null,
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
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.tickets] GET error", error);
    return NextResponse.json({ error: "Failed to load customer tickets" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST: create new ticket for current customer's company + debit tokens
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can create tickets" }, { status: 403 });
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "User has no active company" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.activeCompanyId },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found for current user" }, { status: 404 });
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

    const parsed = await parseBody(req, createTicketSchema);
    if (!parsed.success) return parsed.response;
    const {
      title,
      description,
      projectId,
      jobTypeId,
      quantity,
      priority: selectedPriority,
      dueDate: parsedDueDate,
      tagIds: rawTagIds,
    } = parsed.data;

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
    let project: { id: string; autoAssignMode: AutoAssignMode } | null = null;

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
        return NextResponse.json({ error: "Project not found for this company" }, { status: 400 });
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
        return NextResponse.json({ error: "Job type not found" }, { status: 400 });
      }
    }

    // If there is a job type, make sure the company has enough tokens
    // Effective cost accounts for quantity multiplier.
    const effectiveCost = jobType ? jobType.tokenCost * quantity : 0;

    if (jobType && company.tokenBalance < effectiveCost) {
      return NextResponse.json({ error: "Not enough tokens for this job type" }, { status: 400 });
    }

    // -------------------------------------------------------------------------
    // Auto-assign effective flag (company + project)
    // -------------------------------------------------------------------------
    const companyAutoAssignDefault = company.autoAssignDefaultEnabled ?? false;
    const projectAutoAssignMode = project?.autoAssignMode ?? null;

    const autoAssignEffective = isAutoAssignEnabled(
      companyAutoAssignDefault,
      projectAutoAssignMode,
    );

    // -------------------------------------------------------------------------
    // Transaction:
    //  - Compute next companyTicketNumber
    //  - Auto-assign creative based on effective flag (or fallback/unassigned)
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

      const nextCompanyTicketNumber = (lastTicket?.companyTicketNumber ?? 100) + 1;

      // 2) Decide creative assignment based on settings
      let assignedCreativeId: string | null = null;
      let assignmentReason: "AUTO_ASSIGN" | "FALLBACK" | null = null;
      let fallbackMode: "settings_disabled" | "no_creatives" | "no_skilled_creatives" | null = null;
      let skillFiltered = false;
      let skilledCreativeCount = 0;
      let pausedCreativeCount = 0;

      if (autoAssignEffective) {
        // auto-assign açık: skill-filtered + load-based algoritma
        let creatives: { id: string }[];

        if (jobType) {
          // Find creatives who have this job type as a skill
          const skilledCreatives = await tx.creativeSkill.findMany({
            where: { jobTypeId: jobType.id },
            select: { creativeId: true },
          });
          creatives = skilledCreatives.map((s) => ({ id: s.creativeId }));
          skilledCreativeCount = creatives.length;
          skillFiltered = true;

          // No skilled creatives → leave unassigned for admin to handle
          if (creatives.length === 0) {
            fallbackMode = "no_skilled_creatives";
          }
        } else {
          // No job type specified: use all creatives
          creatives = await tx.userAccount.findMany({
            where: { role: UserRole.DESIGNER },
            select: { id: true },
          });
        }

        // Filter out paused creatives
        if (creatives.length > 0) {
          const creativePauseStates = await tx.userAccount.findMany({
            where: { id: { in: creatives.map((d) => d.id) } },
            select: { id: true, isPaused: true, pauseExpiresAt: true },
          });

          const pausedIds = new Set(
            creativePauseStates.filter((d) => isCreativePaused(d)).map((d) => d.id),
          );

          pausedCreativeCount = pausedIds.size;
          creatives = creatives.filter((d) => !pausedIds.has(d.id));
        }

        if (creatives.length > 0) {
          const creativeIds = creatives.map((d) => d.id);

          // Current open tickets per creative with jobType + priority
          const openTickets = await tx.ticket.findMany({
            where: {
              creativeId: { in: creativeIds },
              status: {
                in: [TicketStatus.TODO, TicketStatus.IN_PROGRESS, TicketStatus.IN_REVIEW],
              },
            },
            select: {
              id: true,
              creativeId: true,
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

          const loadByCreative = new Map<string, number>();
          for (const id of creativeIds) {
            loadByCreative.set(id, 0);
          }

          for (const t of openTickets) {
            if (!t.creativeId) continue;
            if (!loadByCreative.has(t.creativeId)) continue;

            const weight = priorityWeights[t.priority as TicketPriority];
            const tokenCost = (t.jobType?.tokenCost ?? 1) * (t.quantity ?? 1);
            const delta = weight * tokenCost;

            loadByCreative.set(t.creativeId, (loadByCreative.get(t.creativeId) ?? 0) + delta);
          }

          assignedCreativeId = creativeIds.reduce(
            (bestId: string | null, currentId: string) => {
              if (!bestId) return currentId;
              const bestLoad = loadByCreative.get(bestId) ?? 0;
              const currentLoad = loadByCreative.get(currentId) ?? 0;
              if (currentLoad < bestLoad) return currentId;
              return bestId;
            },
            null as string | null,
          );

          assignmentReason = "AUTO_ASSIGN";
        } else {
          // Auto-assign açık ama hiç creative yok → fallback
          assignedCreativeId = null;
          assignmentReason = "FALLBACK";
          // Preserve "no_skilled_creatives" if already set; otherwise "no_creatives"
          if (!fallbackMode) fallbackMode = "no_creatives";
        }
      } else {
        // Auto-assign ayarlardan kapalı → fallback/unassigned
        assignedCreativeId = null;
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
          creativeId: assignedCreativeId,
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
      if (assignmentReason === "AUTO_ASSIGN" && createdTicket.creativeId) {
        await tx.ticketAssignmentLog.create({
          data: {
            ticketId: createdTicket.id,
            creativeId: createdTicket.creativeId,
            reason: "AUTO_ASSIGN",
            metadata: {
              algorithm: "v3-skill-weighted-token-cost",
              source: "customer-ticket-create",
              autoAssignEffective: true,
              companyAutoAssignDefault,
              projectAutoAssignMode: projectAutoAssignMode ?? "INHERIT",
              skillFiltered,
              skilledCreativeCount,
              pausedCreativeCount,
              jobTypeId: jobType?.id ?? null,
            },
          },
        });
      } else if (assignmentReason === "FALLBACK") {
        await tx.ticketAssignmentLog.create({
          data: {
            ticketId: createdTicket.id,
            creativeId: createdTicket.creativeId ?? null,
            reason: "FALLBACK",
            metadata: {
              source: "customer-ticket-create",
              autoAssignEffective,
              companyAutoAssignDefault,
              projectAutoAssignMode: projectAutoAssignMode ?? "INHERIT",
              fallbackMode,
              skillFiltered,
              skilledCreativeCount,
              pausedCreativeCount,
              jobTypeId: jobType?.id ?? null,
              note:
                fallbackMode === "settings_disabled"
                  ? "Auto-assign disabled by company/project settings."
                  : fallbackMode === "no_skilled_creatives"
                    ? "No creatives with matching skill found; ticket left unassigned for admin."
                    : "No active creatives available in pool at assignment time.",
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

    // Fire notification to assigned creative (fire-and-forget)
    if (ticket.creativeId) {
      const code = buildTicketCode({
        projectCode: ticket.project?.code,
        companyTicketNumber: ticket.companyTicketNumber,
        ticketId: ticket.id,
      });
      createNotification({
        userId: ticket.creativeId,
        type: "TICKET_ASSIGNED",
        title: "New ticket assigned",
        message: `${code} "${ticket.title}" was assigned to you`,
        ticketId: ticket.id,
        actorId: user.id,
      });
    }

    const code = buildTicketCode({
      projectCode: ticket.project?.code,
      companyTicketNumber: ticket.companyTicketNumber,
      ticketId: ticket.id,
    });

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
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.tickets] POST error", error);
    return NextResponse.json({ error: "Failed to create customer ticket" }, { status: 500 });
  }
}
