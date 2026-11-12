import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FaqExplorer } from "@/components/dashboard/help/faq-explorer";
import { toAnchor } from "@/components/dashboard/help/guide-meta";
import { GuideView } from "@/components/dashboard/help/guide-view";
import { PAGE_SIZE, SupportCenter } from "@/components/dashboard/help/support-center";
import { getGuide, getGuides, groupGuides, guideHref, type SupportGuide } from "@/lib/support";

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

function topicButtons() {
  return within(screen.getByRole("group", { name: "Topics" })).getAllByRole("button");
}

/** The open topic's card (its heading is the only h3 on the page). */
function topicList() {
  return within(screen.getByRole("heading", { level: 3 }).closest("section")!);
}

const titleLink = (title: string) => ({ name: new RegExp(`^${title}`) });

describe("Support center", () => {
  it("offers one pill per topic and every guide is reachable from its topic", () => {
    render(<SupportCenter role="customer" />);
    const groups = groupGuides("customer", getGuides("customer"));
    expect(topicButtons().map((b) => b.textContent)).toEqual(groups.map((g) => g.category));

    for (const group of groups) {
      fireEvent.click(screen.getByRole("button", { name: group.category }));
      expect(screen.getByRole("button", { name: group.category })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      for (let page = 0; page * PAGE_SIZE < group.items.length; page++) {
        if (page > 0) fireEvent.click(screen.getByRole("button", { name: "Next page" }));
        for (const guide of group.items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
          expect(topicList().getByRole("link", titleLink(guide.title))).toHaveAttribute(
            "href",
            guideHref("customer", guide.slug),
          );
        }
      }
    }
  });

  it("pages a long topic six guides at a time", () => {
    render(<SupportCenter role="admin" isSiteOwner />);
    const workspace = groupGuides("admin", getGuides("admin", { isSiteOwner: true })).find(
      (g) => g.category === "Workspace",
    )!;
    expect(workspace.items.length).toBeGreaterThan(PAGE_SIZE);
    const total = workspace.items.length;
    const last = workspace.items[total - 1];

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    expect(screen.getByText(`Showing 1–${PAGE_SIZE} of ${total}`)).toBeInTheDocument();
    expect(topicList().queryByRole("link", titleLink(last.title))).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(topicList().getByRole("link", titleLink(last.title))).toBeInTheDocument();

    // Another topic, and back: the list starts on its first page again.
    fireEvent.click(screen.getByRole("button", { name: "Catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    expect(screen.getByText(`Showing 1–${PAGE_SIZE} of ${total}`)).toBeInTheDocument();
  });

  it("lists owner-only admin guides for site owners only", () => {
    const ownerOnly = getGuides("admin", { isSiteOwner: true }).find((g) => g.ownerOnly)!;
    const { unmount } = render(<SupportCenter role="admin" />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: ownerOnly.title } });
    expect(screen.queryByRole("link", titleLink(ownerOnly.title))).toBeNull();
    unmount();

    render(<SupportCenter role="admin" isSiteOwner />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: ownerOnly.title } });
    expect(screen.getByRole("link", titleLink(ownerOnly.title))).toBeInTheDocument();
  });

  it("searches across topics, for the viewer's role only", () => {
    render(<SupportCenter role="creative" />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search support guides" }), {
      target: { value: "withdrawal" },
    });
    expect(screen.queryByRole("group", { name: "Topics" })).toBeNull();
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
    expect(screen.getByRole("button", { name: "Account" })).toHaveAttribute("aria-pressed", "true");
  });

  it("marks guides that have screenshots", () => {
    const base = getGuide("customer", "moodboards")!;
    const withImage: SupportGuide = {
      ...base,
      sections: [
        { heading: "Look", blocks: [{ type: "figure", caption: "Board", image: "/x.png" }] },
      ],
    };
    const others = getGuides("customer").filter((g) => g.slug !== base.slug);
    render(<SupportCenter role="customer" guides={[withImage, ...others]} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: base.title } });
    const row = screen.getByRole("link", titleLink(base.title));
    expect(within(row).getByText("Visual guide")).toBeInTheDocument();
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

  it("shows the first two sections and folds the rest until one is picked", () => {
    expect(guide.sections.length).toBeGreaterThan(3);
    const { container } = render(<GuideView role="customer" guide={guide} />);
    const details = () => [...container.querySelectorAll("details")];
    expect(details().map((d) => d.id)).toEqual(
      guide.sections.slice(2).map((s) => toAnchor(s.heading)),
    );
    expect(details().some((d) => d.open)).toBe(false);

    const nav = screen.getAllByRole("navigation", { name: "On this page" })[0];
    fireEvent.click(within(nav).getByRole("link", { name: "Deleting" }));
    expect(container.querySelector<HTMLDetailsElement>("details#deleting")?.open).toBe(true);
  });

  it("shows short guides in full", () => {
    const short = { ...guide, sections: guide.sections.slice(0, 3) };
    const { container } = render(<GuideView role="customer" guide={short} />);
    expect(container.querySelectorAll("details")).toHaveLength(0);
  });

  it("links back to the guide's topic and to the page it documents", () => {
    render(<GuideView role="customer" guide={guide} />);
    expect(screen.getByRole("link", { name: /All guides/ })).toHaveAttribute(
      "href",
      "/customer/support#workspace",
    );
    expect(screen.getByRole("link", { name: /Open Moodboards/ })).toHaveAttribute(
      "href",
      "/customer/moodboards",
    );
  });

  it("names the admin page a guide opens", () => {
    render(<GuideView role="admin" guide={getGuide("admin", "board-and-tickets")!} />);
    expect(screen.getByRole("link", { name: /Open Board/ })).toHaveAttribute(
      "href",
      "/admin/board",
    );
  });

  describe("screenshots", () => {
    const withBlocks = (blocks: SupportGuide["sections"][number]["blocks"]): SupportGuide => ({
      ...guide,
      sections: [{ heading: "Look", blocks }],
    });

    it("numbers the screenshots that have an image", () => {
      render(
        <GuideView
          role="customer"
          guide={withBlocks([
            { type: "figure", caption: "First", image: "/a.png" },
            { type: "figure", caption: "Missing" },
            { type: "figure", caption: "Second", image: "/b.png", alt: "Two columns" },
          ])}
        />,
      );
      expect(screen.getByText("Figure 1. First")).toBeInTheDocument();
      expect(screen.getByText("Figure 2. Second")).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Two columns" })).toHaveAttribute("src", "/b.png");
    });

    it("offers the phone screenshot to phones, with a switch to the desktop one", () => {
      const { container } = render(
        <GuideView
          role="customer"
          guide={withBlocks([
            { type: "figure", caption: "Board", image: "/a.png", mobileImage: "/a-phone.png" },
          ])}
        />,
      );
      const phoneSource = () => container.querySelector("picture source");
      expect(screen.getByRole("img", { name: "Board" })).toHaveAttribute("src", "/a.png");
      expect(phoneSource()).toHaveAttribute("srcset", "/a-phone.png");
      expect(phoneSource()).toHaveAttribute("media", "(max-width: 639.98px)");
      expect(screen.getByRole("button", { name: "Phone" })).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(screen.getByRole("button", { name: "Desktop" }));
      expect(phoneSource()).toBeNull();
      expect(screen.getByRole("button", { name: "Desktop" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      fireEvent.click(screen.getByRole("button", { name: "Phone" }));
      expect(phoneSource()).toHaveAttribute("srcset", "/a-phone.png");
    });

    it("shows no switch when a screenshot has no phone version", () => {
      const { container } = render(
        <GuideView
          role="customer"
          guide={withBlocks([{ type: "figure", caption: "Board", image: "/a.png" }])}
        />,
      );
      expect(screen.queryByRole("button", { name: "Desktop" })).toBeNull();
      expect(container.querySelector("picture source")).toBeNull();
    });

    it("hides empty screenshot slots from customers and creatives", () => {
      render(
        <GuideView role="customer" guide={withBlocks([{ type: "figure", caption: "Gap" }])} />,
      );
      expect(screen.queryByText("Gap")).toBeNull();
    });

    it("shows admins where a screenshot is missing and where to add it", () => {
      render(<GuideView role="admin" guide={getGuide("admin", "board-and-tickets")!} />);
      const slot = screen.getByRole("figure", { name: /Board columns and filters/ });
      expect(within(slot).getByRole("link", { name: "Add it" })).toHaveAttribute(
        "href",
        "/admin/support-content/admin/board-and-tickets",
      );
    });
  });
});
