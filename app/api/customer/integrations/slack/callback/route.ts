// -----------------------------------------------------------------------------
// @file: app/api/customer/integrations/slack/callback/route.ts
// @purpose: Slack's answer to the consent screen: check the state, exchange
//           the code, save the channel's webhook (encrypted) and post a short
//           hello there. Ends on Settings → Integrations.
// -----------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { saveCompanyIntegration } from "@/lib/integrations/company-integrations";
import {
  clearOAuthState,
  integrationsRedirectUrl,
  readOAuthState,
} from "@/lib/integrations/oauth-state";
import {
  exchangeSlackCode,
  postToSlackWebhook,
  readSlackConfig,
  SLACK_SCOPES,
  slackAccountLabel,
} from "@/lib/integrations/slack";
import { canManageIntegrations, normalizeCompanyRole } from "@/lib/permissions/companyRoles";

const SLUG = "slack";

export async function GET(req: NextRequest) {
  const finish = (result: "connected" | "error", message?: string) => {
    const res = NextResponse.redirect(integrationsRedirectUrl(req.url, SLUG, result, message));
    clearOAuthState(res, SLUG);
    return res;
  };
  try {
    const user = await getCurrentUserOrThrow();
    const url = new URL(req.url);
    if (url.searchParams.get("error")) {
      return finish("error", "Slack wasn't connected: access was not granted.");
    }
    const companyId = readOAuthState(req, SLUG, url.searchParams.get("state"));
    const code = url.searchParams.get("code");
    if (!companyId || !code) {
      return finish("error", "That sign-in link expired. Please try connecting again.");
    }
    if (
      user.role !== "CUSTOMER" ||
      user.activeCompanyId !== companyId ||
      !canManageIntegrations(normalizeCompanyRole(user.companyRole))
    ) {
      return finish("error", "Only company owners or project managers can connect Slack.");
    }

    const config = readSlackConfig(req.url);
    if ("error" in config) return finish("error", "Slack isn't available yet.");

    const result = await exchangeSlackCode(config, code);
    const label = slackAccountLabel(result.channel, result.teamName);

    await saveCompanyIntegration({
      companyId,
      provider: "SLACK",
      connectedByUserId: user.id,
      accountLabel: label,
      scopes: SLACK_SCOPES,
      externalRootId: null,
      secrets: { accessToken: result.accessToken, webhookUrl: result.webhookUrl },
    });

    // A hello in the channel, so the team knows where updates will come from.
    await postToSlackWebhook(result.webhookUrl, {
      text: "brandbite is connected. Updates on your requests will appear here: work ready for review, work started, requests done, and source files about to be deleted.",
    }).catch((err) => console.warn("[integrations.slack] hello post failed", err));

    return finish("connected", label ?? undefined);
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    console.error("[integrations.slack] callback error", error);
    return finish("error", "Slack couldn't be connected. Please try again.");
  }
}
