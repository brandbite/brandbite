// -----------------------------------------------------------------------------
// @file: lib/brand/questionnaire.server.ts
// @purpose: Server side of the brand form: make a link, find a form by its
//           token, and shape a form for the company's review list.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

import "server-only";

import { randomBytes } from "node:crypto";

import type { BrandQuestionnaire } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { QUESTIONNAIRE_LINK_DAYS, readAnswers } from "./questionnaire";

export function newQuestionnaireToken(): string {
  return randomBytes(24).toString("base64url");
}

export function questionnaireExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + QUESTIONNAIRE_LINK_DAYS * 24 * 60 * 60 * 1000);
}

export type OpenQuestionnaire = { id: string; brandName: string; companyName: string };

/**
 * The form behind a link, when the link can still be answered. "closed"
 * covers answered, dismissed and expired links alike; a wrong token is
 * "missing". Neither says anything about the company.
 */
export async function findQuestionnaireByToken(
  token: string,
): Promise<
  { state: "open"; form: OpenQuestionnaire } | { state: "closed" } | { state: "missing" }
> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { state: "missing" };
  const form = await prisma.brandQuestionnaire.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      brand: { select: { name: true, company: { select: { name: true } } } },
    },
  });
  if (!form) return { state: "missing" };
  if (form.status !== "OPEN" || form.expiresAt.getTime() <= Date.now()) return { state: "closed" };
  return {
    state: "open",
    form: { id: form.id, brandName: form.brand.name, companyName: form.brand.company.name },
  };
}

export function questionnaireView(form: BrandQuestionnaire, origin: string) {
  const expired = form.status === "OPEN" && form.expiresAt.getTime() <= Date.now();
  return {
    id: form.id,
    status: expired ? ("EXPIRED" as const) : form.status,
    recipientNote: form.recipientNote,
    respondentName: form.respondentName,
    respondentRole: form.respondentRole,
    answers: readAnswers(form.answers),
    // The link is only worth showing while it can still be answered.
    url: form.status === "OPEN" && !expired ? `${origin}/brand-form/${form.token}` : null,
    createdAt: form.createdAt.toISOString(),
    submittedAt: form.submittedAt?.toISOString() ?? null,
    expiresAt: form.expiresAt.toISOString(),
  };
}

export type QuestionnaireView = ReturnType<typeof questionnaireView>;
