// -----------------------------------------------------------------------------
// @file: tests/integration/dropbox-integration.test.ts
// @purpose: Dropbox against a real Postgres with Dropbox's endpoints faked:
//           connect (offline token + account email), files up to 150 MB via a
//           one-time upload link (POST, no token for the browser), bigger
//           files to R2, Drive preferred when both are connected, confirming a
//           renamed upload, removing it, and revoking on disconnect.
// -----------------------------------------------------------------------------

import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getCurrentUserOrThrow: () => mockGetUser() }));
vi.mock("@/lib/source-files/r2-source-files", () => ({
  presignSourceFileUpload: async (key: string) => `https://r2.test/put/${key}`,
  presignSourceFileDownload: async (key: string) => `https://r2.test/get/${key}`,
  sourceFileObjectSize: async () => null,
}));

import { prisma } from "@/lib/prisma";
import { GET as connect } from "@/app/api/customer/integrations/dropbox/connect/route";
import { GET as callback } from "@/app/api/customer/integrations/dropbox/callback/route";
import { DELETE as disconnect } from "@/app/api/customer/integrations/[provider]/route";
import { POST as start } from "@/app/api/tickets/[id]/source-files/route";
import { POST as complete } from "@/app/api/tickets/[id]/source-files/[fileId]/complete/route";
import { DELETE as remove } from "@/app/api/tickets/[id]/source-files/[fileId]/route";
import { saveCompanyIntegration } from "@/lib/integrations/company-integrations";
import { resetDatabase } from "./helpers/db";
import { addCompanyMember, createCompany, createTicket, createUser } from "./helpers/fixtures";

const ORIGIN = "https://brandbite.test";
const MB = 1024 * 1024;
const COOKIE = "brandbite_dropbox_oauth_state";

let companyId: string;
let ownerId: string;
let creativeId: string;
let ticketId: string;
let calls: { url: string; body: unknown; auth: string | null }[];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function fakeDropbox() {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const raw = init?.body ? String(init.body) : "";
      let body: unknown = raw;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        body = raw;
      }
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url, body, auth: headers.Authorization ?? null });
      if (url === "https://api.dropboxapi.com/oauth2/token") {
        return json({
          access_token: "dbx-access",
          expires_in: 14400,
          refresh_token: "dbx-refresh",
          account_id: "dbid:acc1",
          scope: "files.content.write files.metadata.read",
        });
      }
      if (url.endsWith("/users/get_current_account")) return json({ email: "design@acme.test" });
      if (url.endsWith("/files/get_temporary_upload_link")) {
        return json({ link: "https://content.dropboxapi.com/apitul/1/tmp-link" });
      }
      if (url.endsWith("/files/list_folder")) {
        return json({
          entries: [
            {
              ".tag": "file",
              id: "id:older",
              name: "poster.psd",
              path_display: "/Website/WEB-101 Spring poster/poster.psd",
              size: 10 * MB,
              server_modified: "2026-11-01T00:00:00Z",
            },
            {
              ".tag": "file",
              id: "id:new",
              name: "poster (1).psd",
              path_display: "/Website/WEB-101 Spring poster/poster (1).psd",
              size: 20 * MB,
              server_modified: "2026-11-10T00:00:00Z",
            },
          ],
        });
      }
      if (url.endsWith("/files/delete_v2") || url.endsWith("/auth/token/revoke")) return json({});
      throw new Error(`Unexpected fetch ${url}`);
    }),
  );
}

async function connectDropbox() {
  await saveCompanyIntegration({
    companyId,
    provider: "DROPBOX",
    connectedByUserId: ownerId,
    accountLabel: "design@acme.test",
    secrets: {
      refreshToken: "dbx-refresh",
      accessToken: "dbx-access",
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60_000),
    },
  });
}

const params = (fileId = "") => ({ params: Promise.resolve({ id: ticketId, fileId }) });
const startReq = (name: string, sizeBytes: number) =>
  new NextRequest(`${ORIGIN}/api/tickets/x/source-files`, {
    method: "POST",
    body: JSON.stringify({ name, sizeBytes, mimeType: "image/vnd.adobe.photoshop" }),
  });

beforeEach(async () => {
  await resetDatabase();
  process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.DROPBOX_APP_KEY = "app-key";
  process.env.DROPBOX_APP_SECRET = "app-secret";
  process.env.DROPBOX_ENABLED = "true";
  process.env.GOOGLE_DRIVE_CLIENT_ID = "g";
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = "g";
  process.env.GOOGLE_DRIVE_ENABLED = "true";
  const company = await createCompany();
  const owner = await createUser();
  const creative = await createUser({ role: "DESIGNER" });
  await addCompanyMember(company.id, owner.id, "OWNER");
  const project = await prisma.project.create({
    data: { id: `p-${company.id}`, companyId: company.id, name: "Website", code: "WEB" },
  });
  const ticket = await createTicket({
    companyId: company.id,
    createdById: owner.id,
    creativeId: creative.id,
    status: "IN_PROGRESS",
  });
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { projectId: project.id, companyTicketNumber: 101, title: "Spring poster" },
  });
  companyId = company.id;
  ownerId = owner.id;
  creativeId = creative.id;
  ticketId = ticket.id;
  mockGetUser.mockResolvedValue({
    id: ownerId,
    role: "CUSTOMER",
    activeCompanyId: companyId,
    companyRole: "OWNER",
  });
  fakeDropbox();
});

