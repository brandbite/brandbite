// -----------------------------------------------------------------------------
// @file: lib/google/calendar.ts
// @purpose: Calendar API calls used by the consultation feature: create an
//           event with a Meet conference, cancel an event, and a freebusy
//           query (for PR 3's picker grey-out).
//
//           Token refresh is automatic — call ensureFreshAccessToken() before
//           any request. On a refresh, the updated access token + expiry
//           are persisted back on the ConsultationSettings row.
// -----------------------------------------------------------------------------

import type { ConsultationSettings } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { readGoogleOauthConfig, refreshAccessToken, type GoogleOauthConfig } from "./oauth";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/** Typed subset of the Calendar API event resource we care about. */
export type GoogleCalendarEvent = {
  id: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string }[];
  };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  status?: string;
};

export type CreateConsultationEventInput = {
  calendarId: string;
  summary: string;
  description?: string;
  startIso: string; // RFC3339
  endIso: string;
  timeZone?: string;
  attendeeEmails: string[];
};

/** Ensure the ConsultationSettings row has a fresh access token. Returns the
 *  (possibly refreshed) access token. Persists any refresh result back to the
 *  DB so subsequent calls short-circuit. */
export async function ensureFreshAccessToken(
  settings: ConsultationSettings,
): Promise<{ accessToken: string; config: GoogleOauthConfig } | { error: string }> {
  const configOrError = readGoogleOauthConfig();
  if ("error" in configOrError) return { error: configOrError.error };
  const config = configOrError;

  if (!settings.googleRefreshToken) {
    return { error: "Google Calendar is not connected for this workspace." };
  }

  const now = Date.now();
  const expiresAt = settings.googleTokenExpiresAt?.getTime() ?? 0;

  // 60-second leeway so we don't hand off a token about to expire mid-flight.
  if (settings.googleAccessToken && expiresAt - now > 60_000) {
    return { accessToken: settings.googleAccessToken, config };
  }

  // Refresh
  const refreshed = await refreshAccessToken(config, settings.googleRefreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await prisma.consultationSettings.update({
    where: { id: settings.id },
    data: {
      googleAccessToken: refreshed.access_token,
      googleTokenExpiresAt: newExpiresAt,
    },
  });

  return { accessToken: refreshed.access_token, config };
}

async function googleFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CALENDAR_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Google Calendar ${init?.method ?? "GET"} ${path} failed (${res.status}): ${text}`,
    );
  }
  return (await res.json()) as T;
}

/** Create a calendar event with a hangoutsMeet conference request. Google
 *  sends attendees an invite email with the Meet link automatically. */
export async function createConsultationEvent(
  settings: ConsultationSettings,
  input: CreateConsultationEventInput,
): Promise<GoogleCalendarEvent> {
  const ensured = await ensureFreshAccessToken(settings);
  if ("error" in ensured) throw new Error(ensured.error);

  const body = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startIso, timeZone: input.timeZone ?? "UTC" },
    end: { dateTime: input.endIso, timeZone: input.timeZone ?? "UTC" },
    attendees: input.attendeeEmails.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: `brandbite-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    guestsCanInviteOthers: false,
    guestsCanModify: false,
  };

  // sendUpdates=all so Google fires calendar invite emails to attendees.
  // conferenceDataVersion=1 unlocks conference creation.
  const path = `/calendars/${encodeURIComponent(input.calendarId)}/events?sendUpdates=all&conferenceDataVersion=1`;

  return googleFetch<GoogleCalendarEvent>(ensured.accessToken, path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Cancel a previously created event. Google emails a cancellation to attendees. */
export async function cancelConsultationEvent(
  settings: ConsultationSettings,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const ensured = await ensureFreshAccessToken(settings);
  if ("error" in ensured) throw new Error(ensured.error);

  const path = `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`;
  const res = await fetch(`${CALENDAR_API_BASE}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${ensured.accessToken}`,
    },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Calendar event cancel failed (${res.status}): ${text}`);
  }
}

/** Pull the Meet/Hangouts URL from a created event. Returns null if the event
 *  didn't come back with one (rare but possible on free Gmail accounts that
 *  haven't set up Meet yet). */
export function extractMeetLink(event: GoogleCalendarEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const videoEntry = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
  return videoEntry?.uri ?? null;
}

export type FreeBusyInterval = { start: string; end: string };

/** Query freebusy on the configured calendar and return busy intervals
 *  within [timeMinIso, timeMaxIso]. Used to grey out unavailable slots
 *  on the customer consultation picker. */
export async function queryFreeBusy(
  settings: ConsultationSettings,
  timeMinIso: string,
  timeMaxIso: string,
): Promise<FreeBusyInterval[]> {
  const ensured = await ensureFreshAccessToken(settings);
  if ("error" in ensured) throw new Error(ensured.error);

  const calendarId = settings.googleCalendarId ?? "primary";

  const body = {
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    items: [{ id: calendarId }],
  };

  type Response = {
    calendars: Record<
      string,
      { busy?: FreeBusyInterval[]; errors?: { domain: string; reason: string }[] }
    >;
  };

  const json = await googleFetch<Response>(ensured.accessToken, "/freeBusy", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const cal = json.calendars?.[calendarId];
  if (cal?.errors?.length) {
    console.warn("[google.freeBusy] calendar errors", cal.errors);
    return [];
  }
  return cal?.busy ?? [];
}
