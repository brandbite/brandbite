// -----------------------------------------------------------------------------
// @file: lib/newsletter/store.server.ts
// @purpose: Shared by the routes that keep newsletters for a company: who may
//           use them (a signed-in customer whose company is on a plan) and
//           how a stored row and an incoming document are read.
// -----------------------------------------------------------------------------

import "server-only";

import { NextResponse } from "next/server";

import { getToolAccess } from "@/lib/tools/entitlement.server";

import { prisma } from "@/lib/prisma";

import { NEWSLETTER_MAX_BYTES, readNewsletter, type NewsletterData } from "./newsletter";
import { VERSION_EVERY_MS, VERSIONS_MAX } from "./saved";

export const UNTITLED = "Untitled newsletter";

export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });

/** The company and user behind a request, or the response that turns it away. */
export async function newsletterOwner(): Promise<
  { companyId: string; userId: string } | { response: NextResponse }
> {
  const access = await getToolAccess().catch(() => null);
  if (!access?.userId) return { response: fail(401, "Sign in to keep newsletters.") };
  if (!access.entitlement.pro || !access.companyId) {
    return { response: fail(403, "Keeping newsletters is included with a brandbite plan.") };
  }
  return { companyId: access.companyId, userId: access.userId };
}

/** An incoming document, cleaned; or why it can't be stored. */
export function incomingNewsletter(raw: unknown): NewsletterData | { error: string } {
  const data = readNewsletter(raw);
  if (!data) return { error: "That isn't a newsletter." };
  if (JSON.stringify(data).length > NEWSLETTER_MAX_BYTES) {
    return { error: "This newsletter is too large to keep. Remove some blocks." };
  }
  return data;
}

export const cleanName = (value: unknown, fallback: string) =>
  (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 120) : "") || fallback;

export type NewsletterSummary = {
  id: string;
  name: string;
  subject: string;
  isTemplate: boolean;
  updatedAt: string;
};

export function summarize(row: {
  id: string;
  name: string;
  data: unknown;
  isTemplate: boolean;
  updatedAt: Date;
}): NewsletterSummary {
  return {
    id: row.id,
    name: row.name,
    subject: readNewsletter(row.data)?.subject ?? "",
    isTemplate: row.isTemplate,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Keeps a newsletter's state as an earlier version, unless one was kept in
 * the last few minutes, and drops the oldest beyond the limit. Never fails
 * the save it is part of: a missed version is better than lost work.
 */
export async function keepVersion(
  newsletterId: string,
  data: unknown,
  userId: string,
): Promise<void> {
  try {
    const latest = await prisma.newsletterVersion.findFirst({
      where: { newsletterId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < VERSION_EVERY_MS) return;
    const clean = readNewsletter(data);
    if (!clean) return;
    await prisma.newsletterVersion.create({
      data: { newsletterId, data: clean, createdById: userId },
    });
    const extra = await prisma.newsletterVersion.findMany({
      where: { newsletterId },
      orderBy: { createdAt: "desc" },
      skip: VERSIONS_MAX,
      select: { id: true },
    });
    if (extra.length) {
      await prisma.newsletterVersion.deleteMany({ where: { id: { in: extra.map((v) => v.id) } } });
    }
  } catch (error) {
    console.error("[newsletters] keeping a version failed", error);
  }
}
