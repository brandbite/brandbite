// -----------------------------------------------------------------------------
// @file: lib/__tests__/plugin-licence.test.ts
// @purpose: Site normalisation and download-token signing for /api/plugins/*.
//           The database paths are covered by the route, not here.
// -----------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";

import { normaliseSite, signDownloadToken, verifyDownloadToken } from "@/lib/plugin-licence";

const SECRET = "test-secret-do-not-use-anywhere-else";

afterEach(() => {
  vi.useRealTimers();
});

describe("normaliseSite", () => {
  it("treats http and https as the same site", () => {
    expect(normaliseSite("http://example.com")).toBe(normaliseSite("https://example.com"));
  });

  it("treats www and bare as the same site", () => {
    // The one that matters commercially: adding an SSL certificate or a www
    // redirect must not quietly cost the customer a second seat.
    expect(normaliseSite("https://www.example.com")).toBe("example.com");
    expect(normaliseSite("https://example.com")).toBe("example.com");
  });

  it("ignores a trailing slash", () => {
    expect(normaliseSite("https://example.com/")).toBe("example.com");
    expect(normaliseSite("https://example.com///")).toBe("example.com");
  });

  it("keeps a subfolder install distinct", () => {
    // A WordPress install in a subfolder genuinely is a separate site.
    expect(normaliseSite("https://example.com/shop")).toBe("example.com/shop");
    expect(normaliseSite("https://example.com/shop")).not.toBe(
      normaliseSite("https://example.com"),
    );
  });

  it("keeps subdomains distinct", () => {
    expect(normaliseSite("https://staging.example.com")).toBe("staging.example.com");
    expect(normaliseSite("https://staging.example.com")).not.toBe("example.com");
  });

  it("lower-cases the host", () => {
    expect(normaliseSite("https://EXAMPLE.com")).toBe("example.com");
  });

  it("copes with something that is not a URL at all", () => {
    expect(normaliseSite("www.example.com/")).toBe("example.com");
    expect(normaliseSite("")).toBe("");
    // @ts-expect-error — the plugin sends whatever WordPress gives it.
    expect(normaliseSite(undefined)).toBe("");
  });
});

describe("download tokens", () => {
  it("round-trips a token it just signed", () => {
    const token = signDownloadToken("image-optimizer", "BB-1234", SECRET);
    const claims = verifyDownloadToken(token, "image-optimizer", SECRET);

    expect(claims).not.toBeNull();
    expect(claims?.k).toBe("BB-1234");
    expect(claims?.p).toBe("image-optimizer");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signDownloadToken("image-optimizer", "BB-1234", "some-other-secret");
    expect(verifyDownloadToken(token, "image-optimizer", SECRET)).toBeNull();
  });

  it("rejects a token minted for another product", () => {
    const token = signDownloadToken("image-optimizer", "BB-1234", SECRET);
    expect(verifyDownloadToken(token, "some-future-plugin", SECRET)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signDownloadToken("image-optimizer", "BB-1234", SECRET);
    const [, mac] = token.split(".");
    const forged = `${Buffer.from(
      JSON.stringify({ p: "image-optimizer", k: "BB-STOLEN", e: 9999999999 }),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")}.${mac}`;

    expect(verifyDownloadToken(forged, "image-optimizer", SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signDownloadToken("image-optimizer", "BB-1234", SECRET, 60);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);

    expect(verifyDownloadToken(token, "image-optimizer", SECRET)).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    for (const bad of ["", "nonsense", "a.b.c", "onlyonepart.", ".onlymac"]) {
      expect(verifyDownloadToken(bad, "image-optimizer", SECRET)).toBeNull();
    }
  });

  it("refuses to verify anything when no secret is configured", () => {
    // Missing PLUGIN_DOWNLOAD_SECRET must fail closed, never open.
    const token = signDownloadToken("image-optimizer", "BB-1234", SECRET);
    expect(verifyDownloadToken(token, "image-optimizer", "")).toBeNull();
  });
});
