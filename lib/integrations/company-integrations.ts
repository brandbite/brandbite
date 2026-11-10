// -----------------------------------------------------------------------------
// @file: lib/integrations/company-integrations.ts
// @purpose: Read and write a company's connected accounts (Google Drive,
//           Dropbox, Slack). Secrets go in and out through secret-box only;
//           `listCompanyIntegrations` returns a browser-safe view that never
//           contains a token or webhook URL.
// -----------------------------------------------------------------------------

import type { IntegrationProvider, IntegrationStatus } from "@prisma/client";

import { decryptSecret, encryptSecret, isSecretBoxConfigured } from "@/lib/crypto/secret-box";
import { prisma } from "@/lib/prisma";

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = ["GOOGLE_DRIVE", "DROPBOX", "SLACK"];

export const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  GOOGLE_DRIVE: "Google Drive",
  DROPBOX: "Dropbox",
  SLACK: "Slack",
};

/** URL segment for each provider: /api/customer/integrations/google-drive */
export const PROVIDER_SLUGS: Record<IntegrationProvider, string> = {
  GOOGLE_DRIVE: "google-drive",
  DROPBOX: "dropbox",
  SLACK: "slack",
};

export function providerFromSlug(slug: string): IntegrationProvider | null {
  const hit = INTEGRATION_PROVIDERS.find((p) => PROVIDER_SLUGS[p] === slug);
  return hit ?? null;
}

/**
 * A provider can be offered once its app credentials and the encryption key
 * are set. Each provider PR adds its own credential check here.
 */
export function isProviderAvailable(
  provider: IntegrationProvider,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isSecretBoxConfigured(env)) return false;
  switch (provider) {
    case "GOOGLE_DRIVE":
      return Boolean(
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_DRIVE_ENABLED === "true",
      );
    case "DROPBOX":
      return Boolean(env.DROPBOX_APP_KEY && env.DROPBOX_APP_SECRET);
    case "SLACK":
      return Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);
  }
}

export type CompanyIntegrationView = {
  provider: IntegrationProvider;
  label: string;
  slug: string;
  /** Credentials are set up on our side, so the customer can connect it. */
  available: boolean;
  status: IntegrationStatus | "NOT_CONNECTED";
  accountLabel: string | null;
  connectedAt: string | null;
  connectedBy: string | null;
  lastError: string | null;
};

/** Every provider, connected or not, without any secret. */
export async function listCompanyIntegrations(
  companyId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CompanyIntegrationView[]> {
  const rows = await prisma.companyIntegration.findMany({
    where: { companyId },
    select: {
      provider: true,
      status: true,
      accountLabel: true,
      createdAt: true,
      lastError: true,
      connectedBy: { select: { name: true, email: true } },
    },
  });
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  return INTEGRATION_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    return {
      provider,
      label: PROVIDER_LABELS[provider],
      slug: PROVIDER_SLUGS[provider],
      available: isProviderAvailable(provider, env),
      status: row ? row.status : "NOT_CONNECTED",
      accountLabel: row?.accountLabel ?? null,
      connectedAt: row ? row.createdAt.toISOString() : null,
      connectedBy: row?.connectedBy ? row.connectedBy.name || row.connectedBy.email : null,
      lastError: row?.status === "BROKEN" ? (row.lastError ?? null) : null,
    };
  });
}

export type IntegrationSecrets = {
  refreshToken?: string | null;
  accessToken?: string | null;
  accessTokenExpiresAt?: Date | null;
  webhookUrl?: string | null;
};

const enc = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : encryptSecret(value);

/** Create or replace a company's connection for one provider. */
export async function saveCompanyIntegration(input: {
  companyId: string;
  provider: IntegrationProvider;
  connectedByUserId: string;
  accountLabel?: string | null;
  scopes?: string | null;
  externalRootId?: string | null;
  secrets: IntegrationSecrets;
}) {
  const data = {
    status: "CONNECTED" as const,
    accountLabel: input.accountLabel ?? null,
    scopes: input.scopes ?? null,
    externalRootId: input.externalRootId ?? null,
    refreshTokenEnc: enc(input.secrets.refreshToken) ?? null,
    accessTokenEnc: enc(input.secrets.accessToken) ?? null,
    accessTokenExpiresAt: input.secrets.accessTokenExpiresAt ?? null,
    webhookUrlEnc: enc(input.secrets.webhookUrl) ?? null,
    lastError: null,
    lastErrorAt: null,
    connectedByUserId: input.connectedByUserId,
  };
  return prisma.companyIntegration.upsert({
    where: { companyId_provider: { companyId: input.companyId, provider: input.provider } },
    create: { companyId: input.companyId, provider: input.provider, ...data },
    update: data,
    select: { id: true, provider: true, status: true },
  });
}

/** Decrypted secrets for server-side use only (uploads, Slack posts). */
export async function getCompanyIntegrationSecrets(
  companyId: string,
  provider: IntegrationProvider,
): Promise<
  | (IntegrationSecrets & {
      id: string;
      status: IntegrationStatus;
      externalRootId: string | null;
    })
  | null
> {
  const row = await prisma.companyIntegration.findUnique({
    where: { companyId_provider: { companyId, provider } },
  });
  if (!row) return null;
  const dec = (value: string | null) => (value ? decryptSecret(value) : null);
  return {
    id: row.id,
    status: row.status,
    externalRootId: row.externalRootId,
    refreshToken: dec(row.refreshTokenEnc),
    accessToken: dec(row.accessTokenEnc),
    accessTokenExpiresAt: row.accessTokenExpiresAt,
    webhookUrl: dec(row.webhookUrlEnc),
  };
}

/** Cache a refreshed access token. */
export async function updateCachedAccessToken(id: string, accessToken: string, expiresAt: Date) {
  await prisma.companyIntegration.update({
    where: { id },
    data: { accessTokenEnc: encryptSecret(accessToken), accessTokenExpiresAt: expiresAt },
  });
}

/** The provider rejected us: keep the row so the customer is asked to reconnect. */
export async function markIntegrationBroken(id: string, error: string) {
  await prisma.companyIntegration.update({
    where: { id },
    data: {
      status: "BROKEN",
      lastError: error.slice(0, 500),
      lastErrorAt: new Date(),
      accessTokenEnc: null,
      accessTokenExpiresAt: null,
    },
  });
}

/** Forget the connection and its secrets. Returns false when nothing was connected. */
export async function deleteCompanyIntegration(
  companyId: string,
  provider: IntegrationProvider,
): Promise<boolean> {
  const { count } = await prisma.companyIntegration.deleteMany({ where: { companyId, provider } });
  return count > 0;
}