afterEach(() => vi.unstubAllGlobals());

describe("Dropbox connect", () => {
  it("asks Dropbox for offline access and saves the tokens and account email", async () => {
    const res = await connect(
      new NextRequest(`${ORIGIN}/api/customer/integrations/dropbox/connect`),
    );
    const location = new URL(res.headers.get("Location")!);
    expect(location.origin).toBe("https://www.dropbox.com");
    expect(location.searchParams.get("token_access_type")).toBe("offline");
    expect(location.searchParams.get("redirect_uri")).toBe(
      `${ORIGIN}/api/customer/integrations/dropbox/callback`,
    );
    const cookie = /brandbite_dropbox_oauth_state=([^;]+)/.exec(
      res.headers.get("set-cookie") ?? "",
    )![1];

    const back = await callback(
      new NextRequest(
        `${ORIGIN}/api/customer/integrations/dropbox/callback?code=abc&state=${location.searchParams.get("state")}`,
        { headers: { cookie: `${COOKIE}=${cookie}` } },
      ),
    );
    expect(new URL(back.headers.get("Location")!).searchParams.get("result")).toBe("connected");
    const row = await prisma.companyIntegration.findFirstOrThrow({ where: { companyId } });
    expect(row).toMatchObject({
      provider: "DROPBOX",
      status: "CONNECTED",
      accountLabel: "design@acme.test",
    });
    expect(row.refreshTokenEnc).not.toContain("dbx-refresh");
  });

  it("revokes Dropbox's access when the customer disconnects", async () => {
    await connectDropbox();
    const res = await disconnect(new Request("http://x"), {
      params: Promise.resolve({ provider: "dropbox" }),
    });
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.url.endsWith("/auth/token/revoke"))).toBe(true);
    expect(await prisma.companyIntegration.count()).toBe(0);
  });
});

describe("Dropbox delivery", () => {
  beforeEach(async () => {
    await connectDropbox();
    mockGetUser.mockResolvedValue({ id: creativeId, role: "DESIGNER" });
  });

  it("sends files up to 150 MB to a one-time upload link, without a token for the browser", async () => {
    const body = await (await start(startReq("poster.psd", 20 * MB), params())).json();
    expect(body).toMatchObject({
      storage: "DROPBOX",
      method: "POST",
      contentType: "application/octet-stream",
      uploadUrl: "https://content.dropboxapi.com/apitul/1/tmp-link",
    });
    expect(JSON.stringify(body)).not.toContain("dbx-access");
    const link = calls.find((c) => c.url.endsWith("/files/get_temporary_upload_link"))!;
    expect(link.body).toMatchObject({
      commit_info: {
        path: "/Website/WEB-101 Spring poster/poster.psd",
        mode: "add",
        autorename: true,
      },
    });
  });

  it("sends bigger files to brandbite storage", async () => {
    const body = await (await start(startReq("huge.psb", 151 * MB), params())).json();
    expect(body.storage).toBe("R2");
    expect(calls.some((c) => c.url.includes("dropbox"))).toBe(false);
  });

  it("prefers Google Drive when both are connected", async () => {
    await saveCompanyIntegration({
      companyId,
      provider: "GOOGLE_DRIVE",
      connectedByUserId: ownerId,
      secrets: { refreshToken: "r" },
    });
    const { chooseSourceFileStorage } = await import("@/lib/source-files/source-files");
    expect(await chooseSourceFileStorage(companyId, 20 * MB)).toBe("GOOGLE_DRIVE");
  });

  it("confirms the upload even when Dropbox renamed it, and links to it", async () => {
    const { fileId } = await (await start(startReq("poster.psd", 20 * MB), params())).json();
    const res = await complete(
      new NextRequest(`${ORIGIN}/x`, { method: "POST", body: "{}" }),
      params(fileId),
    );
    expect(res.status).toBe(200);
    const row = await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: fileId } });
    expect(row).toMatchObject({ status: "READY", name: "poster (1).psd", externalId: "id:new" });
    expect(row.externalUrl).toBe(
      "https://www.dropbox.com/home/Apps/brandbite/Website/WEB-101%20Spring%20poster/poster%20(1).psd",
    );

    expect((await remove(new NextRequest(`${ORIGIN}/x`), params(fileId))).status).toBe(200);
    const del = calls.find((c) => c.url.endsWith("/files/delete_v2"))!;
    expect(del.body).toEqual({ path: "id:new" });
  });
});
