// -----------------------------------------------------------------------------
// @file: app/api/admin/job-type-categories/migrate/route.ts
// @purpose: Link job types that only carry the legacy free-text `category`
//           to structured JobTypeCategory rows.
//
//           v1 only ran when NO categories existed (409 otherwise), so any
//           deploy where categories were created first — demo, and prod
//           after the demo→prod copy — could never link its job types. Those
//           job types then (a) render a category name the Categories page
//           doesn't count, (b) lose their label when saved from the admin
//           editor, and (c) are invisible to talent onboarding, which picks
//           CreativeSkills by `categoryId`.
//
//           v2 is idempotent and safe to re-run:
//             GET  → preview: unlinked job types grouped by their text label,
//                    each mapped to the existing category it will join (same
//                    name, case/whitespace-insensitive) or marked "create".
//             POST → in one transaction, create only the missing categories
//                    and set `categoryId` only on job types where it is null.
//                    Already-linked job types and existing categories are
//                    never modified. The legacy text is left as-is.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

/** Known categories with their default icons and sort order */
const KNOWN_CATEGORIES: Record<string, { icon: string; sortOrder: number }> = {
  "Brand Strategy & Creative Direction": { icon: "✨", sortOrder: 0 },
  "Copywriting & Creative Writing": { icon: "✍️", sortOrder: 1 },
  "Visual Design & Brand Identity": { icon: "🎨", sortOrder: 2 },
  "Digital Content & Marketing": { icon: "📱", sortOrder: 3 },
  "Video & Motion Production": { icon: "🎬", sortOrder: 4 },
};

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50) || "category";

type PlanGroup = {
  /** Legacy label as written on the job types (first spelling seen). */
  label: string;
  jobTypeIds: string[];
  match: { id: string; name: string } | null;
};

/** Read-only: group unlinked job types by label and resolve existing matches. */
async function buildPlan(db: Pick<typeof prisma, "jobType" | "jobTypeCategory">) {
  const [unlinked, categories] = await Promise.all([
    db.jobType.findMany({
      where: { categoryId: null, category: { not: null } },
      select: { id: true, category: true },
    }),
    db.jobTypeCategory.findMany({ select: { id: true, name: true } }),
  ]);

  const byName = new Map(categories.map((c) => [norm(c.name), c]));
  const groups = new Map<string, PlanGroup>();

  for (const jt of unlinked) {
    const raw = jt.category?.trim();
    if (!raw) continue;
    const key = norm(raw);
    let g = groups.get(key);
    if (!g) {
      const m = byName.get(key);
      g = { label: raw, jobTypeIds: [], match: m ? { id: m.id, name: m.name } : null };
      groups.set(key, g);
    }
    g.jobTypeIds.push(jt.id);
  }

  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function summarize(plan: PlanGroup[]) {
  return {
    unlinkedJobTypes: plan.reduce((n, g) => n + g.jobTypeIds.length, 0),
    groups: plan.map((g) => ({
      label: g.label,
      jobTypes: g.jobTypeIds.length,
      action: g.match ? ("link" as const) : ("create" as const),
      category: g.match,
    })),
  };
}

async function requireSiteAdmin() {
  const user = await getCurrentUserOrThrow();
  if (!isSiteAdminRole(user.role)) {
    return {
      user,
      denied: NextResponse.json(
        { error: "Only site admins can link service categories" },
        { status: 403 },
      ),
    };
  }
  return { user, denied: null };
}

// ---------------------------------------------------------------------------
// GET: preview what POST would do (no writes)
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const { denied } = await requireSiteAdmin();
    if (denied) return denied;
    return NextResponse.json(summarize(await buildPlan(prisma)));
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.job-type-categories.migrate] GET error", error);
    return NextResponse.json({ error: "Failed to load preview" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST: create missing categories + link unlinked job types (idempotent)
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest) {
  try {
    const { user, denied } = await requireSiteAdmin();
    if (denied) return denied;

    const result = await prisma.$transaction(async (tx) => {
      // Re-plan inside the transaction so a concurrent edit can't make us
      // link against a stale view.
      const plan = await buildPlan(tx);
      if (plan.length === 0) return { created: 0, linked: 0 };

      const usedSlugs = new Set(
        (await tx.jobTypeCategory.findMany({ select: { slug: true } })).map((c) => c.slug),
      );
      const maxSort =
        (await tx.jobTypeCategory.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1;
      let nextSort = maxSort + 1;

      let created = 0;
      let linked = 0;

      for (const g of plan) {
        let categoryId = g.match?.id;

        if (!categoryId) {
          const base = slugify(g.label);
          let slug = base;
          for (let i = 2; usedSlugs.has(slug); i++) slug = `${base}-${i}`;
          usedSlugs.add(slug);

          const known = KNOWN_CATEGORIES[g.label];
          const cat = await tx.jobTypeCategory.create({
            data: {
              name: g.label,
              slug,
              icon: known?.icon ?? null,
              sortOrder: known?.sortOrder ?? nextSort++,
            },
            select: { id: true },
          });
          categoryId = cat.id;
          created++;
        }

        // `categoryId: null` in the where clause keeps this idempotent even
        // if a row was linked by someone else mid-transaction.
        const res = await tx.jobType.updateMany({
          where: { id: { in: g.jobTypeIds }, categoryId: null },
          data: { categoryId },
        });
        linked += res.count;
      }

      return { created, linked };
    });

    console.info(
      `[admin.job-type-categories.migrate] ${user.email} linked ${result.linked} job types, created ${result.created} categories`,
    );

    return NextResponse.json({
      success: true,
      ...result,
      message:
        result.linked === 0 && result.created === 0
          ? "Every service is already linked to a category."
          : `Linked ${result.linked} service${result.linked === 1 ? "" : "s"}` +
            (result.created
              ? ` and created ${result.created} categor${result.created === 1 ? "y" : "ies"}.`
              : "."),
    });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.job-type-categories.migrate] POST error", error);
    return NextResponse.json({ error: "Linking failed" }, { status: 500 });
  }
}
