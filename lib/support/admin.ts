// -----------------------------------------------------------------------------
// @file: lib/support/admin.ts
// @purpose: What the admin "Support content" screens do: list every guide with
//           its CMS state, open one with its code version beside the edit,
//           save, hide, show, resolve code changes and add CMS-only guides.
//           Server only; the API routes in app/api/admin/support-guides call it.
// -----------------------------------------------------------------------------

import "server-only";

import type { GuideAudience, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { AUDIENCE_FOR_ROLE } from "./effective";
import { guideCodeHash } from "./hash";
import { codeGuides } from "./index";
import {
  codeStatusFor,
  contentOf,
  parseGuideContent,
  type GuideCodeStatus,
  type GuideContent,
} from "./merge";
import type { SupportGuide, SupportRole } from "./types";

export const SUPPORT_ROLES: SupportRole[] = ["customer", "creative", "admin"];

export function isSupportRole(value: string): value is SupportRole {
  return (SUPPORT_ROLES as string[]).includes(value);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type GuideState = "code" | "edited" | "cms" | "hidden";

export type GuideRow = {
  role: SupportRole;
  slug: string;
  title: string;
  category: string;
  state: GuideState;
  /** Waiting for an admin: code changed or removed the guide after an edit. */
  status: GuideCodeStatus;
  ownerOnly: boolean;
  updatedAt: string | null;
};

type EntryRow = {
  id: string;
  slug: string;
  fromCode: boolean;
  hidden: boolean;
  content: Prisma.JsonValue;
  baseCodeHash: string | null;
  updatedAt: Date;
};

const ENTRY_SELECT = {
  id: true,
  slug: true,
  fromCode: true,
  hidden: true,
  content: true,
  baseCodeHash: true,
  updatedAt: true,
} as const;

function codeGuide(role: SupportRole, slug: string): SupportGuide | undefined {
  return codeGuides(role).find((guide) => guide.slug === slug);
}

function stateOf(entry: EntryRow | undefined): GuideState {
  if (!entry) return "code";
  if (entry.hidden) return "hidden";
  if (!entry.fromCode) return "cms";
  return entry.content ? "edited" : "code";
}

/** Every guide for every role, with its CMS state. Owner-only guides need the owner. */
export async function listGuideRows(isSiteOwner: boolean): Promise<GuideRow[]> {
  const rows: GuideRow[] = [];
  for (const role of SUPPORT_ROLES) {
    const entries: EntryRow[] = await prisma.guideEntry.findMany({
      where: { audience: AUDIENCE_FOR_ROLE[role] },
      select: ENTRY_SELECT,
    });
    const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
    for (const guide of codeGuides(role)) {
      if (guide.ownerOnly && !isSiteOwner) continue;
      const entry = bySlug.get(guide.slug);
      const content = entry ? parseGuideContent(entry.content) : null;
      rows.push({
        role,
        slug: guide.slug,
        title: content?.title ?? guide.title,
        category: content?.category ?? guide.category,
        state: stateOf(entry),
        status: entry ? codeStatusFor(entry, guideCodeHash(guide)) : "IN_SYNC",
        ownerOnly: !!guide.ownerOnly,
        updatedAt: entry?.updatedAt.toISOString() ?? null,
      });
      bySlug.delete(guide.slug);
    }
    // What's left: CMS-only guides, and edits whose code guide was removed.
    for (const entry of bySlug.values()) {
      const content = parseGuideContent(entry.content);
      rows.push({
        role,
        slug: entry.slug,
        title: content?.title ?? entry.slug,
        category: content?.category ?? "Other",
        state: entry.hidden ? "hidden" : entry.fromCode ? "edited" : "cms",
        status: codeStatusFor(entry, null),
        ownerOnly: false,
        updatedAt: entry.updatedAt.toISOString(),
      });
    }
  }
  return rows;
}

export type GuideDetail = {
  role: SupportRole;
  slug: string;
  state: GuideState;
  status: GuideCodeStatus;
  /** The guide as written in code, if it is a code guide. */
  code: GuideContent | null;
  /** The admin's edit, if there is one. */
  edit: GuideContent | null;
  hidden: boolean;
  ownerOnly: boolean;
};

async function findEntry(role: SupportRole, slug: string): Promise<EntryRow | null> {
  return prisma.guideEntry.findUnique({
    where: { audience_slug: { audience: AUDIENCE_FOR_ROLE[role], slug } },
    select: ENTRY_SELECT,
  });
}

export async function getGuideDetail(role: SupportRole, slug: string): Promise<GuideDetail | null> {
  const code = codeGuide(role, slug);
  const entry = await findEntry(role, slug);
  if (!code && !entry) return null;
  return {
    role,
    slug,
    state: stateOf(entry ?? undefined),
    status: entry ? codeStatusFor(entry, code ? guideCodeHash(code) : null) : "IN_SYNC",
    code: code ? contentOf(code) : null,
    edit: entry ? parseGuideContent(entry.content) : null,
    hidden: !!entry?.hidden,
    ownerOnly: !!code?.ownerOnly,
  };
}

export class GuideAdminError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID" | "CONFLICT" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
  }
}

