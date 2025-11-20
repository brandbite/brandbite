// -----------------------------------------------------------------------------
// @file: app/api/debug/auto-assign/overview/route.ts
// @purpose: SiteOwner / SiteAdmin overview of auto-assign settings
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-20
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

type ProjectAutoAssignMode = "INHERIT" | "ON" | "OFF";

type AutoAssignOverviewProject = {
  id: string;
  name: string;
  code: string | null;
  autoAssignMode: ProjectAutoAssignMode;
};

type AutoAssignOverviewCompany = {
  id: string;
  name: string;
  slug: string;
  autoAssignDefaultEnabled: boolean;
  projects: AutoAssignOverviewProject[];
};

type AutoAssignOverviewResponse = {
  companies: AutoAssignOverviewCompany[];
};

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    // Only site-level admins/owners can access this debug endpoint
    if (user.role !== "SITE_OWNER" && user.role !== "SITE_ADMIN") {
      return NextResponse.json(
        { error: "Only site owners and admins can access this endpoint." },
        { status: 403 },
      );
    }

    const companies = await prisma.company.findMany({
      orderBy: {
        createdAt: "asc",
      },
      include: {
        projects: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    const payload: AutoAssignOverviewCompany[] = companies.map((c) => {
      const autoAssignDefaultEnabled =
        (c as any).autoAssignDefaultEnabled ?? false;

      const projects: AutoAssignOverviewProject[] = c.projects.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code ?? null,
        autoAssignMode:
          ((p as any).autoAssignMode as ProjectAutoAssignMode | undefined) ??
          "INHERIT",
      }));

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        autoAssignDefaultEnabled,
        projects,
      };
    });

    const response: AutoAssignOverviewResponse = {
      companies: payload,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[debug.autoAssign.overview] GET error", error);
    return NextResponse.json(
      { error: "Failed to load auto-assign overview" },
      { status: 500 },
    );
  }
}