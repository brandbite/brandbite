// -----------------------------------------------------------------------------
// @file: tests/integration/slack-integration.test.ts
// @purpose: Slack against a real Postgres with Slack's endpoints faked:
//           connect saves the channel's webhook (encrypted) and says hello,
//           request updates post once to the company's channel, a removed
//           webhook marks the connection for reconnecting, disconnect revokes.
// -----------------------------------------------------------------------------

import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUserOrThrow: () => mockGetUser() }));

import { prisma } from "@/lib/prisma";
import { GET as connect } from "@/app/api/customer/integrations/slack/connect/route";
import { GET as callback } from "@/app/api/customer/integrations/slack/callback/route";
import { DELETE as disconnect } from "@/app/api/customer/integrations/[provider]/route";
import { saveCompanyIntegration } from "@/lib/integrations/company-integrations";
import { notifyCompanySlack, slackEventForStatusChange } from "@/lib/integrations/slack";
import { resetDatabase } from "./helpers/db";
import { addCompanyMember, createCompany, createTicket, createUser } from "./helpers/fixtures";

const ORIGIN = "https://brandbite.test";
const HOOK = "https://hooks.slack.test/services/T1/B1/x";
const COOKIE = "brandbite_slack_oauth_state";
let companyId: string;
let ownerId: string;
let ticketId: string;
let posts: { url: string; body: Record<string, unknown> }[];
let hookStatus: number;

function fakeSlack() {
  posts = [];
  hookStatus = 200;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://slack.com/api/oauth.v2.access") {
        return Response.json({
          ok: true,
          access_token: "xoxb-1",
          team: { name: "Acme" },
          incoming_webhook: { channel: "#design-updates", url: HOOK },
        });
      }
      if (url === "https://slack.com/api/auth.revoke") {
        posts.push({ url, body: {} });
        return Response.json({ ok: true });
      }
      if (url === HOOK) {
        posts.push({ url, body: JSON.parse(String(init?.body)) });
        return hookStatus === 200
          ? new Response("ok")
          : new Response("no_service", { status: hookStatus });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }),
  );
}

const connectSlack = () =>
  saveCompanyIntegration({
    companyId,
    provider: "SLACK",
    connectedByUserId: ownerId,
    accountLabel: "#design-updates · Acme",
    secrets: { accessToken: "xoxb-1", webhookUrl: HOOK },
  });

beforeEach(async () => {
  await resetDatabase();
  process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.SLACK_CLIENT_ID = "c";
  process.env.SLACK_CLIENT_SECRET = "s";
  process.env.SLACK_ENABLED = "true";
  process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
  const company = await createCompany();
  const owner = await createUser();
  await addCompanyMember(company.id, owner.id, "OWNER");
  const project = await prisma.project.create({
    data: { id: `p-${company.id}`, companyId: company.id, name: "Website", code: "WEB" },
  });
  const ticket = await createTicket({ companyId: company.id, createdById: owner.id });
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { projectId: project.id, companyTicketNumber: 101, title: "Spring <poster>" },
  });
  companyId = company.id;
  ownerId = owner.id;
  ticketId = ticket.id;
  mockGetUser.mockResolvedValue({
    id: ownerId,
    role: "CUSTOMER",
    activeCompanyId: companyId,
    companyRole: "OWNER",
  });
  fakeSlack();
});

afterEach(() => vi.unstubAllGlobals());

describe("Slack connect", () => {
  it("asks only for an incoming webhook, saves it encrypted and says hello", async () => {
    const res = await connect(new NextRequest(`${ORIGIN}/api/customer/integrations/slack/connect`));
    const location = new URL(res.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe("https://slack.com/oauth/v2/authorize");
    expect(location.searchParams.get("scope")).toBe("incoming-webhook");
    const cookie = /brandbite_slack_oauth_state=([^;]+)/.exec(
      res.headers.get("set-cookie") ?? "",
    )![1];

    const back = await callback(
      new NextRequest(
        `${ORIGIN}/api/customer/integrations/slack/callback?code=abc&state=${location.searchParams.get("state")}`,
        { headers: { cookie: `${COOKIE}=${cookie}` } },
      ),
    );
    expect(new URL(back.headers.get("Location")!).searchParams.get("result")).toBe("connected");
    const row = await prisma.companyIntegration.findFirstOrThrow({ where: { companyId } });
    expect(row).toMatchObject({
      provider: "SLACK",
      status: "CONNECTED",
      accountLabel: "#design-updates · Acme",
    });
    expect(row.webhookUrlEnc).not.toContain("hooks.slack");
    expect(String(posts[0].body.text)).toContain("brandbite is connected");
  });

  it("revokes Slack's access on disconnect", async () => {
    await connectSlack();
    const res = await disconnect(new Request("http://x"), {
      params: Promise.resolve({ provider: "slack" }),
    });
    expect(res.status).toBe(200);
    expect(posts.some((p) => p.url.endsWith("/auth.revoke"))).toBe(true);
    expect(await prisma.companyIntegration.count()).toBe(0);
  });
});

describe("Slack updates", () => {
  it("posts once to the company's channel with a link to the request", async () => {
    await connectSlack();
    await notifyCompanySlack(ticketId, "READY_FOR_REVIEW");
    expect(posts).toHaveLength(1);
    const body = posts[0].body as { text: string; blocks: { text: { text: string } }[] };
    expect(body.text).toBe("WEB-101 Spring <poster> is ready for your review.");
    // Slack mrkdwn: escaped title, link to the customer's request page.
    expect(body.blocks[0].text.text).toBe(
      `:eyes: *<${ORIGIN}/customer/tickets/${ticketId}|WEB-101 Spring &lt;poster&gt;>* is ready for your review.`,
    );
  });

  it("stays quiet when Slack isn't connected", async () => {
    await notifyCompanySlack(ticketId, "DONE");
    expect(posts).toHaveLength(0);
  });

  it("marks the connection for reconnecting when Slack removed the webhook", async () => {
    await connectSlack();
    hookStatus = 404;
    await notifyCompanySlack(ticketId, "DONE");
    const row = await prisma.companyIntegration.findFirstOrThrow({ where: { companyId } });
    expect(row.status).toBe("BROKEN");
    await notifyCompanySlack(ticketId, "DONE");
    expect(posts).toHaveLength(1);
  });

  it("maps status moves to updates, but not pulling work back", () => {
    expect(slackEventForStatusChange("IN_PROGRESS", "IN_REVIEW")).toBe("READY_FOR_REVIEW");
    expect(slackEventForStatusChange("TODO", "IN_PROGRESS")).toBe("WORK_STARTED");
    expect(slackEventForStatusChange("IN_REVIEW", "IN_PROGRESS")).toBeNull();
    expect(slackEventForStatusChange("IN_REVIEW", "DONE")).toBe("DONE");
  });
});
