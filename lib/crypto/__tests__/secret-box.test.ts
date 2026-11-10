import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  SecretBoxError,
  decryptSecret,
  encryptSecret,
  isSecretBoxConfigured,
  needsReencryption,
} from "../secret-box";

const key = () => randomBytes(32).toString("base64");
const asEnv = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe("secret-box", () => {
  const env = asEnv({ INTEGRATIONS_ENCRYPTION_KEY: key() });

  it("round-trips a secret and never stores it in plain text", () => {
    const stored = encryptSecret("1//refresh-token-value", env);
    expect(stored).not.toContain("refresh-token-value");
    expect(stored.startsWith("v1:k1:")).toBe(true);
    expect(decryptSecret(stored, env)).toBe("1//refresh-token-value");
  });

  it("uses a fresh IV, so the same secret encrypts differently each time", () => {
    expect(encryptSecret("same", env)).not.toBe(encryptSecret("same", env));
  });

  it("rejects a tampered value", () => {
    const stored = encryptSecret("secret", env);
    const parts = stored.split(":");
    parts[4] = Buffer.from("other").toString("base64url");
    expect(() => decryptSecret(parts.join(":"), env)).toThrow(SecretBoxError);
  });

  it("rejects a value encrypted with another key", () => {
    const stored = encryptSecret("secret", env);
    const otherEnv = asEnv({ INTEGRATIONS_ENCRYPTION_KEY: key() });
    expect(() => decryptSecret(stored, otherEnv)).toThrow(SecretBoxError);
  });

  it("still decrypts values from a rotated-out key", () => {
    const oldKey = key();
    const before = asEnv({ INTEGRATIONS_ENCRYPTION_KEY: oldKey });
    const stored = encryptSecret("secret", before).replace(":k1:", ":k0:");
    const after = asEnv({
      INTEGRATIONS_ENCRYPTION_KEY: key(),
      INTEGRATIONS_ENCRYPTION_KEYS_OLD: `k0=${oldKey}`,
    });
    expect(decryptSecret(stored, after)).toBe("secret");
    expect(needsReencryption(stored)).toBe(true);
  });

  it("refuses to encrypt without a key and reports it as not configured", () => {
    const empty = asEnv({});
    expect(isSecretBoxConfigured(empty)).toBe(false);
    expect(() => encryptSecret("x", empty)).toThrow(SecretBoxError);
    expect(isSecretBoxConfigured(env)).toBe(true);
  });

  it("rejects a key of the wrong length", () => {
    const bad = { INTEGRATIONS_ENCRYPTION_KEY: Buffer.from("short").toString("base64") };
    expect(isSecretBoxConfigured(asEnv(bad))).toBe(false);
  });
});
