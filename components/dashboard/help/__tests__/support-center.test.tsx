import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SupportCenter } from "../support-center";

function popularSection() {
  return screen.getByRole("heading", { name: "Popular guides" }).closest("section")!;
}

describe("SupportCenter popular guides", () => {
  it("links each role's picks to their guides", () => {
    render(<SupportCenter role="customer" />);
    const links = within(popularSection()).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/customer/support/create-request",
      "/customer/support/review-and-approve",
      "/customer/support/tokens",
    ]);
  });

  it("uses the creative's own guides", () => {
    render(<SupportCenter role="creative" />);
    const links = within(popularSection()).getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/creative/support/deliver-work");
  });

  it("gives way to the results while searching", () => {
    render(<SupportCenter role="customer" />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "moodboards" } });
    expect(screen.queryByRole("heading", { name: "Popular guides" })).toBeNull();
    expect(screen.getByRole("link", { name: /Moodboards/ })).toBeInTheDocument();
  });
});
