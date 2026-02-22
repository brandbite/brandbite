// -----------------------------------------------------------------------------
// @file: app/api/customer/projects/route.ts
// @purpose: List and create projects under the customer's company
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-12-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { parseBody } from "@/lib/schemas/helpers";
import { createProjectSchema } from "@/lib/schemas/project.schemas";
import { generateUniqueProjectCode } from "@/lib/abbreviation";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// GET — List all projects for the current customer's company
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can access projects." }, { status: 403 });
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company found." }, { status: 400 });
    }

    const projects = await prisma.project.findMany({
      where: { companyId: user.activeCompanyId },
      select: {
        id: true,
        name: true,
        code: true,
        _count: { select: { tickets: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        ticketCount: p._count.tickets,
      })),
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    console.error("[Projects] GET error:", err);
    return NextResponse.json({ error: "Failed to load projects." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Create a new project
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company found." }, { status: 400 });
    }

    // Only OWNER or PM can create projects
    if (user.companyRole !== "OWNER" && user.companyRole !== "PM") {
      return NextResponse.json(
        { error: "Only company owners and project managers can create projects." },
        { status: 403 },
      );
    }

    const parsed = await parseBody(req, createProjectSchema);
    if (!parsed.success) return parsed.response;
    const { name, code: userCode } = parsed.data;

    // Use user-provided code or auto-generate a 3-char project code
    let code: string;
    if (userCode) {
      // Check per-company uniqueness
      const existing = await prisma.project.findFirst({
        where: { companyId: user.activeCompanyId!, code: userCode },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Project code "${userCode}" is already in use.` },
          { status: 409 },
        );
      }
      code = userCode;
    } else {
      code = await generateUniqueProjectCode(name, user.activeCompanyId!, prisma);
    }

    const project = await prisma.project.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.activeCompanyId,
        name,
        code,
        autoAssignMode: "INHERIT",
      },
    });

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
      },
    });
  } catch (err: any) {
    console.error("[Projects] POST error:", err);

    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to create project." }, { status: 500 });
  }
}
