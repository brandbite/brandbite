// -----------------------------------------------------------------------------
// @file: tests/integration/engagement.test.ts
// @purpose: The engagement features against a real database: owner switches
//           gate each API, thank-yous are once per approved request and reach
//           the creative, live progress hides time totals, the brand
//           soundtrack is company-admin only, and the first-pass streak
//           counts back to the last revision request.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));
// Soundtrack names come from Spotify's oEmbed; keep the tests offline.
vi.stubGlobal(
  "fetch",
  vi.fn(async () => new Response(JSON.stringify({ title: "Test Playlist" }))),
);

import { GET as appreciationGet } from "@/app/api/creative/appreciation/route";
import { GET as progressGet } from "@/app/api/creative/progress/route";
import { GET as soundtrackGet } from "@/app/api/creative/tickets/[ticketId]/soundtrack/route";
import {
  GET as brandSoundtrackGet,
  PUT as brandSoundtrackPut,
} from "@/app/api/customer/brand-soundtrack/route";
import { GET as liveProgressGet } from "@/app/api/customer/tickets/[ticketId]/live-progress/route";
import { POST as thanksPost } from "@/app/api/customer/tickets/[ticketId]/thanks/route";
import { ENGAGEMENT_SWITCHES, type EngagementFeature } from "@/lib/engagement/switches";
import { prisma } from "@/lib/prisma";

import { resetDatabase } from "./helpers/db";
import { addCompanyMember, createCompany, createTicket, createUser } from "./helpers/fixtures";

const PLAYLIST = "https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ";

async function switchOn(...features: EngagementFeature[]) {
  for (const feature of features) {
    await prisma.appSetting.create({ data: { key: ENGAGEMENT_SWITCHES[feature], value: "true" } });
  }
}

const params = (ticketId: string) => ({ params: Promise.resolve({ ticketId }) });
const json = (url: string, method: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

async function world(role: "OWNER" | "MEMBER" = "OWNER") {
  const company = await createCompany();
  const customer = await createUser({ role: "CUSTOMER" });
  await addCompanyMember(company.id, customer.id, role);
  const creative = await createUser({ role: "DESIGNER" });
  const asCustomer = () =>
    mockGetUser.mockResolvedValue({
      id: customer.id,
      role: "CUSTOMER",
      activeCompanyId: company.id,
    });
  const asCreative = () => mockGetUser.mockResolvedValue({ id: creative.id, role: "DESIGNER" });
  return { company, customer, creative, asCustomer, asCreative };
}

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();
});

describe("thank-yous", () => {
  it("are refused while the owner's switch is off", async () => {
    const w = await world();
    const ticket = await createTicket({
      companyId: w.company.id,
      createdById: w.customer.id,
      creativeId: w.creative.id,
      status: "DONE",
    });
    w.asCustomer();
    const res = await thanksPost(json("/x", "POST", { tags: ["NAILED_BRIEF"] }), params(ticket.id));
    expect(res.status).toBe(404);
    expect(await prisma.ticketThanks.count()).toBe(0);
  });

  it("go to the creative once, only for an approved request", async () => {
    await switchOn("thankYous");
    const w = await world();
    const open = await createTicket({
      companyId: w.company.id,
      createdById: w.customer.id,
      creativeId: w.creative.id,
      status: "IN_REVIEW",
    });
    const done = await createTicket({
      companyId: w.company.id,
      createdById: w.customer.id,
      creativeId: w.creative.id,
      status: "DONE",
    });
    w.asCustomer();
    const send = (id: string, tags: unknown) =>
      thanksPost(json("/x", "POST", { tags }), params(id));

    expect((await send(open.id, ["NAILED_BRIEF"])).status).toBe(409);
    expect((await send(done.id, ["made-up"])).status).toBe(400);
    expect((await send(done.id, ["GREAT_COMMUNICATION", "NAILED_BRIEF"])).status).toBe(201);
    expect((await send(done.id, ["QUICK_TURNAROUND"])).status).toBe(409);

    const note = await prisma.notification.findFirst({ where: { userId: w.creative.id } });
    expect(note?.type).toBe("THANKS_RECEIVED");
    expect(note?.message).toContain("Nailed the brief and Great communication");

    w.asCreative();
    const mine = await (await appreciationGet()).json();
    expect(mine.totals).toEqual({ NAILED_BRIEF: 1, QUICK_TURNAROUND: 0, GREAT_COMMUNICATION: 1 });
    expect(mine.byTicket[done.id]).toEqual(["NAILED_BRIEF", "GREAT_COMMUNICATION"]);
  });

  it("can't be sent for another company's request", async () => {
    await switchOn("thankYous");
    const w = await world();
    const other = await world();
    const theirs = await createTicket({
      companyId: other.company.id,
      createdById: other.customer.id,
      creativeId: other.creative.id,
      status: "DONE",
    });
    w.asCustomer();
    const res = await thanksPost(json("/x", "POST", { tags: ["NAILED_BRIEF"] }), params(theirs.id));
    expect(res.status).toBe(404);
  });
});

