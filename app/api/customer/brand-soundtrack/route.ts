// -----------------------------------------------------------------------------
// @file: app/api/customer/brand-soundtrack/route.ts
// @purpose: The brand's soundtrack: one Spotify playlist or album link per
//           company, shown to creatives on the company's requests. Anyone in
//           the company can see it; owners and PMs can change or remove it.
//           Owner switch: ENGAGEMENT_BRAND_SOUNDTRACK.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isEngagementOn } from "@/lib/engagement/switches.server";
import { isCompanyAdminRole } from "@/lib/permissions/companyRoles";
import { prisma } from "@/lib/prisma";
import { getPlaylistInfo } from "@/lib/soundtrack/playlists.server";
import { parseSpotifyUrl, spotifyOpenUrl } from "@/lib/soundtrack/spotify";

type Context =
  | { ok: false; response: NextResponse }
  | { ok: true; companyId: string; canEdit: boolean };

async function context(): Promise<Context> {
  const user = await getCurrentUserOrThrow();
  if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const membership = await prisma.companyMember.findFirst({
    where: { companyId: user.activeCompanyId, userId: user.id },
    select: { roleInCompany: true },
  });
  return {
    ok: true,
    companyId: user.activeCompanyId,
    canEdit: isCompanyAdminRole(membership?.roleInCompany),
  };
}

function fail(err: any, what: string): NextResponse {
  if (err?.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  console.error(`[brand-soundtrack] ${what} error`, err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export async function GET() {
  try {
    const ctx = await context();
    if (!ctx.ok) return ctx.response;
    if (!(await isEngagementOn("brandSoundtrack"))) return NextResponse.json({ enabled: false });
    const company = await prisma.company.findUnique({
      where: { id: ctx.companyId },
      select: { soundtrackUrl: true },
    });
    return NextResponse.json({
      enabled: true,
      canEdit: ctx.canEdit,
      soundtrack: company?.soundtrackUrl ? await getPlaylistInfo(company.soundtrackUrl) : null,
    });
  } catch (err) {
    return fail(err, "GET");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await context();
    if (!ctx.ok) return ctx.response;
    if (!(await isEngagementOn("brandSoundtrack"))) {
      return NextResponse.json({ error: "Brand soundtracks are switched off" }, { status: 404 });
    }
    if (!ctx.canEdit) {
      return NextResponse.json(
        { error: "Only company owners and project managers can change the soundtrack" },
        { status: 403 },
      );
    }
    const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
    const raw = typeof body?.url === "string" ? body.url.trim() : "";

    // Empty removes it.
    let soundtrackUrl: string | null = null;
    if (raw) {
      const ref = parseSpotifyUrl(raw);
      if (!ref) {
        return NextResponse.json(
          { error: "Paste a Spotify playlist or album link (open.spotify.com/playlist/…)" },
          { status: 400 },
        );
      }
      soundtrackUrl = spotifyOpenUrl(ref);
    }
    await prisma.company.update({ where: { id: ctx.companyId }, data: { soundtrackUrl } });
    return NextResponse.json({
      soundtrack: soundtrackUrl ? await getPlaylistInfo(soundtrackUrl) : null,
    });
  } catch (err) {
    return fail(err, "PUT");
  }
}
