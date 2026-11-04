// -----------------------------------------------------------------------------
// @file: lib/__tests__/rich-text-links.test.ts
// @purpose: Rich-text link normalisation (internal paths, mailto, bare
//           domains, unsafe schemes).
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { normalizeLinkHref } from "../rich-text-links";

describe("normalizeLinkHref", () => {
  it.each([
    ["https://brandbite.studio/pricing", "https://brandbite.studio/pricing"],
    ["http://example.com", "http://example.com"],
    ["/pricing", "/pricing"],
    ["/blog/hello?x=1#top", "/blog/hello?x=1#top"],
    ["#faq", "#faq"],
    ["mailto:hello@brandbite.studio", "mailto:hello@brandbite.studio"],
    ["tel:+905551112233", "tel:+905551112233"],
    ["brandbite.studio", "https://brandbite.studio"],
    ["www.example.com/path", "https://www.example.com/path"],
    ["localhost:3000/x", "https://localhost:3000/x"],
    ["//cdn.example.com/a.png", "https://cdn.example.com/a.png"],
    ["  /pricing  ", "/pricing"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeLinkHref(input)).toBe(expected);
  });

  it.each(["javascript:alert(1)", "data:text/html,hi", "vbscript:x", "   "])(
    "refuses %s",
    (input) => {
      expect(normalizeLinkHref(input)).toBeNull();
    },
  );
});
