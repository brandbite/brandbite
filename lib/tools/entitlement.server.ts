// -----------------------------------------------------------------------------
// @file: lib/tools/entitlement.server.ts
// @purpose: Looks up the facts behind a visitor's hub-tool access (signed in?
//           company on an active plan? brand guide colors?) for the routes
//           that need them. The rule itself is in lib/tools/entitlement.ts.
// -----------------------------------------------------------------------------

import { getCurrentUser } from "@/lib/auth";
import { readBrandColors } from "@/lib/brand/brand-data";
import { isBrandFilePreviewable } from "@/lib/brand/brand-files";
import { prisma } from "@/lib/prisma";

import { toolEntitlement, type ToolEntitlement } from "./entitlement";

export type ToolAccessFacts = {
  entitlement: ToolEntitlement;
  userId: string | null;
  /** The signed-in user's active company; null when signed out or without one. */
  companyId: string | null;
  brandColors: { hex: string; name: string | null }[];
  /** The active company's name, for tools that show the customer's own brand. */
  companyName: string | null;
  /** The brand guide holds a logo a tool can use (see /api/tools/brand-logo). */
  hasBrandLogo: boolean;
};

export async function getToolAccess(): Promise<ToolAccessFacts> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      entitlement: toolEntitlement({ signedIn: false, plan: null }),
      userId: null,
      companyId: null,
      brandColors: [],
      companyName: null,
      hasBrandLogo: false,
    };
  }

  const company = user.activeCompanyId
    ? await prisma.company.findUnique({
        where: { id: user.activeCompanyId },
        select: {
          id: true,
          name: true,
          plan: { select: { isActive: true } },
          brands: {
            where: { isDefault: true },
            take: 1,
            select: {
              colors: true,
              assets: {
                where: {
                  status: "READY",
                  deletedAt: null,
                  kind: { in: ["LOGO_PRIMARY", "LOGO_ICON", "LOGO_SECONDARY", "LOGO_WORDMARK"] },
                },
                select: { name: true },
              },
            },
          },
        },
      })
    : null;

  return {
    entitlement: toolEntitlement({ signedIn: true, plan: company?.plan ?? null }),
    userId: user.id,
    companyId: company?.id ?? null,
    brandColors: readBrandColors(company?.brands[0]?.colors).map((color) => ({
      hex: color.hex,
      name: color.name ?? null,
    })),
    companyName: company?.name ?? null,
    hasBrandLogo: (company?.brands[0]?.assets ?? []).some((asset) =>
      isBrandFilePreviewable(asset.name),
    ),
  };
}

/** "Extend with AI" needs a plan and the image model's key on this deployment. */
export function aiExtendAvailable(entitlement: ToolEntitlement): boolean {
  return entitlement.pro && Boolean(process.env.OPENAI_API_KEY);
}
