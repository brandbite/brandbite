import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { describeColor, parseOpaqueHex } from "@/lib/colors";
import { COLOR_FAMILIES } from "@/lib/colors/color-families";
import { NAMED_COLORS, findNamedColor } from "@/lib/colors/named-colors";
import { PALETTE_IDEA_CATALOG } from "@/lib/colors/palette-idea-catalog";

const { mockIdeas, mockMeaningFind, mockMeanings, notFound } = vi.hoisted(() => ({
  mockIdeas: vi.fn(),
  mockMeanings: vi.fn(),
  mockMeaningFind: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    paletteIdea: { findMany: mockIdeas },
    colorMeaning: { findMany: mockMeanings, findFirst: mockMeaningFind },
  },
}));
vi.mock("next/navigation", () => ({
  notFound,
  usePathname: () => "/colors",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

import MeaningPage, {
  generateMetadata as meaningMetadata,
} from "@/app/colors/color-meanings/[slug]/page";
import ColorPage, { generateMetadata as colorMetadata } from "@/app/colors/hex/[hex]/page";
import ColorLibraryPage from "@/app/colors/hex/page";
import PalettePage, {
  generateMetadata as paletteMetadata,
} from "@/app/colors/palettes/[slug]/page";
import sitemap from "@/app/sitemap";
import { getColorMeaning, getColorMeanings, getPaletteIdeas } from "@/lib/colors/content";
import { resolveHexRoute } from "@/lib/colors/hex-route";

const params = <T,>(value: T) => ({ params: Promise.resolve(value) });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockIdeas.mockReset().mockResolvedValue([]);
  mockMeanings.mockReset().mockResolvedValue([]);
  mockMeaningFind.mockReset().mockResolvedValue(null);
});

describe("named colors", () => {
  it("are valid, and have unique names and values", () => {
    expect(NAMED_COLORS.length).toBeGreaterThanOrEqual(150);
    for (const color of NAMED_COLORS) expect(parseOpaqueHex(color.hex)).toBe(color.hex);
    expect(new Set(NAMED_COLORS.map((c) => c.hex)).size).toBe(NAMED_COLORS.length);
    expect(new Set(NAMED_COLORS.map((c) => c.name)).size).toBe(NAMED_COLORS.length);
  });

  it("all land in a family that has content", () => {
    for (const color of NAMED_COLORS) {
      const { family } = describeColor(color.hex);
      expect(COLOR_FAMILIES.some((f) => f.slug === family)).toBe(true);
    }
  });

  it("are found by value, ignoring case", () => {
    expect(findNamedColor("#FF7F50")?.name).toBe("Coral");
    expect(findNamedColor("#123456")).toBeNull();
  });
});

describe("content fallbacks", () => {
  it("puts CMS palettes first and doesn't repeat a slug", async () => {
    mockIdeas.mockResolvedValue([
      {
        id: "1",
        title: "CMS version",
        slug: PALETTE_IDEA_CATALOG[0].slug,
        summary: null,
        colors: ["#000000"],
        tags: [],
      },
    ]);
    const ideas = await getPaletteIdeas();
    expect(ideas[0].title).toBe("CMS version");
    expect(ideas.filter((i) => i.slug === PALETTE_IDEA_CATALOG[0].slug)).toHaveLength(1);
    expect(ideas).toHaveLength(PALETTE_IDEA_CATALOG.length);
  });

  it("serves built-in content when the CMS can't be reached", async () => {
    mockIdeas.mockRejectedValue(new Error("db down"));
    mockMeanings.mockRejectedValue(new Error("db down"));
    mockMeaningFind.mockRejectedValue(new Error("db down"));
    expect(await getPaletteIdeas()).toHaveLength(PALETTE_IDEA_CATALOG.length);
    expect(await getColorMeanings()).toHaveLength(COLOR_FAMILIES.length);
    expect((await getColorMeaning("teal"))?.name).toBe("Teal");
  });

  it("returns nothing for an unknown meaning", async () => {
    expect(await getColorMeaning("nope")).toBeNull();
  });
});

describe("color page", () => {
  it("renders a named color's values, contrast and related colors", async () => {
    render(await ColorPage(params({ hex: "ff7f50" })));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Coral #FF7F50");
    expect(screen.getByText("rgb(255, 127, 80)")).toBeInTheDocument();
    expect(screen.getByText("On white")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Related colors" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "More about orange" })).toHaveAttribute(
      "href",
      "/colors/color-meanings/orange",
    );
  });

  it("indexes named colors only", async () => {
    const coral = await colorMetadata(params({ hex: "ff7f50" }));
    expect(coral.title).toBe("Coral Hex Code #FF7F50");
    expect(coral.robots).toBeUndefined();
    expect(coral.alternates?.canonical).toBe("/colors/hex/ff7f50");

    const other = await colorMetadata(params({ hex: "123457" }));
    expect(other.robots).toEqual({ index: false, follow: true });
  });

  it("still works for any other valid HEX", async () => {
    render(await ColorPage(params({ hex: "123457" })));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("#123457");
  });

  it.each(["nope", "ff642680", "12345", "<script>"])("answers 404 for %s", async (hex) => {
    await expect(ColorPage(params({ hex }))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("color addresses", () => {
  it("leaves the canonical address and other paths alone", () => {
    expect(resolveHexRoute("/colors/hex/ff7f50")).toEqual({ kind: "page" });
    expect(resolveHexRoute("/colors/hex/ff7f50/opengraph-image")).toEqual({ kind: "page" });
    expect(resolveHexRoute("/colors/hex")).toEqual({ kind: "page" });
    expect(resolveHexRoute("/colors/contrast-checker")).toEqual({ kind: "page" });
  });

  it.each([
    ["/colors/hex/FF7F50", "/colors/hex/ff7f50"],
    ["/colors/hex/%23ff7f50", "/colors/hex/ff7f50"],
    ["/colors/hex/f75", "/colors/hex/ff7755"],
    ["/colors/hex/FF7F50/opengraph-image", "/colors/hex/ff7f50/opengraph-image"],
  ])("sends %s to one address", (from, to) => {
    expect(resolveHexRoute(from)).toEqual({ kind: "redirect", to });
  });

  it.each([
    "nope",
    "ff642680",
    "12345",
    "%3Cscript%3E",
    "%E0%A4%A",
    "ff7f50/extra",
    "nope/opengraph-image",
    "",
  ])("treats %s as missing", (value) => {
    expect(resolveHexRoute(`/colors/hex/${value}`)).toEqual({ kind: "missing" });
  });
});

describe("color family page", () => {
  it("lists the family's colors, without repeating the summary as an article", async () => {
    render(await MeaningPage(params({ slug: "orange" })));
    expect(
      screen.getByRole("heading", { name: "Orange colors and hex codes" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Coral/ })).toHaveAttribute(
      "href",
      "/colors/hex/ff7f50",
    );
    expect(screen.queryByRole("heading", { name: "Meaning and psychology" })).toBeNull();
  });

  it("keeps the brand in the title", async () => {
    const meta = await meaningMetadata(params({ slug: "orange" }));
    expect(meta.title).toEqual({ absolute: "Orange Color Meaning | brandbite" });
  });

  it("answers 404 for an unknown color", async () => {
    await expect(MeaningPage(params({ slug: "nope" }))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("color library", () => {
  it("links every named color", () => {
    render(ColorLibraryPage());
    const links = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/colors/hex/"));
    expect(links).toHaveLength(NAMED_COLORS.length);
  });
});

describe("palette page", () => {
  const idea = PALETTE_IDEA_CATALOG[0];

  it("renders the palette, its colors and similar palettes", async () => {
    render(await PalettePage(params({ slug: idea.slug })));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(idea.title);
    expect(screen.getByText(idea.summary)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Similar palettes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in generator" })).toBeInTheDocument();
  });

  it("puts the hex codes in the description", async () => {
    const meta = await paletteMetadata(params({ slug: idea.slug }));
    expect(meta.title).toBe(`${idea.title} Color Palette`);
    expect(meta.description).toContain(idea.colors[0].toUpperCase());
  });

  it("answers 404 for an unknown palette", async () => {
    await expect(PalettePage(params({ slug: "nope" }))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("sitemap", () => {
  it("lists every indexed color page and none of the retired ones", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/colors/hex/ff7f50"))).toBe(true);
    expect(urls.some((u) => u.endsWith(`/colors/palettes/${idea0()}`))).toBe(true);
    expect(urls.some((u) => u.endsWith("/colors/color-meanings/teal"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/colors/hex"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/meet"))).toBe(true);
    expect(urls.some((u) => /coming-soon|pricing|showcase|how-it-works/.test(u))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

function idea0() {
  return PALETTE_IDEA_CATALOG[0].slug;
}
