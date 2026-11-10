// -----------------------------------------------------------------------------
// @file: tests/integration/google-drive-integration.test.ts
// @purpose: Connecting Google Drive against a real Postgres, with Google's
//           endpoints faked: state check, granted-scope check, role check,
//           folder reuse, token refresh, broken grants and revoke on
//           disconnect.
// -----------------------------------------------------------------------------

import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));

import { prisma } from "@/lib/prisma";
import { GET as connect } from "@/app/api/customer/integrations/google-drive/connect/route";
import { GET as callback } from "@/app/api/customer/integrations/google-drive/callback/route";
import { DELETE as disconnect } from "@/app/api/customer/integrations/[provider]/route";
import {
  getCompanyIntegrationSecrets,
  saveCompanyIntegration,
} from "@/lib/integrations/company-integrations";
import { IntegrationBrokenError, getDriveAccessToken } from "@/lib/integrations/google-drive";
import { resetDatabase } from "./helpers/db";
import { addCompanyMember, createCompany, createUser } from "./helpers/fixtures";

const ORIGIN = "https://brandbite.test";
const DRIVE_FILE = "https://www.googleapis.com/auth/drive.file";
const COOKIE = "brandbite_google_drive_oauth_state";

let companyId: string;
let ownerId: string;
let fetchMock: ReturnType<typeof vi.fn>;

function actAs(companyRole: string, activeCompanyId = companyId) {
  mockGetUser.mockResolvedValue({ id: ownerId, role: "CUSTOMER", activeCompanyId, companyRole });
}

