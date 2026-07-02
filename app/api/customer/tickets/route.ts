// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/route.ts
// @purpose: Customer-facing ticket list & creation API (session-based company,
//           with company/project-based auto-assign configuration)
// @version: v1.8.0
// @status: active
// @lastUpdate: 2025-11-20
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { notifySiteOwnersOfEvent } from "@/lib/admin-event-email";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { insufficientTokensResponse } from "@/lib/errors/insufficient-tokens";
import { canCreateTickets } from "@/lib/permissions/companyRoles";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { resolveAssetUrl } from "@/lib/r2";
import { parseBody } from "@/lib/schemas/helpers";
import { createTicketSchema } from "@/lib/schemas/ticket.schemas";
import { buildTicketCode } from "@/lib/ticket-code";
import { createCustomerTicket } from "@/lib/tickets/create-ticket";
import { getAiTicketsMode, isAiTicketsAllowed, isTagsEnabled } from "@/lib/feature-flags";
import { isSiteAdminRole } from "@/lib/roles";

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

    // Read the global tags feature flag once per request. When off, we
    // both ignore the ?tag= filter and strip tag arrays from the response
    // — existing TicketTagAssignment rows stay untouched in the DB so the
    // toggle is fully reversible.
    const tagsEnabled = await isTagsEnabled();

    // ── Build where clause ──────────────────────────────────────────────
    const where: any = { companyId: company.id };

    if (status && ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].includes(status)) {
      where.status = status;
    } else {
      // No explicit status filter → exclude CANCELED rows from the
      // board/list by default. Customers can still load a cancelled
      // ticket directly via /tickets/[ticketId] (the detail endpoint
      // doesn't apply this filter) so the row + REFUND ledger entry
      // remain inspectable from a deep link.
      where.status = { not: "CANCELED" };
    }

    if (priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) {
      where.priority = priority;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (tagId && tagsEnabled) {
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
              storageKey: true,
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

    const payload = await Promise.all(
      tickets.map(async (t) => {
        const code = buildTicketCode({
          projectCode: t.project?.code,
          companyTicketNumber: t.companyTicketNumber,
          ticketId: t.id,
        });

        const asset = t.assets?.[0];
        const thumbnailUrl = asset ? await resolveAssetUrl(asset.storageKey, asset.url) : null;

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
          thumbnailUrl,
          thumbnailAssetId: asset?.id ?? null,
          tags: tagsEnabled
            ? t.tagAssignments.map((ta: any) => ({
                id: ta.tag.id,
                name: ta.tag.name,
                color: ta.tag.color,
              }))
            : [],
        };
      }),
    );

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

    // Guard "Work with AI" against the feature flag. Even if the form is
    // bypassed, a customer can't force AI mode while it's off (or test-only,
    // which is restricted to site admins).
    if (parsed.data.creativeMode === "AI") {
      const aiMode = await getAiTicketsMode();
      if (!isAiTicketsAllowed(aiMode, isSiteAdminRole(user.role))) {
        return NextResponse.json(
          { error: "AI-generated tickets aren't available yet." },
          { status: 403 },
        );
      }
    }

    // When the tag system is globally disabled, drop any tagIds the client
    // sent — even a stale form shouldn't be able to attach tags while the
    // feature is off. The form already hides the picker, so this is just
    // belt-and-braces against tampered requests.
    const tagsEnabledForCreate = await isTagsEnabled();

    const outcome = await createCustomerTicket({
      actorUserId: user.id,
      companyId: user.activeCompanyId,
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        projectId: parsed.data.projectId,
        jobTypeId: parsed.data.jobTypeId,
        quantity: parsed.data.quantity,
        priority: parsed.data.priority,
        dueDate: parsed.data.dueDate,
        tagIds: tagsEnabledForCreate ? parsed.data.tagIds : [],
        creativeMode: parsed.data.creativeMode,
        moodboardId: parsed.data.moodboardId,
      },
    });

    if (!outcome.success) {
      if (outcome.code === "COMPANY_NOT_FOUND") {
        return NextResponse.json({ error: outcome.message }, { status: 404 });
      }
      if (outcome.code === "INSUFFICIENT_TOKENS") {
        return insufficientTokensResponse({
          required: outcome.required,
          balance: outcome.balance,
          action: "this job",
        });
      }
      // NO_REQUESTER, PROJECT_NOT_FOUND, JOB_TYPE_NOT_FOUND all map to 400.
      return NextResponse.json({ error: outcome.message }, { status: 400 });
    }

    const ticket = outcome.ticket;

    // Fire-and-forget assignment notification. Kept in the route so the
    // service stays free of I/O beyond the DB transaction.
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

    const ticketCode = buildTicketCode({
      projectCode: ticket.project?.code,
      companyTicketNumber: ticket.companyTicketNumber,
      ticketId: ticket.id,
    });

    // Best-effort SITE_OWNER notification — "$company opened a new task".
    // Looking up the company name with a single select keeps the helper
    // signature small (it doesn't need the full company row). Wrapped
    // in its own try/catch so a notification failure can't break ticket
    // creation.
    try {
      const company = await prisma.company.findUnique({
        where: { id: user.activeCompanyId },
        select: { name: true },
      });
      void notifySiteOwnersOfEvent({
        kind: "NEW_TICKET",
        ticketId: ticket.id,
        ticketCode,
        title: ticket.title,
        companyName: company?.name ?? "(unknown company)",
        createdByEmail: user.email,
        jobTypeName: ticket.jobType?.name ?? null,
      });
    } catch (err) {
      console.error("[customer/tickets POST] event-email lookup failed", err);
    }

    return NextResponse.json(
      {
        ticket: {
          id: ticket.id,
          code: ticketCode,
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
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.tickets] POST error", error);
    return NextResponse.json({ error: "Failed to create customer ticket" }, { status: 500 });
  }
}
