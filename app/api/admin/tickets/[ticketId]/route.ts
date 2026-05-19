// -----------------------------------------------------------------------------
// @file: app/api/admin/tickets/[ticketId]/route.ts
// @purpose: Per-ticket detail aggregation for the admin drill-down. Pulls
//           everything an operator might want when investigating one
//           specific ticket — full brief + project + customer + creative +
//           every revision with its assets + comments + assignment history
//           + audit log entries — in a single response so the page renders
//           without a half-dozen sub-fetches.
//
//           Read-only. Edits still flow through the customer / creative
//           routes so the existing permission posture (only the assigned
//           creative can submit a revision, only the ticket owner can
//           approve, etc.) stays the single source of truth. This page is
//           investigative context, not an action surface.
//
//           Auth: SITE_ADMIN+ to match every other admin list endpoint.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAssetUrl } from "@/lib/r2";
import { isSiteAdminRole } from "@/lib/roles";
import { buildTicketCode } from "@/lib/ticket-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const caller = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ticketId } = await params;
    if (!ticketId) {
      return NextResponse.json({ error: "ticketId required" }, { status: 400 });
    }

    // ---- core ticket + the rows we always want inlined --------------
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, email: true, name: true, role: true } },
        creative: { select: { id: true, email: true, name: true, role: true } },
        completedBy: { select: { id: true, email: true, name: true } },
        jobType: { select: { id: true, name: true, tokenCost: true } },
        tagAssignments: {
          select: { tag: { select: { id: true, name: true, color: true } } },
        },
      },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // ---- parallel reads for the meatier collections -----------------
    const [revisions, comments, briefAssets, assignmentLogs, auditLogs] = await Promise.all([
      prisma.ticketRevision.findMany({
        where: { ticketId },
        orderBy: { version: "asc" },
        include: {
          submittedByCreative: { select: { id: true, email: true, name: true } },
          feedbackByCustomer: { select: { id: true, email: true, name: true } },
          assets: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              kind: true,
              storageKey: true,
              url: true,
              mimeType: true,
              bytes: true,
              width: true,
              height: true,
              originalName: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.ticketComment.findMany({
        where: { ticketId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, email: true, name: true, role: true } },
        },
      }),
      prisma.asset.findMany({
        where: { ticketId, kind: "BRIEF_INPUT" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          storageKey: true,
          url: true,
          mimeType: true,
          bytes: true,
          width: true,
          height: true,
          originalName: true,
          createdAt: true,
        },
      }),
      prisma.ticketAssignmentLog.findMany({
        where: { ticketId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          creativeId: true,
          creative: { select: { email: true, name: true } },
          reason: true,
          notes: true,
          metadata: true,
          createdAt: true,
        },
      }),
      // Admin actions whose target is this ticket — e.g. financial
      // override, manual reassign. Kept small (10) since the page is
      // investigative and the full audit log has its own filter.
      prisma.adminActionLog.findMany({
        where: { targetType: "Ticket", targetId: ticketId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          action: true,
          outcome: true,
          actorEmail: true,
          actorRole: true,
          metadata: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
    ]);

    // ---- resolve displayable URLs for every asset -------------------
    // We never persist presigned URLs — they expire. Resolve on demand
    // here. resolveAssetUrl prefers the stable public R2 URL when
    // R2_PUBLIC_BASE_URL is configured and falls back to a short-lived
    // presigned GET otherwise.
    const briefAssetsWithUrls = await Promise.all(
      briefAssets.map(async (a) => ({
        ...a,
        url: await resolveAssetUrl(a.storageKey, a.url),
        bytes: a.bytes,
        createdAt: a.createdAt.toISOString(),
      })),
    );
    const revisionsWithUrls = await Promise.all(
      revisions.map(async (r) => ({
        id: r.id,
        version: r.version,
        submittedAt: r.submittedAt.toISOString(),
        feedbackAt: r.feedbackAt?.toISOString() ?? null,
        creativeMessage: r.creativeMessage,
        feedbackMessage: r.feedbackMessage,
        submittedByCreative: r.submittedByCreative,
        feedbackByCustomer: r.feedbackByCustomer,
        assets: await Promise.all(
          r.assets.map(async (a) => ({
            id: a.id,
            kind: a.kind,
            url: await resolveAssetUrl(a.storageKey, a.url),
            mimeType: a.mimeType,
            bytes: a.bytes,
            width: a.width,
            height: a.height,
            originalName: a.originalName,
            createdAt: a.createdAt.toISOString(),
          })),
        ),
      })),
    );

    // ---- token-cost math --------------------------------------------
    // Mirror the calculation that runs at ticket-create time so the
    // admin sees the same number the customer was charged + any
    // override applied.
    const baseCost = (ticket.jobType?.tokenCost ?? 0) * ticket.quantity;
    const effectiveCost = ticket.tokenCostOverride ?? baseCost;

    const ticketCode = buildTicketCode({
      projectCode: ticket.project?.code,
      companyTicketNumber: ticket.companyTicketNumber,
      ticketId: ticket.id,
    });

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        code: ticketCode,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        creativeMode: ticket.creativeMode,
        dueDate: ticket.dueDate?.toISOString() ?? null,
        quantity: ticket.quantity,
        company: ticket.company,
        project: ticket.project,
        createdBy: ticket.createdBy,
        creative: ticket.creative,
        completedBy: ticket.completedBy,
        completedAt: ticket.completedAt?.toISOString() ?? null,
        jobType: ticket.jobType,
        tags: ticket.tagAssignments.map((ta) => ta.tag),
        tokenCostBase: baseCost,
        tokenCostOverride: ticket.tokenCostOverride,
        tokenCostEffective: effectiveCost,
        creativePayoutOverride: ticket.creativePayoutOverride,
        revisionCount: ticket.revisionCount,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      },
      briefAssets: briefAssetsWithUrls,
      revisions: revisionsWithUrls,
      comments: comments.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
      assignmentLogs: assignmentLogs.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      })),
      auditLogs: auditLogs.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[GET /api/admin/tickets/[ticketId]] error", err);
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }
}
