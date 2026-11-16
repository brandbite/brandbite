// -----------------------------------------------------------------------------
// @file: app/api/tickets/[id]/brand/route.ts
// @purpose: The brand guide that applies to a request, read-only, for anyone
//           who can see the request: the company's members, the assigned
//           creative and site admins.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { brandRouteError } from "@/lib/brand/brand-access.server";
import { brandForProject, brandView, listBrandAssets } from "@/lib/brand/brand.server";
import { canViewSourceFiles, loadSourceFileTicket } from "@/lib/source-files/source-files";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    const ticket = await loadSourceFileTicket((await params).id);
    // The same people who see a request's source files see its brand guide.
    if (!ticket || !(await canViewSourceFiles(user, ticket))) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    const { brand } = await brandForProject({
      companyId: ticket.companyId,
      projectId: ticket.project?.id,
    });
    return NextResponse.json({
      brand: brandView(brand),
      assets: await listBrandAssets(brand.id),
    });
  } catch (error) {
    return brandRouteError(error, "ticket brand GET");
  }
}
