// -----------------------------------------------------------------------------
// @file: tests/integration/source-files.test.ts
// @purpose: Source-file delivery against a real Postgres, with Google Drive
//           and R2 faked: who can see and upload, Drive when connected with
//           brandbite/<Project>/<CODE Title>/ folders reused, R2 fallback
//           (also when the Drive is broken), verification before READY,
//           90-day retention date, remove and download.
// -----------------------------------------------------------------------------

import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser, r2 } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  r2: { sizes: new Map<string, number>(), deleted: [] as string[] },
}));

vi.mock("@/lib/auth", () => ({ getCurrentUserOrThrow: () => mockGetUser() }));
vi.mock("@/lib/source-files/r2-source-files", () => ({
  presignSourceFileUpload: async (key: string) => `https://r2.test/put/${key}`,
  presignSourceFileDownload: async (key: string) => `https://r2.test/get/${key}`,
  sourceFileObjectSize: async (key: string) => r2.sizes.get(key) ?? null,
}));
vi.mock("@/lib/r2", async (orig) => ({
  ...(await orig<typeof import("@/lib/r2")>()),
  deleteR2Objects: async (keys: string[]) => {
    r2.deleted.push(...keys);
  },
}));

import { prisma } from "@/lib/prisma";
import { GET as list, POST as start } from "@/app/api/tickets/[id]/source-files/route";
import { POST as complete } from "@/app/api/tickets/[id]/source-files/[fileId]/complete/route";
import { DELETE as remove } from "@/app/api/tickets/[id]/source-files/[fileId]/route";
import { GET as download } from "@/app/api/tickets/[id]/source-files/[fileId]/download/route";
import { saveCompanyIntegration } from "@/lib/integrations/company-integrations";
import { resetDatabase } from "./helpers/db";
import { addCompanyMember, createCompany, createTicket, createUser } from "./helpers/fixtures";

const ORIGIN = "https://brandbite.test";
const GB = 1024 * 1024 * 1024;

let companyId: string;
let customerId: string;
let creativeId: string;
let ticketId: string;
let drive: {
  folders: { name: string; parent?: string }[];
  sessions: RequestInit[];
  trashed: string[];
  queries: string[];
};

const as = (id: string, role: string) => mockGetUser.mockResolvedValue({ id, role });
const p = (extra: { fileId?: string } = {}) => ({
  params: Promise.resolve({ id: ticketId, fileId: extra.fileId ?? "" }),
});
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

function fakeDrive() {
  drive = { folders: [], sessions: [], trashed: [], queries: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.includes("/upload/drive/v3/files?uploadType=resumable")) {
        drive.sessions.push(init!);
        return new Response("", {
          status: 200,
          headers: { Location: "https://upload.google.test/session-1" },
        });
      }
      if (url.includes("/drive/v3/files?fields=id") && method === "POST") {
        const body = JSON.parse(String(init?.body));
        drive.folders.push({ name: body.name, parent: body.parents?.[0] });
        return json({ id: `folder-${drive.folders.length}` });
      }
      if (url.includes("/drive/v3/files?q=")) {
        drive.queries.push(decodeURIComponent(new URL(url).searchParams.get("q") ?? ""));
        return json({
          files: [
            {
              id: "drive-file-1",
              name: "poster.psd",
              size: String(3 * GB),
              webViewLink: "https://drive.google.test/file/drive-file-1",
            },
          ],
        });
      }
      const fileMatch = /\/drive\/v3\/files\/([^?]+)/.exec(url);
      if (fileMatch && method === "PATCH") {
        drive.trashed.push(fileMatch[1]);
        return json({ id: fileMatch[1] });
      }
      if (fileMatch) {
        const id = decodeURIComponent(fileMatch[1]);
        if (id.startsWith("folder-") || id === "root-folder") {
          return json({ id, trashed: false, mimeType: "application/vnd.google-apps.folder" });
        }
        if (id === "drive-file-1") {
          return json({
            id,
            name: "poster.psd",
            size: String(3 * GB),
            webViewLink: "https://drive.google.test/file/drive-file-1",
            parents: ["folder-2"],
            trashed: false,
          });
        }
        return json({ error: "notFound" }, 404);
      }
      throw new Error(`Unexpected fetch ${method} ${url}`);
    }),
  );
}

async function connectDrive(status: "CONNECTED" | "BROKEN" = "CONNECTED") {
  const saved = await saveCompanyIntegration({
    companyId,
    provider: "GOOGLE_DRIVE",
    connectedByUserId: customerId,
    externalRootId: "root-folder",
    secrets: {
      refreshToken: "r",
      accessToken: "cached-access",
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60_000),
    },
  });
  if (status === "BROKEN") {
    await prisma.companyIntegration.update({ where: { id: saved.id }, data: { status: "BROKEN" } });
  }
}

function startReq(name: string, sizeBytes: number) {
  return new NextRequest(`${ORIGIN}/api/tickets/${ticketId}/source-files`, {
    method: "POST",
    body: JSON.stringify({ name, sizeBytes, mimeType: "image/vnd.adobe.photoshop" }),
  });
}

