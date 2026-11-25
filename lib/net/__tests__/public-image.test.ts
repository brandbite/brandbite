// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isPublicAddress, PublicImageError, publicImageUrl } from "../public-image";

describe("fetching a picture a visitor pointed at", () => {
  it("treats only open-internet addresses as public", () => {
    for (const address of ["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"]) {
      expect(isPublicAddress(address), address).toBe(true);
    }
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "255.255.255.255",
      "::1",
      "::",
      "fe80::1",
      "fc00::1",
      "fd12:3456::1",
      "ff02::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "::ffff:7f00:1",
      "2001:db8::1",
      "not-an-ip",
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
    expect(isPublicAddress("::ffff:8.8.8.8")).toBe(true);
  });

  it("accepts only a plain https address on a public host name", () => {
    expect(publicImageUrl("https://acme.com/logo.png").hostname).toBe("acme.com");
    for (const address of [
      "http://acme.com/logo.png",
      "https://acme.com:8443/logo.png",
      "https://user:pass@acme.com/logo.png",
      "https://127.0.0.1/logo.png",
      "https://[::1]/logo.png",
      "https://localhost/logo.png",
      "https://intranet/logo.png",
      "https://db.internal/logo.png",
      "https://printer.local/logo.png",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "nonsense",
    ]) {
      expect(() => publicImageUrl(address), address).toThrow(PublicImageError);
    }
  });
});
