// -----------------------------------------------------------------------------
// @file: app/api/customer/brand/questionnaires/[formId]/route.ts
// @purpose: Act on one brand form. POST adds its answers to the brand guide
//           (each answered question replaces that field); DELETE closes the
//           link or sets the answers aside. Owners and project managers only.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { brandRouteError, customerBrandAccess, editDenied } from "@/lib/brand/brand-access.server";
import { brandView } from "@/lib/brand/brand.server";
import { readAnswers } from "@/lib/brand/questionnaire";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ formId: string }> };

async function findForm(formId: string, companyId: string) {
  return prisma.brandQuestionnaire.findFirst({
    where: { id: formId, brand: { companyId } },
  });
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const access = await customerBrandAccess();
    if (!access.ok) return access.response;
    if (!access.canEdit) return editDenied();

    const form = await findForm((await params).formId, access.companyId);
    if (!form) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    if (form.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: "Only answered forms can be added to the brand guide." },
        { status: 409 },
      );
    }

    // Only answered questions change the guide; the rest of it stays.
    const answers = readAnswers(form.answers);
    const [brand] = await prisma.$transaction([
      prisma.brand.update({ where: { id: form.brandId }, data: answers }),
      prisma.brandQuestionnaire.update({ where: { id: form.id }, data: { status: "APPLIED" } }),
    ]);
    return NextResponse.json({ brand: brandView(brand) });
  } catch (error) {
    return brandRouteError(error, "questionnaire apply");
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const access = await customerBrandAccess();
    if (!access.ok) return access.response;
    if (!access.canEdit) return editDenied();

    const form = await findForm((await params).formId, access.companyId);
    if (!form) return NextResponse.json({ error: "Form not found." }, { status: 404 });

    await prisma.brandQuestionnaire.update({
      where: { id: form.id },
      data: { status: "DISMISSED" },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return brandRouteError(error, "questionnaire DELETE");
  }
}
