// -----------------------------------------------------------------------------
// @file: lib/app-settings.ts
// @purpose: Read/write admin-configurable app settings (key-value store)
// @version: v1.0.0
// @status: active
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

/** Known setting keys with their default values. */
const DEFAULTS: Record<string, string> = {
  MIN_WITHDRAWAL_TOKENS: "20",
};

/**
 * Retrieve a single app setting. Falls back to the built-in default when the
 * key has not been persisted to the database yet.
 */
export async function getAppSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row) return row.value;
  return DEFAULTS[key] ?? null;
}

/**
 * Convenience wrapper that parses the value as an integer, returning the
 * provided fallback when the key is missing or not a valid number.
 */
export async function getAppSettingInt(
  key: string,
  fallback: number,
): Promise<number> {
  const raw = await getAppSetting(key);
  if (raw === null) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Upsert a single app setting.
 */
export async function setAppSetting(
  key: string,
  value: string,
): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