function audience(role: SupportRole): GuideAudience {
  return AUDIENCE_FOR_ROLE[role];
}

/** Saves an admin's text. For a code guide, records which code version it was based on. */
export async function saveGuide(
  role: SupportRole,
  slug: string,
  rawContent: unknown,
  userId: string,
): Promise<void> {
  const content = parseGuideContent(rawContent);
  if (!content)
    throw new GuideAdminError(
      "INVALID",
      "A guide needs a title and at least one section with text.",
    );
  const code = codeGuide(role, slug);
  const entry = await findEntry(role, slug);
  if (!code && !entry) throw new GuideAdminError("NOT_FOUND", "Guide not found.");

  const data = {
    content: content as unknown as Prisma.InputJsonValue,
    updatedById: userId,
    ...(code
      ? {
          fromCode: true,
          baseCodeHash: guideCodeHash(code),
          codeStatus: "IN_SYNC" as const,
          notifiedCodeHash: null,
        }
      : {}),
  };
  await prisma.guideEntry.upsert({
    where: { audience_slug: { audience: audience(role), slug } },
    create: { audience: audience(role), slug, ...data, fromCode: !!code },
    update: data,
  });
}

export type GuideAction = "hide" | "show" | "keep-mine" | "keep-as-cms";

export async function applyGuideAction(
  role: SupportRole,
  slug: string,
  action: GuideAction,
  userId: string,
): Promise<void> {
  const code = codeGuide(role, slug);
  const entry = await findEntry(role, slug);
  if (!code && !entry) throw new GuideAdminError("NOT_FOUND", "Guide not found.");
  const where = { audience_slug: { audience: audience(role), slug } };

  switch (action) {
    case "hide":
      await prisma.guideEntry.upsert({
        where,
        create: {
          audience: audience(role),
          slug,
          fromCode: !!code,
          hidden: true,
          baseCodeHash: code ? guideCodeHash(code) : null,
          updatedById: userId,
        },
        update: { hidden: true, updatedById: userId },
      });
      return;
    case "show":
      if (!entry) return;
      // A code guide that was only hidden has nothing left to keep.
      if (entry.fromCode && !entry.content) await prisma.guideEntry.delete({ where });
      else await prisma.guideEntry.update({ where, data: { hidden: false, updatedById: userId } });
      return;
    case "keep-mine":
      if (!entry || !code)
        throw new GuideAdminError("CONFLICT", "Nothing to keep: code has no newer version.");
      await prisma.guideEntry.update({
        where,
        data: {
          baseCodeHash: guideCodeHash(code),
          codeStatus: "IN_SYNC",
          notifiedCodeHash: null,
          updatedById: userId,
        },
      });
      return;
    case "keep-as-cms":
      if (!entry || code)
        throw new GuideAdminError(
          "CONFLICT",
          "Only a guide removed from code can become a CMS guide.",
        );
      if (!parseGuideContent(entry.content)) {
        throw new GuideAdminError("CONFLICT", "This guide has no text of its own to keep.");
      }
      await prisma.guideEntry.update({
        where,
        data: {
          fromCode: false,
          baseCodeHash: null,
          codeStatus: "IN_SYNC",
          notifiedCodeHash: null,
          updatedById: userId,
        },
      });
      return;
  }
}

/** Removes the CMS row: a code guide goes back to its code text; a CMS guide is deleted. */
export async function removeGuideEntry(role: SupportRole, slug: string): Promise<void> {
  const entry = await findEntry(role, slug);
  if (!entry) throw new GuideAdminError("NOT_FOUND", "Nothing to remove.");
  await prisma.guideEntry.delete({ where: { id: entry.id } });
}

export async function createCmsGuide(
  role: SupportRole,
  slug: string,
  rawContent: unknown,
  userId: string,
): Promise<void> {
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) {
    throw new GuideAdminError(
      "INVALID",
      "Use lowercase letters, numbers and dashes for the address.",
    );
  }
  if (codeGuide(role, slug) || (await findEntry(role, slug))) {
    throw new GuideAdminError("CONFLICT", "A guide with this address already exists.");
  }
  const content = parseGuideContent(rawContent);
  if (!content)
    throw new GuideAdminError(
      "INVALID",
      "A guide needs a title and at least one section with text.",
    );
  await prisma.guideEntry.create({
    data: {
      audience: audience(role),
      slug,
      fromCode: false,
      content: content as unknown as Prisma.InputJsonValue,
      updatedById: userId,
    },
  });
}
