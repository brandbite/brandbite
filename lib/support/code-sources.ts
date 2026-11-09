// -----------------------------------------------------------------------------
// @file: lib/support/code-sources.ts
// @purpose: Every set of guides written in code, by who it is for: the three
//           dashboard roles (Support) and the public site (/guides). Server
//           side only in practice: it pulls in the public articles, which the
//           dashboard's client bundles don't need.
// -----------------------------------------------------------------------------

import type { GuideAudience } from "@prisma/client";

import { PUBLIC_GUIDES } from "@/lib/guides";

import { codeGuides } from "./index";
import type { SupportGuide, SupportRole } from "./types";

/** Who a guide is for: a dashboard role, or the public site. */
export type GuideOwner = SupportRole | "public";

export const GUIDE_OWNERS: GuideOwner[] = ["customer", "creative", "admin", "public"];

export function isGuideOwner(value: string): value is GuideOwner {
  return (GUIDE_OWNERS as string[]).includes(value);
}

export const AUDIENCE_FOR_OWNER: Record<GuideOwner, GuideAudience> = {
  customer: "CUSTOMER",
  creative: "CREATIVE",
  admin: "ADMIN",
  public: "PUBLIC",
};

export const OWNER_FOR_AUDIENCE: Record<GuideAudience, GuideOwner> = {
  CUSTOMER: "customer",
  CREATIVE: "creative",
  ADMIN: "admin",
  PUBLIC: "public",
};

export function codeGuidesFor(owner: GuideOwner): SupportGuide[] {
  return owner === "public" ? PUBLIC_GUIDES : codeGuides(owner);
}
