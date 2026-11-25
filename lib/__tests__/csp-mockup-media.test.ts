// Mockup Studio plays a screen recording the visitor picked from their own
// device, through a blob: address. If the Content-Security-Policy doesn't
// allow blob: media, the browser refuses the video and the studio can only
// say "We couldn't read that file". Guard it here.
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

async function directive(name: string): Promise<string[]> {
  const rules = await nextConfig.headers!();
  const csp = rules
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === "Content-Security-Policy");
  expect(csp, "Content-Security-Policy header").toBeDefined();
  const found = csp!.value.split(";").find((part) => part.trim().startsWith(`${name} `));
  return (found ?? "").trim().split(/\s+/).slice(1);
}

describe("CSP allows Mockup Studio's media", () => {
  it("lets a video play from a file the visitor picked", async () => {
    expect(await directive("media-src")).toEqual(expect.arrayContaining(["'self'", "blob:"]));
  });

  it("lets the picked image and the exported picture be drawn", async () => {
    expect(await directive("img-src")).toContain("blob:");
  });
});
