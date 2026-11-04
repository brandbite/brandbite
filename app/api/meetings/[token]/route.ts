// -----------------------------------------------------------------------------
// @file: app/api/meetings/[token]/route.ts
// @purpose: The visitor's manage link: view, reschedule or cancel their meeting.
//           Possession of the secret token is the only credential, so an unknown
//           token and a wrong one look identical.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import {
  cancelMeeting,
  hashManageToken,
  MeetingError,
  rescheduleMeeting,
} from "@/lib/meetings/service";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/schemas/helpers";
import { rescheduleMeetingSchema } from "@/lib/schemas/meeting.schemas";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

const NOT_FOUND = () => NextResponse.json({ error: "Meeting not found." }, { status: 404 });

async function findMeeting(token: string) {
  return prisma.meeting.findUnique({ where: { manageTokenHash: hashManageToken(token) } });
}

function present(meeting: NonNullable<Awaited<ReturnType<typeof findMeeting>>>) {
  return {
    name: meeting.name,
    startsAt: meeting.startsAt.toISOString(),
    status: meeting.status,
    videoLink: meeting.status === "CONFIRMED" ? meeting.videoLink : null,
  };
}

function toErrorResponse(err: unknown, method: string) {
  if (err instanceof MeetingError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(`[api/meetings/:token] ${method} error`, err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

async function limited(req: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIp(req.headers);
  const bucket = await rateLimit(`meetings:manage:${ip}`, { limit: 30, windowSeconds: 60 });
  return bucket.allowed
    ? null
    : NextResponse.json({ error: "Too many requests. Please try again soon." }, { status: 429 });
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const blocked = await limited(req);
  if (blocked) return blocked;
  try {
    const meeting = await findMeeting((await params).token);
    if (!meeting) return NOT_FOUND();
    return NextResponse.json(
      { meeting: present(meeting) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return toErrorResponse(err, "GET");
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const blocked = await limited(req);
  if (blocked) return blocked;
  try {
    const { token } = await params;
    const meeting = await findMeeting(token);
    if (!meeting) return NOT_FOUND();
    const parsed = await parseBody(req, rescheduleMeetingSchema);
    if (!parsed.success) return parsed.response;
    const updated = await rescheduleMeeting(meeting, parsed.data.startsAt, token);
    return NextResponse.json({ meeting: present(updated) });
  } catch (err) {
    return toErrorResponse(err, "PATCH");
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const blocked = await limited(req);
  if (blocked) return blocked;
  try {
    const meeting = await findMeeting((await params).token);
    if (!meeting) return NOT_FOUND();
    const updated = await cancelMeeting(meeting);
    return NextResponse.json({ meeting: present(updated) });
  } catch (err) {
    return toErrorResponse(err, "DELETE");
  }
}