function idToken(email: string) {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${part({ alg: "none" })}.${part({ email })}.sig`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Fake Google: token exchange/refresh, folder create, folder lookup, revoke. */
function fakeGoogle(
  opts: { scope?: string; existingFolder?: boolean; refreshError?: string } = {},
) {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      const body = String(init?.body ?? "");
      if (body.includes("grant_type=refresh_token")) {
        if (opts.refreshError) return json({ error: opts.refreshError }, 400);
        return json({ access_token: "fresh-access", expires_in: 3600, scope: DRIVE_FILE });
      }
      return json({
        access_token: "first-access",
        refresh_token: "the-refresh-token",
        expires_in: 3600,
        scope: opts.scope ?? `openid ${DRIVE_FILE} https://www.googleapis.com/auth/userinfo.email`,
        id_token: idToken("design@acme.test"),
      });
    }
    if (url.startsWith("https://oauth2.googleapis.com/revoke"))
      return new Response("", { status: 200 });
    if (url.includes("/drive/v3/files/") && (!init?.method || init.method === "GET")) {
      return opts.existingFolder
        ? json({ id: "old-folder", trashed: false, mimeType: "application/vnd.google-apps.folder" })
        : json({ error: "notFound" }, 404);
    }
    if (url.includes("/drive/v3/files") && init?.method === "POST")
      return json({ id: "new-folder" });
    throw new Error(`Unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
}

async function startConnect() {
  const res = await connect(
    new NextRequest(`${ORIGIN}/api/customer/integrations/google-drive/connect`),
  );
  const location = res.headers.get("Location") ?? "";
  const cookie = res.headers.get("set-cookie") ?? "";
  const state = new URL(location).searchParams.get("state");
  const cookieValue = /brandbite_google_drive_oauth_state=([^;]+)/.exec(cookie)?.[1];
  return { res, location, state, cookieValue };
}

function callbackRequest(params: Record<string, string>, cookieValue?: string) {
  const url = `${ORIGIN}/api/customer/integrations/google-drive/callback?${new URLSearchParams(params)}`;
  return new NextRequest(url, {
    headers: cookieValue ? { cookie: `${COOKIE}=${cookieValue}` } : {},
  });
}

const resultOf = (res: Response) => {
  const url = new URL(res.headers.get("Location")!);
  return { result: url.searchParams.get("result"), message: url.searchParams.get("message") };
};

beforeEach(async () => {
  await resetDatabase();
  process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.GOOGLE_OAUTH_CLIENT_ID = "client-id";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "client-secret";
  process.env.GOOGLE_DRIVE_ENABLED = "true";
  const company = await createCompany();
  const owner = await createUser();
  await addCompanyMember(company.id, owner.id, "OWNER");
  companyId = company.id;
  ownerId = owner.id;
  actAs("OWNER");
  fakeGoogle();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google Drive connect", () => {
  it("sends owners to Google with only the drive.file scope and our own callback", async () => {
    const { location, state, cookieValue } = await startConnect();
    const url = new URL(location);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(`${DRIVE_FILE} openid email`);
    expect(url.searchParams.get("redirect_uri")).toBe(
      `${ORIGIN}/api/customer/integrations/google-drive/callback`,
    );
    expect(cookieValue).toBe(`${state}.${companyId}`);
  });

  it("refuses members and billing, and stays off until Drive is enabled", async () => {
    for (const role of ["MEMBER", "BILLING"]) {
      actAs(role);
      const res = await connect(new NextRequest(`${ORIGIN}/x`));
      expect(resultOf(res).result).toBe("error");
      expect(res.headers.get("set-cookie") ?? "").not.toContain(COOKIE);
    }
    actAs("OWNER");
    process.env.GOOGLE_DRIVE_ENABLED = "false";
    const res = await connect(new NextRequest(`${ORIGIN}/x`));
    expect(resultOf(res)).toMatchObject({ result: "error" });
  });

  it("connects: encrypted tokens, the account email and a new brandbite folder", async () => {
    const { state, cookieValue } = await startConnect();
    const res = await callback(callbackRequest({ code: "abc", state: state! }, cookieValue));
    expect(resultOf(res)).toEqual({ result: "connected", message: "design@acme.test" });

    const row = await prisma.companyIntegration.findFirstOrThrow({ where: { companyId } });
    expect(row).toMatchObject({
      provider: "GOOGLE_DRIVE",
      status: "CONNECTED",
      accountLabel: "design@acme.test",
      externalRootId: "new-folder",
      connectedByUserId: ownerId,
    });
    expect(row.refreshTokenEnc).not.toContain("the-refresh-token");
    const secrets = await getCompanyIntegrationSecrets(companyId, "GOOGLE_DRIVE");
    expect(secrets?.refreshToken).toBe("the-refresh-token");
  });

  it("rejects a wrong or missing state and saves nothing", async () => {
    const { cookieValue } = await startConnect();
    for (const req of [
      callbackRequest({ code: "abc", state: "forged" }, cookieValue),
      callbackRequest({ code: "abc", state: "anything" }),
    ]) {
      expect(resultOf(await callback(req)).result).toBe("error");
    }
    expect(await prisma.companyIntegration.count()).toBe(0);
  });

  it("rejects the answer when the user switched to another company meanwhile", async () => {
    const { state, cookieValue } = await startConnect();
    const other = await createCompany();
    actAs("OWNER", other.id);
    expect(
      resultOf(await callback(callbackRequest({ code: "abc", state: state! }, cookieValue))).result,
    ).toBe("error");
    expect(await prisma.companyIntegration.count()).toBe(0);
  });

  it("explains when the Drive permission box was left unticked", async () => {
    fakeGoogle({ scope: "openid https://www.googleapis.com/auth/userinfo.email" });
    const { state, cookieValue } = await startConnect();
    const { result, message } = resultOf(
      await callback(callbackRequest({ code: "abc", state: state! }, cookieValue)),
    );
    expect(result).toBe("error");
    expect(message).toContain("Drive permission");
    expect(await prisma.companyIntegration.count()).toBe(0);
  });

  it("reuses the brandbite folder from an earlier connection", async () => {
    await saveCompanyIntegration({
      companyId,
      provider: "GOOGLE_DRIVE",
      connectedByUserId: ownerId,
      externalRootId: "old-folder",
      secrets: { refreshToken: "old" },
    });
    fakeGoogle({ existingFolder: true });
    const { state, cookieValue } = await startConnect();
    await callback(callbackRequest({ code: "abc", state: state! }, cookieValue));
    const row = await prisma.companyIntegration.findFirstOrThrow({ where: { companyId } });
    expect(row.externalRootId).toBe("old-folder");
    const createdFolder = fetchMock.mock.calls.some(
      ([url, init]) => String(url).includes("/drive/v3/files") && init?.method === "POST",
    );
    expect(createdFolder).toBe(false);
  });
});

describe("Google Drive access tokens", () => {
  it("uses the cached token while it's fresh and refreshes it when it expires", async () => {
    await saveCompanyIntegration({
      companyId,
      provider: "GOOGLE_DRIVE",
      connectedByUserId: ownerId,
      externalRootId: "folder",
      secrets: {
        refreshToken: "r",
        accessToken: "cached",
        accessTokenExpiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    expect((await getDriveAccessToken(companyId, ORIGIN)).accessToken).toBe("cached");
    expect(fetchMock).not.toHaveBeenCalled();

    const later = new Date(Date.now() + 31 * 60_000);
    const refreshed = await getDriveAccessToken(companyId, ORIGIN, later);
    expect(refreshed).toEqual({ accessToken: "fresh-access", rootFolderId: "folder" });
    const secrets = await getCompanyIntegrationSecrets(companyId, "GOOGLE_DRIVE");
    expect(secrets?.accessToken).toBe("fresh-access");
  });

  it("marks the connection broken when Google revoked the grant", async () => {
    fakeGoogle({ refreshError: "invalid_grant" });
    await saveCompanyIntegration({
      companyId,
      provider: "GOOGLE_DRIVE",
      connectedByUserId: ownerId,
      secrets: { refreshToken: "r" },
    });
    await expect(getDriveAccessToken(companyId, ORIGIN)).rejects.toBeInstanceOf(
      IntegrationBrokenError,
    );
    const row = await prisma.companyIntegration.findFirstOrThrow({ where: { companyId } });
    expect(row.status).toBe("BROKEN");
    expect(row.lastError).toContain("invalid_grant");
  });

  it("revokes Google's access when the customer disconnects", async () => {
    await saveCompanyIntegration({
      companyId,
      provider: "GOOGLE_DRIVE",
      connectedByUserId: ownerId,
      secrets: { refreshToken: "the-refresh-token" },
    });
    const res = await disconnect(new Request("http://x"), {
      params: Promise.resolve({ provider: "google-drive" }),
    });
    expect(res.status).toBe(200);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("revoke?token=the-refresh-token")),
    ).toBe(true);
    expect(await prisma.companyIntegration.count()).toBe(0);
  });
});
