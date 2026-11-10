// -----------------------------------------------------------------------------
// @file: tests/integration/company-integrations.test.ts
// @purpose: Company integrations against a real Postgres: secrets are stored
//           encrypted and never returned, one row per provider, and only
//           OWNER / PM can disconnect.
// -----------------------------------------------------------------------------

import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));

import { prisma } from "@/lib/prisma";
import { GET as listIntegrations } from "@/app/api/customer/integrations/route";
import { DELETE as disconnect } from "@/app/api/customer/integrations/[provider]/route";
import {
  getCompanyIntegrationSecrets,
  markIntegrationBroken,
  saveCompanyIntegration,
} from "@/lib/integrations/company-integrations";
import { resetDatabase } from "./helpers/db";
import { addCompanyMember, createCompany, createUser } from "./helpers/fixtures";

process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");

let companyId: string;
let ownerId: string;

function actAs(userId: string, companyRole: string) {
  mockGetUser.mockResolvedValue({
    id: userId,
    role: "CUSTOMER",
    activeCompanyId: companyId,
    companyRole,
  });
}

const params = (provider: string) => ({ params: Promise.resolve({ provider }) });

beforeEach(async () => {
  await resetDatabase();
  const company = await createCompany();
  const owner = await createUser();
  await addCompanyMember(company.id, owner.id, "OWNER");
  companyId = company.id;
  ownerId = owner.id;
});

describe("company integrations", () => {
  it("stores tokens encrypted and decrypts them only on the server", async () => {
    await saveCompanyIntegration({
      companyId,
      provider: "GOOGLE_DRIVE",
      connectedByUserId: ownerId,
      accountLabel: "design@acme.test",
      secrets: { refreshToken: "1//refresh-secret", accessToken: "ya29.access-secret" },
    });

    const row = await prisma.companyIntegration.findFirstOrThrow({ where: { companyId } });
    expect(row.refreshTokenEnc).not.toContain("refresh-secret");
    expect(row.accessTokenEnc).not.toContain("access-secret");

    const secrets = await getCompanyIntegrationSecrets(companyId, "GOOGLE_DRIVE");
    expect(secrets?.refreshToken).toBe("1//refresh-secret");
    expect(secrets?.accessToken).toBe("ya29.access-secret");
  });

  it("lists every provider without any secret in the response", async () => {
    await saveCompanyIntegration({
      companyId,
      provider: "SLACK",
      connectedByUserId: ownerId,
      accountLabel: "Acme · #design",
      secrets: { webhookUrl: "https://hooks.slack.test/T000/B000/secret-path" },
    });
    actAs(ownerId, "MEMBER");

    const res = await listIntegrations();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("secret-path");
    expect(body.canManage).toBe(false);
    expect(body.integrations.map((i: { provider: string }) => i.provider)).toEqual([
      "GOOGLE_DRIVE",
      "DROPBOX",
      "SLACK",
    ]);
    const slack = body.integrations.find((i: { provider: string }) => i.provider === "SLACK");
    expect(slack).toMatchObject({ status: "CONNECTED", accountLabel: "Acme · #design" });
  });

  it("keeps one connection per provider: reconnecting replaces it", async () => {
    for (const label of ["first@acme.test", "second@acme.test"]) {
      await saveCompanyIntegration({
        companyId,
        provider: "DROPBOX",
        connectedByUserId: ownerId,
        accountLabel: label,
        secrets: { refreshToken: label },
      });
    }
    const rows = await prisma.companyIntegration.findMany({ where: { companyId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].accountLabel).toBe("second@acme.test");
  });

  it("shows a broken connection with its error and clears the cached access token", async () => {
    const saved = await saveCompanyIntegration({
      companyId,
      provider: "GOOGLE_DRIVE",
      connectedByUserId: ownerId,
      secrets: { refreshToken: "r", accessToken: "a" },
    });
    await markIntegrationBroken(saved.id, "invalid_grant: Token has been expired or revoked.");
    actAs(ownerId, "OWNER");

    const body = await (await listIntegrations()).json();
    const drive = body.integrations.find(
      (i: { provider: string }) => i.provider === "GOOGLE_DRIVE",
    );
    expect(drive.status).toBe("BROKEN");
    expect(drive.lastError).toContain("invalid_grant");
    const row = await prisma.companyIntegration.findFirstOrThrow({ where: { companyId } });
    expect(row.accessTokenEnc).toBeNull();
  });

  it("lets OWNER and PM disconnect, but not BILLING or MEMBER", async () => {
    await saveCompanyIntegration({
      companyId,
      provider: "GOOGLE_DRIVE",
      connectedByUserId: ownerId,
      secrets: { refreshToken: "r" },
    });

    for (const role of ["BILLING", "MEMBER"]) {
      actAs(ownerId, role);
      expect((await disconnect(new Request("http://x"), params("google-drive"))).status).toBe(403);
    }
    actAs(ownerId, "PM");
    expect((await disconnect(new Request("http://x"), params("google-drive"))).status).toBe(200);
    expect(await prisma.companyIntegration.count({ where: { companyId } })).toBe(0);

    expect((await disconnect(new Request("http://x"), params("google-drive"))).status).toBe(404);
    expect((await disconnect(new Request("http://x"), params("onedrive"))).status).toBe(404);
  });

  it("only touches the active company's connection", async () => {
    const other = await createCompany();
    await saveCompanyIntegration({
      companyId: other.id,
      provider: "GOOGLE_DRIVE",
      connectedByUserId: ownerId,
      secrets: { refreshToken: "r" },
    });
    actAs(ownerId, "OWNER");
    expect((await disconnect(new Request("http://x"), params("google-drive"))).status).toBe(404);
    expect(await prisma.companyIntegration.count({ where: { companyId: other.id } })).toBe(1);
  });
});
