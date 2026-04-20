// -----------------------------------------------------------------------------
// @file: lib/tickets/create-ticket.ts
// @purpose: Domain service for "customer creates a ticket". Owns the
//           whole transaction: companyTicketNumber allocation, skill +
//           load-based auto-assign with rating tie-breaker, ticket create,
//           token debit + ledger, TicketAssignmentLog, tag attach, moodboard
//           link.
//
// Extracted from app/api/customer/tickets/route.ts (B3). The route now
// does auth + zod parse + this call + response mapping only.
//
// Structured failures are returned as a tagged union so the route can map
// them to HTTP responses without re-implementing the business rules.
// Unknown errors (DB outage, etc.) still throw.
// -----------------------------------------------------------------------------

import {
  AutoAssignMode,
  CompanyRole,
  LedgerDirection,
  TicketPriority,
  TicketStatus,
  TicketCreativeMode,
  UserRole,
} from "@prisma/client";

import { isCreativePaused } from "@/lib/creative-availability";
import { prisma } from "@/lib/prisma";
import { getCreativeRatingSummaries } from "@/lib/ratings/creative-ratings";
import { isAutoAssignEnabled, selectCreativeByLoadThenRating } from "@/lib/tickets/auto-assign";

export type CreateTicketInput = {
  /** The authenticated user making the request (for audit attribution). */
  actorUserId: string;
  companyId: string;
  data: {
    title: string;
    description: string | null | undefined;
    projectId: string | null | undefined;
    jobTypeId: string | null | undefined;
    quantity: number;
    priority: TicketPriority;
    dueDate: Date | null | undefined;
    tagIds: string[];
    creativeMode: TicketCreativeMode;
    moodboardId: string | null | undefined;
  };
};

export type CreatedTicket = {
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  creativeId: string | null;
  companyTicketNumber: number | null;
  createdAt: Date;
  project: { id: string; name: string; code: string | null } | null;
  jobType: { id: string; name: string } | null;
};

export type CreateTicketSuccess = {
  success: true;
  ticket: CreatedTicket;
};

export type CreateTicketFailure =
  | { success: false; code: "COMPANY_NOT_FOUND"; message: string }
  | { success: false; code: "NO_REQUESTER"; message: string }
  | { success: false; code: "PROJECT_NOT_FOUND"; message: string }
  | { success: false; code: "JOB_TYPE_NOT_FOUND"; message: string }
  | {
      success: false;
      code: "INSUFFICIENT_TOKENS";
      message: string;
      required: number;
      balance: number;
    };

export type CreateTicketResult = CreateTicketSuccess | CreateTicketFailure;

/**
 * Create a customer ticket end-to-end. See the file header for what this owns.
 *
 * The auto-assign block is kept inline rather than further extracted because
 * it mutates several pieces of transaction state that end up in the ticket
 * row + TicketAssignmentLog metadata; pulling it out requires either a very
 * wide return type or a second trip through the same data.
 */
