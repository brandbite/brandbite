import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { linkifyFaqAnswer } from "../faq-answer-text";

function renderAnswer(text: string) {
  return render(<p>{linkifyFaqAnswer(text)}</p>);
}

describe("linkifyFaqAnswer", () => {
  it("links brandbite.studio paths inside the site", () => {
    renderAnswer("Book a call at brandbite.studio/meet and we'll talk.");
    expect(screen.getByRole("link", { name: "brandbite.studio/meet" })).toHaveAttribute(
      "href",
      "/meet",
    );
  });

  it("turns email addresses into mailto links, not site links", () => {
    renderAnswer("Contact us at hello@brandbite.studio to discuss.");
    const link = screen.getByRole("link", { name: "hello@brandbite.studio" });
    expect(link).toHaveAttribute("href", "mailto:hello@brandbite.studio");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("leaves plain text alone", () => {
    const { container } = renderAnswer("No links here.");
    expect(container.textContent).toBe("No links here.");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
