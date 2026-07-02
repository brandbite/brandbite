// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/route.ts
// @purpose: Get or update a single customer ticket (detail + status changes)
// @version: v1.1.1
// @status: active
// @lastUpdate: 2025-11-18
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TicketStatus, CompanyRole, LedgerDirection } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { buildTicketCode } from "@/lib/ticket-code";
import { insufficientTokensResponse } from "@/lib/errors/insufficient-tokens";
import {
  updateTicketStatusSchema,
  updateTicketFieldsSchema,
} from "@/lib/schemas/ticket-update.schemas";
import { isTagsEnabled } from "@/lib/feature-flags";

type RouteContext = {
  params: Promise<{
    ticketId: string;
  }>;
};

// Roles allowed to change ticket status from the board:
// - OWNER
// - PM
// - MEMBER
// (BILLING is finance-only, so it's excluded for now)
const ALLOWED_UPDATE_ROLES: CompanyRole[] = ["OWNER", "PM", "MEMBER"];

// -----------------------------------------------------------------------------
// GET /api/customer/tickets/[ticketId]
// Returns the details of a single ticket (scoped to the current company only)
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
      return NextResponse.json({ error: "User has no active company" }, { status: 400 });
    }

    const { ticketId } = await params;

    if (!ticketId) {
      return NextResponse.json({ error: "Missing ticketId in route params" }, { status: 400 });
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
        completedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        moodboards: {
          select: {
            id: true,
            title: true,
            _count: { select: { items: true } },
          },
          take: 5,
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found for current company" }, { status: 404 });
    }

    const code = buildTicketCode({
      projectCode: ticket.project?.code,
      companyTicketNumber: ticket.companyTicketNumber,
      ticketId: ticket.id,
    });

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
          creativeMode: ticket.creativeMode,
          jobType: ticket.jobType
            ? {
                id: ticket.jobType.id,
                name: ticket.jobType.name,
                tokenCost: ticket.jobType.tokenCost,
                creativePayoutTokens: ticket.jobType.creativePayoutTokens,
              }
            : null,
          // Tags hidden when the global TAGS_ENABLED flag is off — DB
          // rows are preserved, just stripped from the response so chips
          // don't render anywhere.
          tags: (await isTagsEnabled())
            ? ticket.tagAssignments.map((ta) => ({
                id: ta.tag.id,
                name: ta.tag.name,
                color: ta.tag.color,
              }))
            : [],
          createdBy: ticket.createdBy
            ? {
                id: ticket.createdBy.id,
                name: ticket.createdBy.name,
                email: ticket.createdBy.email,
              }
            : null,
          completedAt: ticket.completedAt?.toISOString() ?? null,
          completedBy: ticket.completedBy
            ? {
                id: ticket.completedBy.id,
                name: ticket.completedBy.name,
                email: ticket.completedBy.email,
              }
            : null,
          moodboards: (ticket.moodboards ?? []).map((mb: any) => ({
            id: mb.id,
            title: mb.title,
            itemCount: mb._count?.items ?? 0,
          })),
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[GET /api/customer/tickets/[ticketId]] error", error);
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH /api/customer/tickets/[ticketId]
// Body: { status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" }
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    // Only users with the CUSTOMER role can update tickets
    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can update tickets" }, { status: 403 });
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "User has no active company" }, { status: 400 });
    }

    if (!user.companyRole || !ALLOWED_UPDATE_ROLES.includes(user.companyRole as CompanyRole)) {
      return NextResponse.json(
        {
          error: "Only company owners, project managers or members can update tickets",
        },
        { status: 403 },
      );
    }

    const { ticketId } = await params;

    if (!ticketId) {
      return NextResponse.json({ error: "Missing ticketId in route params" }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Determine request type: status change vs field edit
    const hasStatusField = "status" in body;
    const EDITABLE_KEYS = [
      "title",
      "description",
      "priority",
      "dueDate",
      "projectId",
      "jobTypeId",
      "tagIds",
    ];
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
        companyId: true,
        quantity: true,
        tokenCostOverride: true,
        jobTypeId: true,
        jobType: { select: { tokenCost: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Ticket not found for current company" }, { status: 404 });
    }

    // -----------------------------------------------------------------------
    // Branch A: Status change (existing behavior — drag-and-drop on board)
    // -----------------------------------------------------------------------
    if (hasStatusField && !hasEditFields) {
      // A CANCELED ticket is terminal — no un-cancelling via a drag.
      // The refund already landed in the ledger; re-opening would
      // require an inverse debit which we don't have a workflow for.
      if (existing.status === "CANCELED") {
        return NextResponse.json(
          {
            error: "Cancelled tickets are read-only. Create a new ticket instead.",
          },
          { status: 409 },
        );
      }

      const statusResult = updateTicketStatusSchema.safeParse(body);
      if (!statusResult.success) {
        return NextResponse.json(
          { error: statusResult.error.issues[0]?.message ?? "Invalid status" },
          { status: 400 },
        );
      }

      const targetStatus = statusResult.data.status as TicketStatus;

      // Completion must go through /api/customer/tickets/status, which enforces
      // the board state machine (IN_REVIEW → DONE only), the OWNER/PM
      // permission, and — critically — the creative payout. This raw update
      // path writes no payout and no completedAt, so a DONE here would flip the
      // ticket done while silently leaving the creative unpaid. Refuse it.
      if (targetStatus === TicketStatus.DONE) {
        return NextResponse.json(
          { error: "Approve tickets from the board — this endpoint can't mark a ticket done." },
          { status: 400 },
        );
      }

      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: targetStatus,
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

      const fieldsResult = updateTicketFieldsSchema.safeParse(body);
      if (!fieldsResult.success) {
        return NextResponse.json(
          { error: fieldsResult.error.issues[0]?.message ?? "Validation failed" },
          { status: 400 },
        );
      }
      const fields = fieldsResult.data;

      const updateData: Record<string, unknown> = {};

      if (fields.title !== undefined) updateData.title = fields.title;
      if (fields.description !== undefined) updateData.description = fields.description;
      if (fields.priority !== undefined) updateData.priority = fields.priority;
      if (fields.dueDate !== undefined) updateData.dueDate = fields.dueDate ?? null;

      // projectId — DB lookup stays inline
      if (fields.projectId !== undefined) {
        if (fields.projectId === null) {
          updateData.projectId = null;
        } else {
          const project = await prisma.project.findFirst({
            where: {
              id: fields.projectId,
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

      // jobTypeId — DB lookup stays inline. Changing the job type on a TODO
      // ticket changes what the ticket costs, so we must reconcile the
      // company ledger (see costDelta below) — otherwise the original charge
      // and the eventual cancel/complete cost diverge.
      let newJobTypeCost: number | null = null;
      if (fields.jobTypeId !== undefined) {
        if (fields.jobTypeId === null) {
          // Model 2: every ticket must carry a job type (that's how it's
          // priced and how the creative is paid). Clearing it would strand
          // the original charge with nothing to refund on cancel.
          return NextResponse.json({ error: "A job type is required." }, { status: 400 });
        }
        const jt = await prisma.jobType.findUnique({
          where: { id: fields.jobTypeId },
          select: { id: true, tokenCost: true },
        });
        if (!jt) {
          return NextResponse.json({ error: "Job type not found" }, { status: 400 });
        }
        updateData.jobTypeId = jt.id;
        newJobTypeCost = jt.tokenCost;
      }

      // Compute the token-cost delta if the job type actually changed. An
      // explicit tokenCostOverride pins the effective cost regardless of job
      // type, so a change is a no-op in that case (delta = 0).
      let costDelta = 0;
      const jobTypeActuallyChanged =
        newJobTypeCost !== null && fields.jobTypeId !== existing.jobTypeId;
      if (jobTypeActuallyChanged && existing.tokenCostOverride == null) {
        const oldEffective = (existing.jobType?.tokenCost ?? 0) * existing.quantity;
        const newEffective = newJobTypeCost! * existing.quantity;
        costDelta = newEffective - oldEffective;
      }

      // If the new job type costs more, make sure the company can afford the
      // difference before we open the write transaction (friendly 402).
      if (costDelta > 0) {
        const company = await prisma.company.findUniqueOrThrow({
          where: { id: existing.companyId! },
          select: { tokenBalance: true },
        });
        if (company.tokenBalance < costDelta) {
          return insufficientTokensResponse({
            required: costDelta,
            balance: company.tokenBalance,
            action: "job type change",
          });
        }
      }

      // tagIds — replace all tag assignments. When the global flag is
      // off, silently ignore any tagIds the client sent. Existing
      // assignments stay untouched (no destructive write) so the toggle
      // is fully reversible.
      const tagsEnabledForUpdate = await isTagsEnabled();
      let newTagIds: string[] | null = null;
      if (fields.tagIds !== undefined && tagsEnabledForUpdate) {
        newTagIds = fields.tagIds;

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
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
      }

      // Use transaction so ticket update + tag replacement are atomic
      const updated = await prisma.$transaction(async (tx) => {
        // Update scalar fields (if any)
        const ticket =
          Object.keys(updateData).length > 0
            ? await tx.ticket.update({
                where: { id: ticketId },
                data: updateData,
              })
            : await tx.ticket.findUniqueOrThrow({
                where: { id: ticketId },
              });

        // Reconcile the company ledger when the job type changed the cost.
        // Mirrors create-ticket's guarded decrement so a concurrent debit
        // can't drive the balance negative on the extra charge.
        if (costDelta !== 0) {
          if (costDelta > 0) {
            const charged = await tx.company.updateMany({
              where: { id: existing.companyId!, tokenBalance: { gte: costDelta } },
              data: { tokenBalance: { decrement: costDelta } },
            });
            if (charged.count === 0) {
              throw new Error("INSUFFICIENT_ADJUSTMENT");
            }
          } else {
            await tx.company.update({
              where: { id: existing.companyId! },
              data: { tokenBalance: { increment: -costDelta } },
            });
          }

          const companyRow = await tx.company.findUniqueOrThrow({
            where: { id: existing.companyId! },
            select: { tokenBalance: true },
          });
          const balanceAfter = companyRow.tokenBalance;
          // A positive delta was a DEBIT (balance fell by delta); a negative
          // delta was a CREDIT (balance rose by |delta|). Either way the
          // pre-change balance is balanceAfter + costDelta.
          const balanceBefore = balanceAfter + costDelta;

          await tx.tokenLedger.create({
            data: {
              companyId: existing.companyId!,
              ticketId,
              direction: costDelta > 0 ? LedgerDirection.DEBIT : LedgerDirection.CREDIT,
              amount: Math.abs(costDelta),
              reason: costDelta > 0 ? "JOB_REQUEST_ADJUSTMENT" : "REFUND",
              notes: `Job type changed on ticket ${ticketId}`,
              metadata: {
                changedByUserId: user.id,
                previousJobTypeId: existing.jobTypeId,
                newJobTypeId: fields.jobTypeId ?? null,
              },
              balanceBefore,
              balanceAfter,
            },
          });
        }

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

      const code = buildTicketCode({
        projectCode: updated.project?.code,
        companyTicketNumber: updated.companyTicketNumber,
        ticketId: updated.id,
      });

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
            creativeMode: updated.creativeMode,
            tags: tagsEnabledForUpdate
              ? updated.tagAssignments.map((ta) => ({
                  id: ta.tag.id,
                  name: ta.tag.name,
                  color: ta.tag.color,
                }))
              : [],
          },
        },
        { status: 200 },
      );
    }

    // Neither status nor editable fields
    return NextResponse.json({ error: "No recognized fields in request body" }, { status: 400 });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    if ((error as Error)?.message === "INSUFFICIENT_ADJUSTMENT") {
      // Lost the race on the extra charge for a costlier job type.
      return NextResponse.json(
        { error: "Not enough tokens to change to a higher-cost job type. Please refresh." },
        { status: 402 },
      );
    }

    console.error("[PATCH /api/customer/tickets/[ticketId]] error", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
