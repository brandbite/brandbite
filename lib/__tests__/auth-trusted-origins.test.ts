import { describe, expect, it } from "vitest";

import { previewTrustedOrigins } from "@/lib/auth-trusted-origins";

const hosts = {
  VERCEL_URL: "brandbite-abc123.vercel.app",
  VERCEL_BRANCH_URL: "brandbite-git-feature.vercel.app",
};

describe("previewTrustedOrigins", () => {
  it("trusts a preview deployment's own addresses", () => {
    expect(previewTrustedOrigins({ VERCEL_ENV: "preview", ...hosts })).toEqual([
      "https://brandbite-abc123.vercel.app",
      "https://brandbite-git-feature.vercel.app",
    ]);
  });

  it.each([
    ["production", { VERCEL_ENV: "production", ...hosts }],
    ["development", { VERCEL_ENV: "development", ...hosts }],
    ["outside Vercel", {}],
  ])("adds nothing in %s", (_label, env) => {
    expect(previewTrustedOrigins(env)).toEqual([]);
  });

  it("skips an address Vercel didn't provide", () => {
    expect(previewTrustedOrigins({ VERCEL_ENV: "preview", VERCEL_URL: hosts.VERCEL_URL })).toEqual([
      "https://brandbite-abc123.vercel.app",
    ]);
  });
});
