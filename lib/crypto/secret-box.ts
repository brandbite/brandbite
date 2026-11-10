// -----------------------------------------------------------------------------
// @file: lib/crypto/secret-box.ts
// @purpose: Encrypts secrets we must keep but never show: OAuth refresh and
//           access tokens of customer integrations, Slack webhook URLs.
//           AES-256-GCM (authenticated: a tampered value fails to decrypt).
//
//           Stored format: "v1:<keyId>:<iv>:<tag>:<ciphertext>" (base64url
//           parts). The key id lets us rotate: INTEGRATIONS_ENCRYPTION_KEY is
//           the current key ("k1"); INTEGRATIONS_ENCRYPTION_KEYS_OLD can hold
//           earlier ones as "k0=<base64>,k-1=<base64>" so old values still
//           decrypt while we re-encrypt them.
//
//           Generate a key with:
//             node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// -----------------------------------------------------------------------------

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const CURRENT_KEY_ID = "k1";

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

function parseKey(base64: string, name: string): Buffer {
  const key = Buffer.from(base64.trim(), "base64");
  if (key.length !== 32) {
    throw new SecretBoxError(`${name} must be 32 bytes, base64-encoded.`);
  }
  return key;
}

function readKeys(env: NodeJS.ProcessEnv = process.env): Map<string, Buffer> {
  const keys = new Map<string, Buffer>();
  const current = env.INTEGRATIONS_ENCRYPTION_KEY;
  if (current) keys.set(CURRENT_KEY_ID, parseKey(current, "INTEGRATIONS_ENCRYPTION_KEY"));
  for (const entry of (env.INTEGRATIONS_ENCRYPTION_KEYS_OLD ?? "").split(",")) {
    const [id, value] = entry.split("=", 2).map((p) => p?.trim());
    if (id && value && id !== CURRENT_KEY_ID) {
      keys.set(id, parseKey(value, `INTEGRATIONS_ENCRYPTION_KEYS_OLD (${id})`));
    }
  }
  return keys;
}

/** True when a current key is configured, so integrations can be offered. */
export function isSecretBoxConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    return readKeys(env).has(CURRENT_KEY_ID);
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string, env: NodeJS.ProcessEnv = process.env): string {
  const key = readKeys(env).get(CURRENT_KEY_ID);
  if (!key) throw new SecretBoxError("INTEGRATIONS_ENCRYPTION_KEY is not set.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    CURRENT_KEY_ID,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptSecret(stored: string, env: NodeJS.ProcessEnv = process.env): string {
  const parts = stored.split(":");
  if (parts.length !== 5 || parts[0] !== VERSION) {
    throw new SecretBoxError("Not an encrypted secret.");
  }
  const [, keyId, ivPart, tagPart, dataPart] = parts;
  const key = readKeys(env).get(keyId);
  if (!key) throw new SecretBoxError(`No encryption key "${keyId}" is configured.`);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new SecretBoxError("The secret could not be decrypted (wrong key or tampered value).");
  }
}

/** True when the value was encrypted with an older key and should be re-encrypted. */
export function needsReencryption(stored: string): boolean {
  return stored.split(":")[1] !== CURRENT_KEY_ID;
}
