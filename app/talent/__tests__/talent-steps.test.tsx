// -----------------------------------------------------------------------------
// @file: app/talent/__tests__/talent-steps.test.tsx
// @purpose: The four-step talent application: Continue checks the current
//           step, shows what's missing, and moves on once it's complete.
// -----------------------------------------------------------------------------

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <span>{props.alt}</span>,
}));
vi.mock("@marsidev/react-turnstile", () => ({ Turnstile: () => null }));

import TalentApplicationPage from "../page";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/api/talent/categories")) {
        return new Response(
          JSON.stringify({
            categories: [{ id: "c1", name: "Brand design", slug: "brand", sortOrder: 0 }],
          }),
        );
      }
      return new Response(JSON.stringify({ open: true }));
    }),
  );
  // jsdom has no layout; the form scrolls and focuses on step changes.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("talent application steps", () => {
  it("keeps you on step 1 and lists what's missing", async () => {
    render(<TalentApplicationPage />);
    fireEvent.click(await screen.findByRole("button", { name: /continue/i }));

    expect(screen.getByText("Enter your full name.")).toBeTruthy();
    expect(screen.getByText("Enter a link to your portfolio.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Profile & portfolio" })).toBeTruthy();
  });

  it("moves to step 2 once step 1 is complete, accepting a link without https://", async () => {
    render(<TalentApplicationPage />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText(/country of residence/i), { target: { value: "TR" } });
    fireEvent.change(screen.getByLabelText(/whatsapp number/i), {
      target: { value: "555 123 4567" },
    });
    fireEvent.change(screen.getByLabelText(/portfolio url/i), {
      target: { value: "behance.net/ada" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /continue/i }));

    expect(
      await screen.findByRole("heading", { level: 2, name: "Skills & experience" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /^back$/i })).toBeTruthy();
  });
});
