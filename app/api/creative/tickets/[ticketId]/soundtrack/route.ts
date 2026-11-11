// -----------------------------------------------------------------------------
// @file: app/api/creative/tickets/[ticketId]/soundtrack/route.ts
// @purpose: What the soundtrack card shows a creative on a request:
//             - the brand's soundtrack, if the customer picked one
//               (owner switch ENGAGEMENT_BRAND_SOUNDTRACK), and
//             - brandbite's suggestions for the request's mood
//               (owner switch ENGAGEMENT_FOCUS_PLAYLIST, unless the creative
//               turned suggestions off for themselves).
//           `?mood=` overrides the mood picked from the brief.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { getEngagementSwitches } from "@/lib/engagement/switches.server";
import { prisma } from "@/lib/prisma";
import { generatedPlaylists } from "@/lib/soundtrack/combos";
import { detectMood, isMood, MOOD_LABELS, MOODS } from "@/lib/soundtrack/moods";
import {
  getMoodPlaylistLinks,
  getPlaylistInfo,
  type PlaylistInfo,
} from "@/lib/soundtrack/playlists.server";

type RouteContext = { params: Promise<{ ticketId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "DESIGNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const switches = await getEngagementSwitches();
    if (!switches.brandSoundtrack && !switches.focusPlaylist) {
      return NextResponse.json({ enabled: false });
    }

    const { ticketId } = await params;
    const [ticket, account] = await Promise.all([
      prisma.ticket.findFirst({
        where: { id: ticketId, creativeId: user.id },
        select: {
          title: true,
          description: true,
          jobType: { select: { name: true, category: true } },
          company: { select: { soundtrackUrl: true } },
        },
      }),
      prisma.userAccount.findUnique({
        where: { id: user.id },
        select: { soundtrackSuggestions: true },
      }),
    ]);
    if (!ticket) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const brand =
      switches.brandSoundtrack && ticket.company?.soundtrackUrl
        ? await getPlaylistInfo(ticket.company.soundtrackUrl)
        : null;

    const suggestionsOn = switches.focusPlaylist && account?.soundtrackSuggestions !== false;
    let suggestions: PlaylistInfo[] = [];
    const asked = req.nextUrl.searchParams.get("mood");
    const mood = isMood(asked)
      ? asked
      : detectMood(
          ticket.title,
          ticket.description,
          ticket.jobType?.name,
          ticket.jobType?.category,
        );
    let moods: { value: string; label: string }[] = [];

    if (suggestionsOn) {
      const links = await getMoodPlaylistLinks();
      const generated = generatedPlaylists();
      // Only moods with a playlist (brandbite's own or the owner's) can be picked.
      moods = MOODS.filter((m) => generated[m] || links[m].length > 0).map((m) => ({
        value: m,
        label: MOOD_LABELS[m],
      }));
      const own = generated[mood];
      suggestions = [
        ...(own ? [own] : []),
        ...(await Promise.all(links[mood].map(getPlaylistInfo))).filter(
          (p): p is PlaylistInfo => p !== null,
        ),
      ];
    }

    if (!brand && suggestions.length === 0 && moods.length === 0) {
      return NextResponse.json({ enabled: false });
    }

    return NextResponse.json({
      enabled: true,
      brand,
      mood: { value: mood, label: MOOD_LABELS[mood] },
      moods,
      suggestions,
      /** Whether the "Don't suggest music" choice applies (suggestions feature is on). */
      canTurnOffSuggestions: suggestionsOn,
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[soundtrack] GET error", err);
    return NextResponse.json({ error: "Failed to load soundtrack" }, { status: 500 });
  }
}
