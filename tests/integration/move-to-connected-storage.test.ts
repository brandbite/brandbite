// -----------------------------------------------------------------------------
// @file: tests/integration/move-to-connected-storage.test.ts
// @purpose: Files kept on brandbite storage (R2) move into a Google Drive or
//           Dropbox the customer connects later: new home + link, no deletion
//           date, R2 copy deleted; failures are counted and retried at most
//           3 times; nothing moves while no drive is connected.
// -----------------------------------------------------------------------------

import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { deleted } = vi.hoisted(() => ({ deleted: [] as string[] }));

vi.mock("@/lib/source-files/r2-source-files", () => ({
  presignSourceFileUpload: async (key: string) => `https://r2.test/put/${key}`,
  presignSourceFileDownload: async (key: string) => `https://r2.test/get/${key}`,
  sourceFileObjectSize: async () => null,
  openSourceFileStream: async (key: string) =>
    key.includes("missing")
      ? null
      : { stream: new Blob([`bytes of ${key}`]).stream(), size: `bytes of ${key}`.length },
}));
vi.mock("@/lib/r2", () => ({
  deleteR2Objects: async (keys: (string | null)[]) => {
    deleted.push(...keys.filter((k): k is string => !!k));
  },
}));

import { prisma } from "@/lib/prisma";
import { saveCompanyIntegration } from "@/lib/integrations/company-integrations";
import {
  countFilesToMove,
  moveFilesForAllCompanies,
  moveFilesToConnectedStorage,
} from "@/lib/source-files/move-to-connected-storage";
import { resetDatabase } from "./helpers/db";
import { addCompanyMember, createCompany, createTicket, createUser } from "./helpers/fixtures";

const ORIGIN = "https://brandbite.test";
let companyId: string;
let ownerId: string;
let ticketId: string;
let calls: string[];

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

function fakeProviders() {
  calls = [];
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      // Google Drive
      if (url.includes("/drive/v3/files?q=") || url.includes("/drive/v3/files/")) {
        return json({
          id: "folder",
          trashed: false,
          mimeType: "application/vnd.google-apps.folder",
        });
      }
      if (url.startsWith("https://www.googleapis.com/drive/v3/files") && init?.method === "POST") {
        n += 1;
        return json({ id: `folder-${n}` });
      }
      if (url.includes("uploadType=resumable")) {
        return new Response(null, {
          status: 200,
          headers: { Location: "https://upload.test/session" },
        });
      }
      if (url === "https://upload.test/session") {
        n += 1;
        return json({
          id: `drive-file-${n}`,
          name: "logo.ai",
          webViewLink: `https://drive.test/${n}`,
        });
      }
      // Dropbox
      if (url.endsWith("/files/upload")) {
        const arg = JSON.parse((init?.headers as Record<string, string>)["Dropbox-API-Arg"]);
        return json({ id: "id:dbx1", name: "logo.ai", path_display: arg.path, size: 10 });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }),
  );
}

async function addR2File(name: string, key: string) {
  return prisma.ticketSourceFile.create({
    data: {
      ticketId,
      name,
      sizeBytes: BigInt(10),
      storage: "R2",
      status: "READY",
      r2Key: key,
      deleteAfter: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      reminder14SentAt: new Date(),
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
  deleted.length = 0;
  process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.GOOGLE_DRIVE_CLIENT_ID = "g";
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = "g";
  process.env.GOOGLE_DRIVE_ENABLED = "true";
  process.env.DROPBOX_APP_KEY = "d";
  process.env.DROPBOX_APP_SECRET = "d";
  process.env.DROPBOX_ENABLED = "true";
  const company = await createCompany();
  const owner = await createUser();
  await addCompanyMember(company.id, owner.id, "OWNER");
  const project = await prisma.project.create({
    data: { id: `p-${company.id}`, companyId: company.id, name: "Website", code: "WEB" },
  });
  const ticket = await createTicket({
    companyId: company.id,
    createdById: owner.id,
    status: "DONE",
  });
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { projectId: project.id, companyTicketNumber: 101, title: "Spring poster" },
  });
  companyId = company.id;
  ownerId = owner.id;
  ticketId = ticket.id;
  fakeProviders();
});

afterEach(() => vi.unstubAllGlobals());

const connect = (provider: "GOOGLE_DRIVE" | "DROPBOX") =>
  saveCompanyIntegration({
    companyId,
    provider,
    connectedByUserId: ownerId,
    externalRootId: provider === "GOOGLE_DRIVE" ? "root" : null,
    secrets: {
      refreshToken: "r",
      accessToken: "a",
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60_000),
    },
  });

describe("moving brandbite-stored source files into a connected drive", () => {
  it("does nothing while no drive is connected", async () => {
    await addR2File("logo.ai", "tickets/t/source/1_logo.ai");
    const result = await moveFilesToConnectedStorage(companyId, ORIGIN);
    expect(result).toEqual({ moved: 0, failed: 0, remaining: 1 });
    expect(calls).toEqual([]);
  });

  it("moves files into Google Drive, clears the deletion date and deletes the R2 copy", async () => {
    await connect("GOOGLE_DRIVE");
    const file = await addR2File("logo.ai", "tickets/t/source/1_logo.ai");
    const result = await moveFilesToConnectedStorage(companyId, ORIGIN);
    expect(result).toEqual({ moved: 1, failed: 0, remaining: 0 });
    const row = await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: file.id } });
    expect(row).toMatchObject({
      storage: "GOOGLE_DRIVE",
      r2Key: null,
      deleteAfter: null,
      reminder14SentAt: null,
      copyError: null,
    });
    expect(row.externalId).toMatch(/^drive-file-/);
    expect(row.externalUrl).toMatch(/^https:\/\/drive\.test\//);
    expect(deleted).toEqual(["tickets/t/source/1_logo.ai"]);
  });

  it("moves files of any size into Dropbox when that's what's connected", async () => {
    await connect("DROPBOX");
    const file = await addR2File("logo.ai", "tickets/t/source/2_logo.ai");
    await moveFilesToConnectedStorage(companyId, ORIGIN);
    const row = await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: file.id } });
    expect(row).toMatchObject({ storage: "DROPBOX", externalId: "id:dbx1", deleteAfter: null });
    expect(row.externalUrl).toBe(
      "https://www.dropbox.com/home/Apps/brandbite/Website/WEB-101%20Spring%20poster/logo.ai",
    );
  });

  it("counts a failure, keeps the file on brandbite storage and gives up after 3 tries", async () => {
    await connect("GOOGLE_DRIVE");
    const file = await addR2File("gone.ai", "tickets/t/source/missing");
    for (let i = 0; i < 3; i++) await moveFilesToConnectedStorage(companyId, ORIGIN);
    const row = await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: file.id } });
    expect(row).toMatchObject({ storage: "R2", copyAttempts: 3 });
    expect(row.copyError).toContain("not found");
    expect(row.deleteAfter).not.toBeNull();
    expect(await countFilesToMove(companyId)).toBe(0);
    expect(deleted).toEqual([]);
  });

  it("the daily run picks up companies with a drive and files left", async () => {
    await connect("GOOGLE_DRIVE");
    await addR2File("a.ai", "tickets/t/source/a");
    await addR2File("b.ai", "tickets/t/source/b");
    const result = await moveFilesForAllCompanies(ORIGIN, Date.now() + 60_000);
    expect(result).toEqual({ moved: 2, failed: 0, remaining: 0 });
  });
});
