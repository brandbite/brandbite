// -----------------------------------------------------------------------------
// @file: app/api/customer/projects/route.ts
// @purpose: Create a project under the customer's company
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company found." },
        { status: 400 },
      );
    }

    // Only OWNER or PM can create projects
    if (user.companyRole !== "OWNER" && user.companyRole !== "PM") {
      return NextResponse.json(
        { error: "Only company owners and project managers can create projects." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const name = (body?.name as string)?.trim();

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Project name is required (min 2 characters)." },
        { status: 400 },
      );
    }

    // Generate project code from company slug + project name initials
    const company = await prisma.company.findUnique({
      where: { id: user.activeCompanyId },
      select: { slug: true },
    });

    const prefix = (company?.slug || "PRJ")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 4);
    const nameInitials = name
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 3);
    let baseCode = `${prefix}-${nameInitials || "PRJ"}`;

    // Ensure code uniqueness
    let code = baseCode;
    let suffix = 0;
    while (await prisma.project.findUnique({ where: { code } })) {
      suffix += 1;
      code = `${baseCode}${suffix}`;
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
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create project." },
      { status: 500 },
    );
  }
}
