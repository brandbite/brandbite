// -----------------------------------------------------------------------------
// @file: components/ui/__tests__/safe-html.test.tsx
// @purpose: SafeHtml sanitizes XSS attempts and respects allowed tag/attr sets
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CMS_ALLOWED_ATTR, CMS_ALLOWED_TAGS, SafeHtml } from "../safe-html";

describe("SafeHtml", () => {
  it("strips <script> tags from input", () => {
    const { container } = render(<SafeHtml html='<p>hello</p><script>alert("xss")</script>' />);
    expect(container.innerHTML).not.toContain("<script");
    expect(container.innerHTML).toContain("<p>hello</p>");
  });

  it("strips event-handler attributes like onclick", () => {
    const { container } = render(<SafeHtml html='<p onclick="alert(1)">text</p>' />);
    expect(container.innerHTML).not.toContain("onclick");
  });

  it("strips javascript: URLs from links", () => {
    const { container } = render(<SafeHtml html='<a href="javascript:alert(1)">click</a>' />);
    expect(container.innerHTML).not.toContain("javascript:");
  });

  it("default whitelist blocks headings", () => {
    const { container } = render(<SafeHtml html="<h2>title</h2><p>body</p>" />);
    expect(container.innerHTML).not.toContain("<h2");
    expect(container.innerHTML).toContain("<p>body</p>");
  });

  it("CMS whitelist allows headings, blockquote, img", () => {
    const { container } = render(
      <SafeHtml
        html='<h2>title</h2><blockquote>quote</blockquote><img src="/x.png" alt="x" />'
        allowedTags={CMS_ALLOWED_TAGS}
        allowedAttrs={CMS_ALLOWED_ATTR}
      />,
    );
    expect(container.innerHTML).toContain("<h2");
    expect(container.innerHTML).toContain("<blockquote");
    expect(container.innerHTML).toContain("<img");
  });

  it("CMS whitelist still blocks <script>", () => {
    const malicious = '<h2>ok</h2><script>alert(1)</script><img src="x" onerror="alert(2)">';
    const { container } = render(
      <SafeHtml html={malicious} allowedTags={CMS_ALLOWED_TAGS} allowedAttrs={CMS_ALLOWED_ATTR} />,
    );
    expect(container.innerHTML).not.toContain("<script");
    expect(container.innerHTML).not.toContain("onerror");
  });

  it("renders with custom element via `as` prop", () => {
    const { container } = render(<SafeHtml html="<p>x</p>" as="article" />);
    expect(container.querySelector("article")).not.toBeNull();
  });

  it("wraps plain text with newlines in paragraphs", () => {
    const { container } = render(<SafeHtml html={"line one\n\nline two"} />);
    expect(container.innerHTML).toContain("<p>line one</p>");
    expect(container.innerHTML).toContain("<p>line two</p>");
  });
});