describe("live progress", () => {
  it("shows the running sitting but never past time", async () => {
    await switchOn("liveProgress");
    const w = await world();
    const ticket = await createTicket({
      companyId: w.company.id,
      createdById: w.customer.id,
      creativeId: w.creative.id,
      status: "IN_PROGRESS",
    });
    const startedAt = new Date(Date.now() - 60_000);
    await prisma.ticketTimeEntry.createMany({
      data: [
        {
          ticketId: ticket.id,
          creativeId: w.creative.id,
          startedAt: new Date(Date.now() - 7_200_000),
          endedAt: new Date(Date.now() - 3_600_000),
          durationSeconds: 3600,
        },
        { ticketId: ticket.id, creativeId: w.creative.id, startedAt },
      ],
    });
    w.asCustomer();
    const body = await (
      await liveProgressGet(new NextRequest("http://localhost/x"), params(ticket.id))
    ).json();
    expect(body).toEqual({
      enabled: true,
      status: "IN_PROGRESS",
      isAssigned: true,
      timerStartedAt: startedAt.toISOString(),
    });
  });

  it("answers enabled: false while switched off", async () => {
    const w = await world();
    const ticket = await createTicket({ companyId: w.company.id, createdById: w.customer.id });
    w.asCustomer();
    const res = await liveProgressGet(new NextRequest("http://localhost/x"), params(ticket.id));
    expect(await res.json()).toEqual({ enabled: false });
  });
});

describe("first-pass streak", () => {
  it("counts approvals back to the last revision request", async () => {
    await switchOn("creativeProgress");
    const w = await world();
    const make = async (daysAgo: number, revisionRequested: boolean) => {
      const ticket = await createTicket({
        companyId: w.company.id,
        createdById: w.customer.id,
        creativeId: w.creative.id,
        status: "DONE",
      });
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { completedAt: new Date(Date.now() - daysAgo * 86_400_000) },
      });
      await prisma.ticketRevision.create({
        data: {
          ticketId: ticket.id,
          version: 1,
          submittedByCreativeId: w.creative.id,
          feedbackAt: revisionRequested ? new Date() : null,
        },
      });
    };
    await make(1, false);
    await make(2, false);
    await make(3, true);
    await make(4, false);

    w.asCreative();
    expect(await (await progressGet()).json()).toEqual({ enabled: true, firstPassStreak: 2 });
  });
});

describe("soundtracks", () => {
  it("lets an owner set the brand soundtrack and shows it to the creative", async () => {
    await switchOn("brandSoundtrack");
    const w = await world("OWNER");
    const ticket = await createTicket({
      companyId: w.company.id,
      createdById: w.customer.id,
      creativeId: w.creative.id,
      status: "IN_PROGRESS",
    });
    w.asCustomer();
    const put = (url: string) => brandSoundtrackPut(json("/x", "PUT", { url }));

    expect((await put("https://example.com/not-spotify")).status).toBe(400);
    expect((await put(`${PLAYLIST}?si=share`)).status).toBe(200);
    const saved = await prisma.company.findUnique({ where: { id: w.company.id } });
    expect(saved?.soundtrackUrl).toBe(PLAYLIST);
    expect((await (await brandSoundtrackGet()).json()).soundtrack.title).toBe("Test Playlist");

    w.asCreative();
    const card = await (
      await soundtrackGet(new NextRequest("http://localhost/x"), params(ticket.id))
    ).json();
    expect(card.enabled).toBe(true);
    expect(card.brand.url).toBe(PLAYLIST);
    expect(card.suggestions).toEqual([]);
  });

  it("doesn't let a regular member change it", async () => {
    await switchOn("brandSoundtrack");
    const w = await world("MEMBER");
    w.asCustomer();
    const res = await brandSoundtrackPut(json("/x", "PUT", { url: PLAYLIST }));
    expect(res.status).toBe(403);
  });

  it("suggests playlists for the mood unless the creative turned them off", async () => {
    await switchOn("focusPlaylist");
    await prisma.appSetting.create({
      data: { key: "SOUNDTRACK_PLAYLISTS_MINIMAL", value: PLAYLIST },
    });
    const w = await world();
    const ticket = await createTicket({
      companyId: w.company.id,
      createdById: w.customer.id,
      creativeId: w.creative.id,
      status: "IN_PROGRESS",
    });
    w.asCreative();
    const get = async () =>
      (await soundtrackGet(new NextRequest("http://localhost/x"), params(ticket.id))).json();

    const on = await get();
    expect(on.mood.value).toBe("MINIMAL");
    // brandbite's own playlist for the mood comes first, then the owner's.
    const urls = on.suggestions.map((s: { url: string }) => s.url);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toBe(PLAYLIST);
    expect(on.suggestions[0].title).toBe("brandbite · Minimal");

    await prisma.userAccount.update({
      where: { id: w.creative.id },
      data: { soundtrackSuggestions: false },
    });
    expect(await get()).toEqual({ enabled: false });
  });
});
