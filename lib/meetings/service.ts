// -----------------------------------------------------------------------------
// @file: lib/meetings/service.ts
// @purpose: Booking, rescheduling and canceling public meetings with the host.
//           Times are only offered when the calendars can actually be read. A slot
//           is claimed in the database before Google is called, so two visitors
//           can't book the same time, and the claim is released if Google fails.
// -----------------------------------------------------------------------------

import { createHash, randomBytes } from "node:crypto";

import type { ConsultationSettings, Meeting } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { getConsultationSettings } from "@/lib/consultation/settings";
import { sendNotificationEmail } from "@/lib/email";
import { renderMeetingEmail, type MeetingEmailKind } from "@/lib/email-templates/meeting/update";
import { BRAND_WEBSITE } from "@/lib/email-templates/tokens";
import {
  cancelConsultationEvent,
  createConsultationEvent,
  extractMeetLink,
  queryBusyStrict,
} from "@/lib/google/calendar";
import { prisma } from "@/lib/prisma";

import { buildMeetingSlots, MEETING_MINUTES } from "./slots";

/** The only person who takes these meetings. */
export const MEETING_HOST_EMAIL = "olca@brandbite.studio";

const FALLBACK_TIME_ZONE = "UTC";

export class MeetingError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "MeetingError";
  }
}

const SLOT_TAKEN = "That time was just taken. Please choose another one.";
const CALENDAR_FAILED =
  "We couldn't reach the calendar. Your time wasn't booked; please try again.";