export async function createCustomerTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
  const { actorUserId, companyId, data } = input;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return { success: false, code: "COMPANY_NOT_FOUND", message: "Company not found." };
  }

  // Pick a default "requester" from company members (PM first, else OWNER).
  const requesterMember = await prisma.companyMember.findFirst({
    where: {
      companyId: company.id,
      roleInCompany: { in: [CompanyRole.PM, CompanyRole.OWNER] },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!requesterMember) {
    return {
      success: false,
      code: "NO_REQUESTER",
      message: "No eligible company member found to assign as requester.",
    };
  }

  // Optional project validation (+ autoAssignMode for the decision below).
  let project: { id: string; autoAssignMode: AutoAssignMode } | null = null;
  if (data.projectId) {
    project = await prisma.project.findFirst({
      where: { id: data.projectId, companyId: company.id },
      select: { id: true, autoAssignMode: true },
    });
    if (!project) {
      return {
        success: false,
        code: "PROJECT_NOT_FOUND",
        message: "Project not found for this company.",
      };
    }
  }

  // Optional jobType validation (+ tokenCost for balance check).
  let jobType: { id: string; tokenCost: number } | null = null;
  if (data.jobTypeId) {
    jobType = await prisma.jobType.findUnique({
      where: { id: data.jobTypeId },
      select: { id: true, tokenCost: true },
    });
    if (!jobType) {
      return { success: false, code: "JOB_TYPE_NOT_FOUND", message: "Job type not found." };
    }
  }

  const effectiveCost = jobType ? jobType.tokenCost * data.quantity : 0;
  if (jobType && company.tokenBalance < effectiveCost) {
    return {
      success: false,
      code: "INSUFFICIENT_TOKENS",
      message: "Insufficient token balance.",
      required: effectiveCost,
      balance: company.tokenBalance,
    };
  }

  const isAiMode = data.creativeMode === "AI";
  const companyAutoAssignDefault = company.autoAssignDefaultEnabled ?? false;
  const projectAutoAssignMode = project?.autoAssignMode ?? null;
  const autoAssignEffective = isAutoAssignEnabled(companyAutoAssignDefault, projectAutoAssignMode);

  const created = await prisma.$transaction(async (tx) => {
    // 1) Next companyTicketNumber
    const lastTicket = await tx.ticket.findFirst({
      where: { companyId: company.id },
      orderBy: { companyTicketNumber: "desc" },
      select: { companyTicketNumber: true },
    });
    const nextCompanyTicketNumber = (lastTicket?.companyTicketNumber ?? 100) + 1;

    // 2) Creative assignment (AI mode skips, auto-assign obeys skill filter
    //    + load + rating tie-breaker, otherwise FALLBACK unassigned).
    let assignedCreativeId: string | null = null;
    let assignmentReason: "AUTO_ASSIGN" | "FALLBACK" | null = null;
    let fallbackMode: "settings_disabled" | "no_creatives" | "no_skilled_creatives" | null = null;
    let skillFiltered = false;
    let skilledCreativeCount = 0;
    let pausedCreativeCount = 0;

    if (isAiMode) {
      assignedCreativeId = null;
    } else if (autoAssignEffective) {
      let creatives: { id: string }[];
      if (jobType) {
        const skilled = await tx.creativeSkill.findMany({
          where: { jobTypeId: jobType.id },
          select: { creativeId: true },
        });
        creatives = skilled.map((s) => ({ id: s.creativeId }));
        skilledCreativeCount = creatives.length;
        skillFiltered = true;
        if (creatives.length === 0) fallbackMode = "no_skilled_creatives";
      } else {
        creatives = await tx.userAccount.findMany({
          where: { role: UserRole.DESIGNER },
          select: { id: true },
        });
      }

      if (creatives.length > 0) {
        const pauseStates = await tx.userAccount.findMany({
          where: { id: { in: creatives.map((d) => d.id) } },
          select: { id: true, isPaused: true, pauseExpiresAt: true },
        });
        const pausedIds = new Set(pauseStates.filter((d) => isCreativePaused(d)).map((d) => d.id));
        pausedCreativeCount = pausedIds.size;
        creatives = creatives.filter((d) => !pausedIds.has(d.id));
      }

      if (creatives.length > 0) {
        const creativeIds = creatives.map((d) => d.id);

        const openTickets = await tx.ticket.findMany({
          where: {
            creativeId: { in: creativeIds },
            status: { in: [TicketStatus.TODO, TicketStatus.IN_PROGRESS, TicketStatus.IN_REVIEW] },
          },
          select: {
            id: true,
            creativeId: true,
            priority: true,
            quantity: true,
            jobType: { select: { tokenCost: true } },
          },
        });

        const priorityWeights: Record<TicketPriority, number> = {
          LOW: 1,
          MEDIUM: 2,
          HIGH: 3,
          URGENT: 4,
        };

        const loadByCreative = new Map<string, number>();
        for (const id of creativeIds) loadByCreative.set(id, 0);
        for (const t of openTickets) {
          if (!t.creativeId) continue;
          if (!loadByCreative.has(t.creativeId)) continue;
          const weight = priorityWeights[t.priority as TicketPriority];
          const cost = (t.jobType?.tokenCost ?? 1) * (t.quantity ?? 1);
          loadByCreative.set(t.creativeId, (loadByCreative.get(t.creativeId) ?? 0) + weight * cost);
        }

        const ratingByCreative = await getCreativeRatingSummaries(creativeIds);

        assignedCreativeId = selectCreativeByLoadThenRating({
          candidateIds: creativeIds,
          loadByCreative,
          ratingByCreative,
        });
        assignmentReason = "AUTO_ASSIGN";
      } else {
        assignmentReason = "FALLBACK";
        if (!fallbackMode) fallbackMode = "no_creatives";
      }
    } else {
      assignmentReason = "FALLBACK";
      fallbackMode = "settings_disabled";
    }

    // 3) Create ticket
    const createdTicket = await tx.ticket.create({
      data: {
        title: data.title,
        description: data.description || null,
        status: isAiMode ? TicketStatus.IN_PROGRESS : TicketStatus.TODO,
        priority: data.priority,
        dueDate: data.dueDate ?? null,
        companyId: company.id,
        projectId: project?.id ?? null,
        createdById: requesterMember.userId,
        jobTypeId: jobType?.id ?? null,
        quantity: data.quantity,
        companyTicketNumber: nextCompanyTicketNumber,
        creativeId: assignedCreativeId,
        creativeMode: data.creativeMode,
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        jobType: { select: { id: true, name: true } },
      },
    });

    // 4) Company token debit + ledger entry
    if (jobType) {
      const balanceBefore = company.tokenBalance;
      const balanceAfter = balanceBefore - effectiveCost;

      await tx.company.update({
        where: { id: company.id },
        data: { tokenBalance: balanceAfter },
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
            quantity: data.quantity,
            companyTicketNumber: createdTicket.companyTicketNumber,
            createdByUserId: requesterMember.userId,
          },
          balanceBefore,
          balanceAfter,
        },
      });
    }

    // 5) TicketAssignmentLog (AUTO_ASSIGN / FALLBACK)
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

    // 6) Tag assignments (company-scoped)
    if (data.tagIds.length > 0) {
      const validTags = await tx.ticketTag.findMany({
        where: { id: { in: data.tagIds }, companyId: company.id },
        select: { id: true },
      });
      if (validTags.length > 0) {
        await tx.ticketTagAssignment.createMany({
          data: validTags.map((t) => ({ ticketId: createdTicket.id, tagId: t.id })),
        });
      }
    }

    // 7) Link moodboard (if provided)
    if (data.moodboardId) {
      await tx.moodboard.updateMany({
        where: { id: data.moodboardId, companyId: company.id, ticketId: null },
        data: { ticketId: createdTicket.id },
      });
    }

    // silence unused — kept named for future audit
    void actorUserId;

    return createdTicket;
  });

  return {
    success: true,
    ticket: {
      id: created.id,
      title: created.title,
      status: created.status,
      priority: created.priority,
      creativeId: created.creativeId,
      companyTicketNumber: created.companyTicketNumber,
      createdAt: created.createdAt,
      project: created.project
        ? { id: created.project.id, name: created.project.name, code: created.project.code }
        : null,
      jobType: created.jobType ? { id: created.jobType.id, name: created.jobType.name } : null,
    },
  };
}
