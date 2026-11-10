// The browser uploads source files straight to Google Drive and R2. If the
// Content-Security-Policy doesn't allow those hosts, the upload is blocked
// before it leaves the browser and only shows up as "connection dropped"
// (fake storage in tests never notices). Guard the hosts here.
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

async function connectSrc(): Promise<string[]> {
  const rules = await nextConfig.headers!();
  const csp = rules
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === "Content-Security-Policy");
  expect(csp, "Content-Security-Policy header").toBeDefined();
  const directive = csp!.value.split(";").find((part) => part.trim().startsWith("connect-src"));
  return (directive ?? "").trim().split(/\s+/).slice(1);
}

describe("CSP allows direct uploads", () => {
  it("lets the browser PUT source files to Google Drive", async () => {
    expect(await connectSrc()).toContain("https://www.googleapis.com");
  });

  it("lets the browser PUT source files to R2", async () => {
    expect(await connectSrc()).toContain("https://*.r2.cloudflarestorage.com");
  });
});