function completeReq(body: Record<string, unknown> = {}) {
  return new NextRequest(`${ORIGIN}/x`, { method: "POST", body: JSON.stringify(body) });
}

beforeEach(async () => {
  await resetDatabase();
  r2.sizes.clear();
  r2.deleted.length = 0;
  process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.GOOGLE_DRIVE_CLIENT_ID = "client";
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = "secret";
  process.env.GOOGLE_DRIVE_ENABLED = "true";

  const company = await createCompany();
  const customer = await createUser();
  const creative = await createUser({ role: "DESIGNER" });
  await addCompanyMember(company.id, customer.id, "MEMBER");
  const project = await prisma.project.create({
    data: { id: `proj-${company.id}`, companyId: company.id, name: "Website", code: "WEB" },
  });
  const ticket = await createTicket({
    companyId: company.id,
    createdById: customer.id,
    creativeId: creative.id,
    status: "IN_PROGRESS",
  });
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { projectId: project.id, companyTicketNumber: 101, title: "Spring poster" },
  });
  companyId = company.id;
  customerId = customer.id;
  creativeId = creative.id;
  ticketId = ticket.id;
  fakeDrive();
});

afterEach(() => vi.unstubAllGlobals());

describe("who sees and uploads source files", () => {
  it("lists for company members, the assigned creative and admins only", async () => {
    for (const [id, role] of [
      [customerId, "CUSTOMER"],
      [creativeId, "DESIGNER"],
      ["admin", "SITE_ADMIN"],
    ]) {
      as(id, role);
      expect((await list(new NextRequest(`${ORIGIN}/x`), p())).status).toBe(200);
    }
    const stranger = await createUser();
    const otherCreative = await createUser({ role: "DESIGNER" });
    for (const [id, role] of [
      [stranger.id, "CUSTOMER"],
      [otherCreative.id, "DESIGNER"],
    ]) {
      as(id, role);
      expect((await list(new NextRequest(`${ORIGIN}/x`), p())).status).toBe(404);
    }
  });

  it("lets only the assigned creative upload, and only once work has started", async () => {
    as(customerId, "CUSTOMER");
    expect((await start(startReq("a.psd", 10), p())).status).toBe(403);

    await prisma.ticket.update({ where: { id: ticketId }, data: { status: "TODO" } });
    as(creativeId, "DESIGNER");
    expect((await start(startReq("a.psd", 10), p())).status).toBe(403);
    const body = await (await list(new NextRequest(`${ORIGIN}/x`), p())).json();
    expect(body.canUpload).toBe(false);
  });
});

describe("R2 fallback (no Drive connected)", () => {
  it("uploads straight to R2, verifies the size, then lists the file", async () => {
    as(creativeId, "DESIGNER");
    const res = await start(startReq("poster.psd", 1234), p());
    const body = await res.json();
    expect(body).toMatchObject({ storage: "R2" });
    expect(body.uploadUrl).toMatch(/^https:\/\/r2\.test\/put\/tickets\/.+\/source\//);

    const row = await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: body.fileId } });
    expect(row.status).toBe("UPLOADING");
    r2.sizes.set(row.r2Key!, 1234);

    const done = await complete(completeReq(), p({ fileId: body.fileId }));
    expect(done.status).toBe(200);
    as(customerId, "CUSTOMER");
    const listing = await (await list(new NextRequest(`${ORIGIN}/x`), p())).json();
    expect(listing.files).toHaveLength(1);
    expect(listing.files[0]).toMatchObject({ name: "poster.psd", sizeBytes: 1234, storage: "R2" });
    expect(listing.destination).toBe("R2");
  });

  it("marks an incomplete upload as failed and keeps it out of the list", async () => {
    as(creativeId, "DESIGNER");
    const { fileId } = await (await start(startReq("poster.psd", 1234), p())).json();
    const row = await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: fileId } });
    r2.sizes.set(row.r2Key!, 1000);
    expect((await complete(completeReq(), p({ fileId }))).status).toBe(422);
    expect(
      (await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: fileId } })).status,
    ).toBe("FAILED");
    const listing = await (await list(new NextRequest(`${ORIGIN}/x`), p())).json();
    expect(listing.files).toHaveLength(0);
  });

  it("refuses files over 5 GB on R2 and points to Google Drive", async () => {
    as(creativeId, "DESIGNER");
    const res = await start(startReq("huge.psb", 6 * GB), p());
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain("Google Drive");
  });

  it("sets the 90-day deletion date for files delivered after the request is done", async () => {
    const completedAt = new Date("2026-11-01T10:00:00Z");
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: "DONE", completedAt } });
    as(creativeId, "DESIGNER");
    const { fileId } = await (await start(startReq("final.ai", 50), p())).json();
    const row = await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: fileId } });
    r2.sizes.set(row.r2Key!, 50);
    await complete(completeReq(), p({ fileId }));
    const saved = await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: fileId } });
    expect(saved.deleteAfter?.toISOString()).toBe("2027-01-30T10:00:00.000Z");
  });
});

