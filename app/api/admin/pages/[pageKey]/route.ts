// -----------------------------------------------------------------------------
// @file: app/api/admin/pages/[pageKey]/route.ts
// @purpose: Admin — get or update a single CMS page by key
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

// ---------------------------------------------------------------------------
// GET — fetch a single CMS page by key
// ---------------------------------------------------------------------------

export async function GET(_req: Request, { params }: { params: Promise<{ pageKey: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { pageKey } = await params;

    const page = await prisma.cmsPage.findUnique({
      where: { pageKey },
    });

    if (!page) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ page });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    console.error("[admin/pages/[pageKey]] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Allow-list of page keys the admin can touch. Prevents a typo in the URL
// from silently creating phantom CmsPage rows (e.g. PATCH /api/admin/pages/Privacy
// creating a duplicate with a capital P). Every public /something page that
// should be CMS-managed needs to be added here.
// ---------------------------------------------------------------------------

const ALLOWED_PAGE_KEYS = new Set([
  "about",
  "contact",
  "documentation",
  "privacy",
  "terms",
  "cookies",
  "accessibility",
]);

// Human-readable defaults used when an admin saves a page for the first time
// and hasn't typed a title yet. Keeps the /privacy etc. URLs from rendering
// with an empty <h1> if someone clicks Save with only a body filled in.
const DEFAULT_TITLES: Record<string, string> = {
  about: "About Brandbite",
  contact: "Contact",
  documentation: "Documentation",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  cookies: "Cookie Policy",
  accessibility: "Accessibility",
};

// ---------------------------------------------------------------------------
// PATCH — upsert a CMS page
//
// We use upsert (rather than plain update) so an admin can edit pages whose
// database row doesn't exist yet. The client renders placeholder entries
// for every key in the allow-list; saving any of them materialises the row.
// ---------------------------------------------------------------------------

export async function PATCH(req: Request, { params }: { params: Promise<{ pageKey: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { pageKey } = await params;

    if (!ALLOWED_PAGE_KEYS.has(pageKey)) {
      return NextResponse.json({ error: "UNKNOWN_PAGE_KEY" }, { status: 400 });
    }

    const body = (await req.json()) as any;

    // Only allow updating specific fields
    const update: any = {};
    if (body?.title !== undefined) update.title = body.title;
    if (body?.subtitle !== undefined) update.subtitle = body.subtitle;
    if (body?.heroStorageKey !== undefined) update.heroStorageKey = body.heroStorageKey;
    if (body?.heroUrl !== undefined) update.heroUrl = body.heroUrl;
    if (body?.body !== undefined) update.body = body.body;
    if (body?.metaTitle !== undefined) update.metaTitle = body.metaTitle;
    if (body?.metaDescription !== undefined) update.metaDescription = body.metaDescription;

    // `create` needs a title (non-nullable). Fall back to the default for the
    // page key when the admin hasn't provided one — they can rename it later.
    const createTitle =
      typeof update.title === "string" && update.title.trim().length > 0
        ? update.title
        : (DEFAULT_TITLES[pageKey] ?? pageKey);

    const page = await prisma.cmsPage.upsert({
      where: { pageKey },
      update,
      create: {
        pageKey,
        title: createTitle,
        subtitle: update.subtitle ?? null,
        heroStorageKey: update.heroStorageKey ?? null,
        heroUrl: update.heroUrl ?? null,
        body: update.body ?? null,
        metaTitle: update.metaTitle ?? null,
        metaDescription: update.metaDescription ?? null,
      },
    });

    return NextResponse.json({ page });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    console.error("[admin/pages/[pageKey]] PATCH error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
