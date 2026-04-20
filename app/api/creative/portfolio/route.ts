// -----------------------------------------------------------------------------
// @file: app/api/creative/portfolio/route.ts
// @purpose: Auto-populated portfolio for the signed-in creative. Pulls every
//           completed ticket (status = DONE) they worked on, pairs each with
//           the final-revision output assets, and exposes the distinct job
//           categories so the UI can offer a filter chip bar.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { resolveAssetUrl } from "@/lib/r2";
import { buildTicketCode } from "@/lib/ticket-code";

const MAX_ITEMS = 200;
const THUMBNAILS_PER_ITEM = 4;

export type PortfolioItem = {
  ticketId: string;
  code: string;
  title: string;
  completedAt: string;
  companyName: string | null;
  projectName: string | null;
  jobType: {
    id: string;
    name: string;
    category: string | null;
  } | null;
  thumbnails: {
    id: string;
    url: string;
    mimeType: string;
    width: number | null;
    height: number | null;
  }[];
};

export type PortfolioResponse = {
  totalCount: number;
  categories: string[];
  items: PortfolioItem[];
};

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can view the portfolio." },
        { status: 403 },
      );
    }

    // Pull every DONE ticket assigned to this creative, newest completion
    // first. We include the final revision's output assets as thumbnails.
    const tickets = await prisma.ticket.findMany({
      where: {
        creativeId: user.id,
        status: TicketStatus.DONE,
      },
      orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
      take: MAX_ITEMS,
      select: {
        id: true,
        title: true,
        completedAt: true,
        updatedAt: true,
        companyTicketNumber: true,
        company: {
          select: { id: true, name: true },
        },
        project: {
          select: { id: true, name: true, code: true },
        },
        jobType: {
          select: { id: true, name: true, category: true },
        },
        revisions: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            assets: {
              where: {
                deletedAt: null,
                kind: "OUTPUT_IMAGE",
              },
              orderBy: { createdAt: "asc" },
              take: THUMBNAILS_PER_ITEM,
              select: {
                id: true,
                url: true,
                storageKey: true,
                mimeType: true,
                width: true,
                height: true,
              },
            },
          },
        },
      },
    });

    const items: PortfolioItem[] = await Promise.all(
      tickets.map(async (t) => {
        const latestRevision = t.revisions[0];
        const thumbs = latestRevision?.assets ?? [];

        // Resolve presigned URLs for R2-backed assets so the browser can
        // actually load them without needing its own signed-URL fetch. Drop
        // any asset whose URL can't be resolved (e.g. R2 not configured and
        // no stored URL) so the client never renders broken <img> tags.
        const resolved = await Promise.all(
          thumbs.map(async (a) => {
            const url = await resolveAssetUrl(a.storageKey, a.url);
            if (!url) return null;
            return {
              id: a.id,
              url,
              mimeType: a.mimeType,
              width: a.width,
              height: a.height,
            };
          }),
        );
        const thumbnails = resolved.flatMap((t) => (t ? [t] : []));

        return {
          ticketId: t.id,
          code: buildTicketCode({
            projectCode: t.project?.code ?? null,
            companyTicketNumber: t.companyTicketNumber,
            ticketId: t.id,
          }),
          title: t.title,
          completedAt: (t.completedAt ?? t.updatedAt).toISOString(),
          companyName: t.company?.name ?? null,
          projectName: t.project?.name ?? null,
          jobType: t.jobType
            ? {
                id: t.jobType.id,
                name: t.jobType.name,
                category: t.jobType.category,
              }
            : null,
          thumbnails,
        };
      }),
    );

    // Build the category list from the items we actually have so the UI
    // only offers filters that produce results.
    const categories = Array.from(
      new Set(
        items
          .map((i) => i.jobType?.category)
          .filter((c): c is string => typeof c === "string" && c.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const body: PortfolioResponse = {
      totalCount: items.length,
      categories,
      items,
    };

    return NextResponse.json(body, { status: 200 });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[GET /api/creative/portfolio] error", error);
    return NextResponse.json({ error: "Failed to load portfolio" }, { status: 500 });
  }
}