export function hashManageToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isHostCalendar(settings: ConsultationSettings): boolean {
  return settings.googleAccountEmail?.toLowerCase() === MEETING_HOST_EMAIL;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** Slots open right now. Throws if a calendar can't be read. */
async function loadOpenSlots(settings: ConsultationSettings, now: Date): Promise<string[]> {
  if (!settings.googleRefreshToken) throw new Error("Google Calendar is not connected.");

  const until = new Date(now.getTime() + settings.maxBookingDays * 24 * 60 * 60 * 1000);
  const connected = settings.googleCalendarId ?? "primary";
  const calendars = isHostCalendar(settings) ? [connected] : [connected, MEETING_HOST_EMAIL];

  const [googleBusy, booked] = await Promise.all([
    queryBusyStrict(settings, calendars, now.toISOString(), until.toISOString()),
    prisma.meeting.findMany({
      where: { activeSlot: { gte: now } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  return buildMeetingSlots({
    now,
    workingDays: settings.workingDays,
    workingHourStart: settings.workingHourStart,
    workingHourEnd: settings.workingHourEnd,
    minNoticeHours: settings.minNoticeHours,
    maxBookingDays: settings.maxBookingDays,
    timeZone: settings.companyTimezone || FALLBACK_TIME_ZONE,
    busy: [
      ...googleBusy,
      ...booked.map((m) => ({ start: m.startsAt.toISOString(), end: m.endsAt.toISOString() })),
    ],
  });
}

/** Open slots for the booking page. An unreadable calendar means no slots, never all of them. */
export async function getMeetingAvailability(): Promise<{ available: boolean; slots: string[] }> {
  try {
    const settings = await getConsultationSettings();
    return { available: true, slots: await loadOpenSlots(settings, new Date()) };
  } catch (err) {
    console.error("[meetings] availability error", err);
    return { available: false, slots: [] };
  }
}

async function requireOpenSlot(settings: ConsultationSettings, startsAt: Date): Promise<void> {
  let slots: string[];
  try {
    slots = await loadOpenSlots(settings, new Date());
  } catch (err) {
    console.error("[meetings] slot check error", err);
    throw new MeetingError(503, CALENDAR_FAILED);
  }
  if (!slots.includes(startsAt.toISOString())) throw new MeetingError(409, SLOT_TAKEN);
}

async function createCalendarEvent(settings: ConsultationSettings, meeting: Meeting) {
  // The visitor's own text stays out of the invite. Google sends it to whichever
  // address was typed, so it must not be a way to message a third party.
  return createConsultationEvent(settings, {
    calendarId: settings.googleCalendarId ?? "primary",
    summary: "Brandbite intro call",
    description: `A ${MEETING_MINUTES}-minute call with Brandbite.`,
    startIso: meeting.startsAt.toISOString(),
    endIso: meeting.endsAt.toISOString(),
    timeZone: "UTC",
    attendeeEmails: isHostCalendar(settings)
      ? [meeting.email]
      : [meeting.email, MEETING_HOST_EMAIL],
  });
}

function manageUrl(token: string): string {
  return `${BRAND_WEBSITE}/meetings/${token}`;
}

/** Emails are best-effort: Google's invite already has the time and the Meet link. */
async function notify(meeting: Meeting, kind: MeetingEmailKind, token: string | null) {
  const send = async (audience: "visitor" | "host", to: string) => {
    const email = await renderMeetingEmail({
      kind,
      audience,
      visitorName: meeting.name,
      visitorEmail: meeting.email,
      company: meeting.company,
      note: meeting.note,
      startsAt: meeting.startsAt.toISOString(),
      timeZone: audience === "visitor" ? meeting.timezone : null,
      videoLink: meeting.videoLink,
      manageUrl: token ? manageUrl(token) : null,
    });
    await sendNotificationEmail(to, email.subject, email.html);
  };
  const results = await Promise.allSettled([
    send("visitor", meeting.email),
    send("host", MEETING_HOST_EMAIL),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.error("[meetings] email error", result.reason);
  }
}

export type BookMeetingInput = {
  name: string;
  email: string;
  company?: string | null;
  note?: string | null;
  timezone?: string | null;
  startsAt: Date;
  ipAddress?: string | null;
};

export async function bookMeeting(input: BookMeetingInput): Promise<{
  meeting: Meeting;
  token: string;
}> {
  const settings = await getConsultationSettings();
  await requireOpenSlot(settings, input.startsAt);

  const token = randomBytes(32).toString("base64url");
  let meeting: Meeting;
  try {
    meeting = await prisma.meeting.create({
      data: {
        name: input.name,
        email: input.email,
        company: input.company?.trim() || null,
        note: input.note?.trim() || null,
        timezone: input.timezone || null,
        startsAt: input.startsAt,
        endsAt: new Date(input.startsAt.getTime() + MEETING_MINUTES * 60 * 1000),
        activeSlot: input.startsAt,
        manageTokenHash: hashManageToken(token),
        ipAddress: input.ipAddress || null,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new MeetingError(409, SLOT_TAKEN);
    throw err;
  }

  let event;
  try {
    event = await createCalendarEvent(settings, meeting);
  } catch (err) {
    console.error("[meetings] event create error", err);
    await prisma.meeting.delete({ where: { id: meeting.id } });
    throw new MeetingError(502, CALENDAR_FAILED);
  }

  const updated = await prisma.meeting.update({
    where: { id: meeting.id },
    data: { googleEventId: event.id, videoLink: extractMeetLink(event) },
  });
  await notify(updated, "confirmed", token);
  return { meeting: updated, token };
}

function requireChangeable(meeting: Meeting): void {
  if (meeting.status !== "CONFIRMED") {
    throw new MeetingError(409, "This meeting was already canceled.");
  }
  if (meeting.startsAt.getTime() <= Date.now()) {
    throw new MeetingError(409, "This meeting has already started.");
  }
}

export async function rescheduleMeeting(
  meeting: Meeting,
  startsAt: Date,
  token: string,
): Promise<Meeting> {
  requireChangeable(meeting);
  const settings = await getConsultationSettings();
  await requireOpenSlot(settings, startsAt);

  const moved = {
    ...meeting,
    startsAt,
    endsAt: new Date(startsAt.getTime() + MEETING_MINUTES * 60 * 1000),
  };
  try {
    await prisma.meeting.update({ where: { id: meeting.id }, data: { activeSlot: startsAt } });
  } catch (err) {
    if (isUniqueViolation(err)) throw new MeetingError(409, SLOT_TAKEN);
    throw err;
  }

  let event;
  try {
    event = await createCalendarEvent(settings, moved);
  } catch (err) {
    console.error("[meetings] reschedule error", err);
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { activeSlot: meeting.startsAt },
    });
    throw new MeetingError(502, CALENDAR_FAILED);
  }

  if (meeting.googleEventId) {
    try {
      await cancelConsultationEvent(
        settings,
        settings.googleCalendarId ?? "primary",
        meeting.googleEventId,
      );
    } catch (err) {
      // The new time is booked. A leftover old event is visible and easy to remove.
      console.error("[meetings] old event cancel error", err);
    }
  }

  const updated = await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      startsAt,
      endsAt: moved.endsAt,
      googleEventId: event.id,
      videoLink: extractMeetLink(event),
    },
  });
  await notify(updated, "rescheduled", token);
  return updated;
}

export async function cancelMeeting(meeting: Meeting): Promise<Meeting> {
  requireChangeable(meeting);
  if (meeting.googleEventId) {
    const settings = await getConsultationSettings();
    try {
      await cancelConsultationEvent(
        settings,
        settings.googleCalendarId ?? "primary",
        meeting.googleEventId,
      );
    } catch (err) {
      console.error("[meetings] cancel error", err);
      throw new MeetingError(502, "We couldn't reach the calendar. Please try again.");
    }
  }
  const updated = await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "CANCELED", activeSlot: null },
  });
  await notify(updated, "canceled", null);
  return updated;
}
