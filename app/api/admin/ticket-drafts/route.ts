// -----------------------------------------------------------------------------
// @file: app/api/admin/ticket-drafts/route.ts
// @purpose: Every unsent request draft, for the brandbite team. Read only.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAssetUrl } from "@/lib/r2";
import { isSiteAdminRole } from "@/lib/roles";
import { draftToClient } from "@/lib/ticket-drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await prisma.ticketDraft.findMany({
      include: {
        company: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
        attachments: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const jobTypeIds = rows
      .map((r) => (r.fields as { jobTypeId?: string } | null)?.jobTypeId)
      .filter((id): id is string => !!id);
    const jobTypes = jobTypeIds.length
      ? await prisma.jobType.findMany({
          where: { id: { in: jobTypeIds } },
          select: { id: true, name: true },
        })
      : [];
    const jobTypeName = new Map(jobTypes.map((j) => [j.id, j.name]));

    const drafts = await Promise.all(
      rows.map(async (row) => {
        const { attachments, ...rest } = row;
        const draft = draftToClient(rest);
        return {
          id: draft.id,
          title: draft.title,
          description: draft.description,
          updatedAt: draft.updatedAt,
          companyName: row.company.name,
          createdByName: row.createdBy.name || row.createdBy.email,
          jobTypeName: jobTypeName.get(draft.jobTypeId) ?? null,
          attachments: await Promise.all(
            attachments.map(async (a) => ({
              id: a.id,
              originalName: a.originalName,
              bytes: a.bytes,
              url: await resolveAssetUrl(a.storageKey, a.url),
            })),
          ),
        };
      }),
    );

    return NextResponse.json({ drafts });
  } catch (error) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.ticket-drafts] GET error", error);
    return NextResponse.json({ error: "Failed to load drafts" }, { status: 500 });
  }
}
