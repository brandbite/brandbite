// -----------------------------------------------------------------------------
// @file: app/api/customer/brand/questionnaires/route.ts
// @purpose: Brand forms sent by link. GET lists them with their answers;
//           POST makes a new link. Owners and project managers only, since
//           the answers are for them to review.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { brandRouteError, customerBrandAccess, editDenied } from "@/lib/brand/brand-access.server";
import { getOrCreateDefaultBrand } from "@/lib/brand/brand.server";
import { QUESTIONNAIRE_MAX_OPEN } from "@/lib/brand/questionnaire";
import {
  newQuestionnaireToken,
  questionnaireExpiry,
  questionnaireView,
} from "@/lib/brand/questionnaire.server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const access = await customerBrandAccess();
    if (!access.ok) return access.response;
    if (!access.canEdit) return editDenied();

    const brand = await getOrCreateDefaultBrand(access.companyId);
    const forms = await prisma.brandQuestionnaire.findMany({
      where: { brandId: brand.id, status: { not: "DISMISSED" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const origin = new URL(req.url).origin;
    return NextResponse.json({ forms: forms.map((form) => questionnaireView(form, origin)) });
  } catch (error) {
    return brandRouteError(error, "questionnaires GET");
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await customerBrandAccess();
    if (!access.ok) return access.response;
    if (!access.canEdit) return editDenied();

    const body = (await req.json().catch(() => null)) as { recipientNote?: unknown } | null;
    const recipientNote =
      typeof body?.recipientNote === "string" ? body.recipientNote.trim().slice(0, 120) : "";

    const brand = await getOrCreateDefaultBrand(access.companyId);
    const open = await prisma.brandQuestionnaire.count({
      where: { brandId: brand.id, status: "OPEN", expiresAt: { gt: new Date() } },
    });
    if (open >= QUESTIONNAIRE_MAX_OPEN) {
      return NextResponse.json(
        {
          error: `You have ${QUESTIONNAIRE_MAX_OPEN} links waiting for answers. Close one before making another.`,
        },
        { status: 400 },
      );
    }

    const form = await prisma.brandQuestionnaire.create({
      data: {
        brandId: brand.id,
        token: newQuestionnaireToken(),
        createdById: access.userId,
        recipientNote: recipientNote || null,
        expiresAt: questionnaireExpiry(),
      },
    });
    return NextResponse.json(
      { form: questionnaireView(form, new URL(req.url).origin) },
      { status: 201 },
    );
  } catch (error) {
    return brandRouteError(error, "questionnaires POST");
  }
}
