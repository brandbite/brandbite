import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FaqExplorer } from "@/components/dashboard/help/faq-explorer";
import { GuideView } from "@/components/dashboard/help/guide-view";
import { SupportCenter } from "@/components/dashboard/help/support-center";
import { getGuide, getGuides, groupGuides, guideHref } from "@/lib/support";

const faq = (id: number, category: string, question = `Question ${id}?`) => ({
  id: String(id),
  question,
  answer: `Answer ${id}.`,
  category,
});

function mockFaq(faqs: ReturnType<typeof faq>[]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    Response.json({ faqs, categories: [...new Set(faqs.map((f) => f.category))] }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = "";
});

describe("FAQ explorer", () => {
  it("shows one selected answer and follows the chosen question", async () => {
    mockFaq([faq(1, "General"), faq(2, "General")]);
    render(<FaqExplorer />);

    const first = await screen.findByRole("button", { name: "Question 1?" });
    expect(first).toHaveAttribute("aria-current", "true");
    expect(screen.getAllByText("Answer 1.").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Question 2?" }));
    expect(screen.getByRole("button", { name: "Question 2?" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getAllByText("Answer 2.").length).toBeGreaterThan(0);
    expect(screen.queryByText("Answer 1.")).toBeNull();
  });

  it("searches questions and answers, and says when nothing matches", async () => {
    mockFaq([faq(1, "General", "What is brandbite?"), faq(2, "General", "Can I cancel?")]);
    render(<FaqExplorer />);
    const search = await screen.findByRole("searchbox", { name: "Search questions" });

    fireEvent.change(search, { target: { value: "cancel" } });
    expect(screen.queryByRole("button", { name: "What is brandbite?" })).toBeNull();
    expect(screen.getByRole("button", { name: "Can I cancel?" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 question");

    fireEvent.change(search, { target: { value: "nothing like this" } });
    expect(screen.getByText("No questions match")).toBeInTheDocument();
  });

  it("keeps a restricted audience to its categories", async () => {
    mockFaq([faq(1, "General"), faq(2, "Pricing & Billing")]);
    render(<FaqExplorer categories={["General"]} />);
    await screen.findByRole("button", { name: "Question 1?" });
    expect(screen.queryByRole("button", { name: "Question 2?" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pricing & Billing" })).toBeNull();
  });

  it("pages long lists and shows the first question of the new page", async () => {
    mockFaq(Array.from({ length: 8 }, (_, i) => faq(i + 1, "General")));
    render(<FaqExplorer />);
    await screen.findByRole("button", { name: "Question 1?" });
    expect(screen.queryByRole("button", { name: "Question 7?" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Question 7?" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("reports a failed load instead of claiming there are no questions", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({ error: "down" }, { status: 500 }),
    );
    render(<FaqExplorer />);
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load");
  });
});

describe("Support center", () => {
  it("offers one tab per topic and every guide is reachable from its tab", async () => {
    render(<SupportCenter role="customer" />);
    const groups = groupGuides("customer", getGuides("customer"));
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(
      groups.map((g) => g.category),
    );

    for (const group of groups) {
      fireEvent.click(screen.getByRole("tab", { name: group.category }));
      for (const guide of group.items) {
        // Inside the panel, because a popular guide is also listed above the tabs.
        const panel = within(screen.getByRole("tabpanel"));
        expect(panel.getByRole("link", { name: new RegExp(guide.title) })).toHaveAttribute(
          "href",
          guideHref("customer", guide.slug),
        );
      }
    }
  });

  it("searches across topics, for the viewer's role only", () => {
    render(<SupportCenter role="creative" />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search support guides" }), {
      target: { value: "withdrawal" },
    });
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByRole("link", { name: /Withdraw/ })).toHaveAttribute(
      "href",
      guideHref("creative", "withdrawals"),
    );
  });

  it("explains an empty search", () => {
    render(<SupportCenter role="customer" />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search support guides" }), {
      target: { value: "zzzzqqqq" },
    });
    expect(screen.getByText("No guides match your search")).toBeInTheDocument();
  });

  it("opens the topic named in the URL", () => {
    window.location.hash = "#account";
    render(<SupportCenter role="customer" />);
    expect(screen.getByRole("tab", { name: "Account" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Guide view", () => {
  const guide = getGuide("customer", "moodboards")!;

  it("renders every section and lists it in the page navigation", () => {
    render(<GuideView role="customer" guide={guide} />);
    const nav = screen.getAllByRole("navigation", { name: "On this page" })[0];
    for (const section of guide.sections) {
      expect(within(nav).getByRole("link", { name: section.heading })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: section.heading })).toBeInTheDocument();
    }
  });

  it("starts with the first section open and opens the one picked in the navigation", async () => {
    const { container } = render(<GuideView role="customer" guide={guide} />);
    const details = () => [...container.querySelectorAll("details")];
    expect(details().map((d) => d.open)).toEqual(guide.sections.map((_, i) => i === 0));

    const nav = screen.getAllByRole("navigation", { name: "On this page" })[0];
    fireEvent.click(within(nav).getByRole("link", { name: "Deleting" }));
    expect(container.querySelector<HTMLDetailsElement>("details#deleting")?.open).toBe(true);
  });

  it("can open and close all sections", async () => {
    const { container } = render(<GuideView role="customer" guide={guide} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect([...container.querySelectorAll("details")].every((d) => d.open)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect([...container.querySelectorAll("details")].some((d) => d.open)).toBe(false);
  });

  it("links back to the guide's topic and to the page it documents", () => {
    render(<GuideView role="customer" guide={guide} />);
    expect(screen.getByRole("link", { name: /Back to support/ })).toHaveAttribute(
      "href",
      "/customer/support#workspace",
    );
    expect(screen.getByRole("link", { name: /Open this page/ })).toHaveAttribute(
      "href",
      "/customer/moodboards",
    );
  });
});
