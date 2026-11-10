// -----------------------------------------------------------------------------
// @file: lib/integrations/slack.ts
// @purpose: Slack notifications for a customer company. The Slack app asks
//           only for `incoming-webhook`: on Slack's consent screen the
//           customer picks one channel, and we get a webhook that can post
//           there and nothing else (no reading messages, no other channels).
//
//           We post once per event to the company's channel: work ready for
//           review, work started, request done, source files about to be
//           deleted. Posting is best effort and never blocks the action; a
//           webhook Slack has removed marks the connection "Needs reconnecting".
// -----------------------------------------------------------------------------

import {
  getCompanyIntegrationSecrets,
  isProviderAvailable,
  markIntegrationBroken,
} from "./company-integrations";
import { prisma } from "@/lib/prisma";
import { buildTicketCode } from "@/lib/ticket-code";

const AUTHORIZE = "https://slack.com/oauth/v2/authorize";
const API = "https://slack.com/api";

export const SLACK_CALLBACK_PATH = "/api/customer/integrations/slack/callback";
export const SLACK_SCOPES = "incoming-webhook";

export type SlackConfig = { clientId: string; clientSecret: string; redirectUri: string };

export function readSlackConfig(
  origin: string,
  env: NodeJS.ProcessEnv = process.env,
): SlackConfig | { error: string } {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    return { error: "Missing env var(s): SLACK_CLIENT_ID, SLACK_CLIENT_SECRET" };
  }
  return {
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
    redirectUri: new URL(SLACK_CALLBACK_PATH, origin).toString(),
  };
}

export function buildSlackAuthorizeUrl(config: SlackConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: SLACK_SCOPES,
    redirect_uri: config.redirectUri,
    state,
  });
  return `${AUTHORIZE}?${params.toString()}`;
}

export type SlackOAuthResult = {
  accessToken: string;
  teamName: string | null;
  channel: string | null;
  webhookUrl: string;
};

export async function exchangeSlackCode(
  config: SlackConfig,
  code: string,
): Promise<SlackOAuthResult> {
  const res = await fetch(`${API}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }).toString(),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    access_token?: string;
    team?: { name?: string };
    incoming_webhook?: { channel?: string; url?: string };
  } | null;
  if (!json?.ok || !json.access_token || !json.incoming_webhook?.url) {
    throw new Error(`Slack oauth.v2.access failed: ${json?.error ?? res.status}`);
  }
  return {
    accessToken: json.access_token,
    teamName: json.team?.name ?? null,
    channel: json.incoming_webhook.channel ?? null,
    webhookUrl: json.incoming_webhook.url,
  };
}

/** "#design-updates · Acme" for "Connected as …". */
export function slackAccountLabel(channel: string | null, teamName: string | null): string | null {
  return [channel, teamName].filter(Boolean).join(" · ") || null;
}

export async function revokeSlackToken(accessToken: string): Promise<void> {
  try {
    await fetch(`${API}/auth.revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    // best effort: the row is removed either way
  }
}

// -----------------------------------------------------------------------------
// Posting
// -----------------------------------------------------------------------------

export type SlackRequestEvent = "READY_FOR_REVIEW" | "WORK_STARTED" | "DONE" | "FILES_EXPIRING";

const EVENT_TEXT: Record<SlackRequestEvent, { emoji: string; text: string }> = {
  READY_FOR_REVIEW: { emoji: ":eyes:", text: "is ready for your review" },
  WORK_STARTED: { emoji: ":art:", text: "is in progress: your creative started work" },
  DONE: { emoji: ":white_check_mark:", text: "is done" },
  FILES_EXPIRING: {
    emoji: ":hourglass_flowing_sand:",
    text: "has source files that will be deleted soon",
  },
};

/** Slack's mrkdwn needs &, < and > escaped. */
function slackEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildSlackMessage(input: {
  event: SlackRequestEvent;
  code: string;
  title: string;
  url: string;
  detail?: string | null;
}) {
  const { emoji, text } = EVENT_TEXT[input.event];
  const headline = `${emoji} *<${input.url}|${slackEscape(`${input.code} ${input.title}`)}>* ${text}.`;
  return {
    // Fallback for notifications and clients without blocks.
    text: `${input.code} ${input.title} ${text}.`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: headline } },
      ...(input.detail
        ? [{ type: "context", elements: [{ type: "mrkdwn", text: slackEscape(input.detail) }] }]
        : []),
    ],
    unfurl_links: false,
  };
}

/** Post to a webhook. True when Slack took it; throws GoneError when the webhook is gone. */
export class SlackWebhookGoneError extends Error {}

export async function postToSlackWebhook(webhookUrl: string, payload: unknown): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  // Slack answers 404 / 410 (no_service, channel_not_found, channel_is_archived)
  // when the app was removed or the channel is gone.
  if (
    res.status === 404 ||
    res.status === 410 ||
    /no_service|channel_not_found|channel_is_archived|no_active_hooks/.test(text)
  ) {
    throw new SlackWebhookGoneError(text || String(res.status));
  }
  throw new Error(`Slack webhook failed (${res.status}): ${text}`);
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://brandbite.studio").replace(/\/$/, "");
}

/**
 * Tell the request's company in Slack, when it has connected Slack. Best
 * effort: never throws, so callers can fire and forget.
 */
export async function notifyCompanySlack(
  ticketId: string,
  event: SlackRequestEvent,
  detail?: string | null,
): Promise<void> {
  try {
    if (!isProviderAvailable("SLACK")) return;
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        companyId: true,
        companyTicketNumber: true,
        project: { select: { code: true } },
      },
    });
    if (!ticket?.companyId) return;
    const secrets = await getCompanyIntegrationSecrets(ticket.companyId, "SLACK");
    if (!secrets || secrets.status !== "CONNECTED" || !secrets.webhookUrl) return;

    const code = buildTicketCode({
      projectCode: ticket.project?.code,
      companyTicketNumber: ticket.companyTicketNumber,
      ticketId: ticket.id,
    });
    const payload = buildSlackMessage({
      event,
      code,
      title: ticket.title,
      url: `${appUrl()}/customer/tickets/${ticket.id}`,
      detail,
    });
    try {
      await postToSlackWebhook(secrets.webhookUrl, payload);
    } catch (error) {
      if (error instanceof SlackWebhookGoneError) {
        await markIntegrationBroken(secrets.id, `Slack removed the webhook: ${error.message}`);
        return;
      }
      throw error;
    }
  } catch (error) {
    console.warn("[slack] post failed", ticketId, event, error);
  }
}

/** Which Slack update a status move is, if any (pulling work back isn't one). */
export function slackEventForStatusChange(
  previous: string | null | undefined,
  next: string,
): SlackRequestEvent | null {
  if (next === "IN_REVIEW" && previous !== "IN_REVIEW") return "READY_FOR_REVIEW";
  if (next === "IN_PROGRESS" && previous === "TODO") return "WORK_STARTED";
  if (next === "DONE" && previous !== "DONE") return "DONE";
  return null;
}
