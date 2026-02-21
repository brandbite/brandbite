// -----------------------------------------------------------------------------
// @file: components/ui/__tests__/badge.test.tsx
// @purpose: Component tests for the Badge pill component
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("defaults to neutral variant", () => {
    render(<Badge>Status</Badge>);
    const el = screen.getByText("Status");
    expect(el.className).toContain("bb-bg-card");
  });

  const variants: BadgeVariant[] = [
    "neutral",
    "primary",
    "info",
    "success",
    "warning",
    "danger",
  ];

  variants.forEach((variant) => {
    it(`renders ${variant} variant with correct styling`, () => {
      render(<Badge variant={variant}>{variant}</Badge>);
      const el = screen.getByText(variant);
      expect(el).toBeInTheDocument();
      // All variants should have rounded-full styling
      expect(el.className).toContain("rounded-full");
    });
  });

  it("forwards custom className", () => {
    render(<Badge className="ml-2">Custom</Badge>);
    const el = screen.getByText("Custom");
    expect(el.className).toContain("ml-2");
  });

  it("renders as inline-flex span", () => {
    render(<Badge>Tag</Badge>);
    const el = screen.getByText("Tag");
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toContain("inline-flex");
  });
});