describe("Google Drive delivery", () => {
  it("creates brandbite/<Project>/<CODE Title>/ once and opens an upload session there", async () => {
    await connectDrive();
    as(creativeId, "DESIGNER");
    const body = await (await start(startReq("poster.psd", 3 * GB), p())).json();
    expect(body).toMatchObject({
      storage: "GOOGLE_DRIVE",
      uploadUrl: "https://upload.google.test/session-1",
    });
    expect(drive.folders).toEqual([
      { name: "Website", parent: "root-folder" },
      { name: "WEB-101 Spring poster", parent: "folder-1" },
    ]);
    const session = drive.sessions[0];
    expect((session.headers as Record<string, string>).Origin).toBe(ORIGIN);
    expect(JSON.parse(String(session.body))).toEqual({ name: "poster.psd", parents: ["folder-2"] });

    await start(startReq("second.psd", 10), p());
    expect(drive.folders).toHaveLength(2);
  });

  it("checks the file in Drive before showing it, with the link to open it", async () => {
    await connectDrive();
    as(creativeId, "DESIGNER");
    const { fileId } = await (await start(startReq("poster.psd", 3 * GB), p())).json();
    expect(
      (await complete(completeReq({ externalId: "drive-file-1" }), p({ fileId }))).status,
    ).toBe(200);

    as(customerId, "CUSTOMER");
    const listing = await (await list(new NextRequest(`${ORIGIN}/x`), p())).json();
    expect(listing.files[0]).toMatchObject({
      storage: "GOOGLE_DRIVE",
      externalUrl: "https://drive.google.test/file/drive-file-1",
    });
    const open = await download(new NextRequest(`${ORIGIN}/x`), p({ fileId }));
    expect(open.headers.get("Location")).toBe("https://drive.google.test/file/drive-file-1");
  });

  it("finds the file in the request's folder when the browser couldn't read Drive's answer", async () => {
    await connectDrive();
    as(creativeId, "DESIGNER");
    const { fileId } = await (await start(startReq("poster.psd", 3 * GB), p())).json();
    const done = await complete(completeReq({}), p({ fileId }));
    expect(done.status).toBe(200);
    expect(drive.queries).toEqual([
      "'folder-2' in parents and name = 'poster.psd' and trashed = false",
    ]);
    const row = await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: fileId } });
    expect(row).toMatchObject({ status: "READY", externalId: "drive-file-1" });
  });

  it("falls back to R2 when the Drive needs reconnecting", async () => {
    await connectDrive("BROKEN");
    as(creativeId, "DESIGNER");
    const body = await (await start(startReq("poster.psd", 100), p())).json();
    expect(body.storage).toBe("R2");
    expect(drive.sessions).toHaveLength(0);
  });

  it("trashes the Drive file when the creative removes it", async () => {
    await connectDrive();
    as(creativeId, "DESIGNER");
    const { fileId } = await (await start(startReq("poster.psd", 3 * GB), p())).json();
    await complete(completeReq({ externalId: "drive-file-1" }), p({ fileId }));
    expect((await remove(new NextRequest(`${ORIGIN}/x`), p({ fileId }))).status).toBe(200);
    expect(drive.trashed).toEqual(["drive-file-1"]);
  });
});

describe("removing and downloading", () => {
  async function deliverToR2(name = "poster.psd") {
    as(creativeId, "DESIGNER");
    const { fileId } = await (await start(startReq(name, 10), p())).json();
    const row = await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: fileId } });
    r2.sizes.set(row.r2Key!, 10);
    await complete(completeReq(), p({ fileId }));
    return { fileId, key: row.r2Key! };
  }

  it("lets the uploader remove a file before the request is done, then not", async () => {
    const first = await deliverToR2();
    expect((await remove(new NextRequest(`${ORIGIN}/x`), p({ fileId: first.fileId }))).status).toBe(
      200,
    );
    expect(r2.deleted).toEqual([first.key]);

    const second = await deliverToR2("second.psd");
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: "DONE" } });
    as(creativeId, "DESIGNER");
    expect(
      (await remove(new NextRequest(`${ORIGIN}/x`), p({ fileId: second.fileId }))).status,
    ).toBe(403);
    as(customerId, "CUSTOMER");
    expect(
      (await remove(new NextRequest(`${ORIGIN}/x`), p({ fileId: second.fileId }))).status,
    ).toBe(403);
    as("admin", "SITE_ADMIN");
    expect(
      (await remove(new NextRequest(`${ORIGIN}/x`), p({ fileId: second.fileId }))).status,
    ).toBe(200);
  });

  it("downloads R2 files through a presigned link", async () => {
    const { fileId, key } = await deliverToR2();
    as(customerId, "CUSTOMER");
    const res = await download(new NextRequest(`${ORIGIN}/x`), p({ fileId }));
    expect(res.headers.get("Location")).toBe(`https://r2.test/get/${key}`);
  });
});
