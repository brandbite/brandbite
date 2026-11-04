import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MEANING_GUIDANCE } from "@/lib/colors/meaning-guidance";

import { ColorMeaningsView } from "../color-meanings-view";
import { OverviewView } from "../overview-view";
import { resetWorkspaceStoreForTests } from "../workspace-store";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

const SUMMARIES = [
  {
    id: "1",
    name: "Orange",
    slug: "orange",
    hex: "#f4801f",
    summary: "Warm and upbeat.",
    associations: ["warmth", "enthusiasm", "creativity", "playful"],
  },
  {
    id: "2",
    name: "Blue",
    slug: "blue",
    hex: "#0077b6",
    summary: "Calm and dependable.",
    associations: ["trust", "calm", "professional"],
  },
];

function mockApi() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const path = String(url);
    if (path.endsWith("/api/color-meanings")) {
      return new Response(JSON.stringify({ meanings: SUMMARIES }), { status: 200 });
    }
    const slug = path.split("/").pop();
    const summary = SUMMARIES.find((s) => s.slug === slug);
    return new Response(
      JSON.stringify({
        meaning: { ...summary, meaning: null, samplePalettes: [["#f4801f", "#1f2a44", "#fff3e0"]] },
      }),
      { status: 200 },
    );
  });
}

function storedWorkspace() {
  return JSON.parse(window.sessionStorage.getItem("brandbite.colorStudio.workspace.v1") as string);
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetWorkspaceStoreForTests();
  push.mockClear();
  vi.restoreAllMocks();
});

describe("ColorMeaningsView", () => {
  it("shows the first color's details and changes with selection", async () => {
    mockApi();
    render(<ColorMeaningsView />);
    expect(
      await screen.findByRole("complementary", { name: "Orange details" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Blue/ }));
    expect(screen.getByRole("complementary", { name: "Blue details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Blue/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("searches names and associations, with a separate empty result", async () => {
    mockApi();
    render(<ColorMeaningsView />);
    await screen.findByRole("button", { name: /^Orange/ });
    const search = screen.getByLabelText("Find a color or feeling");

    fireEvent.change(search, { target: { value: "trust" } });
    expect(screen.queryByRole("button", { name: /^Orange/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Blue/ })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("No colors match your search.")).toBeInTheDocument();
  });

  it("carries the color and its pairings into the generator", async () => {
    mockApi();
    render(<ColorMeaningsView />);
    await screen.findByRole("button", { name: "Copy #1F2A44" });
    fireEvent.click(screen.getByRole("button", { name: "Build an orange palette" }));
    expect(push).toHaveBeenCalledWith("/colors/color-palette-generator");
    expect(storedWorkspace().activePalette.colors.map((c: { hex: string }) => c.hex)).toEqual([
      "#f4801f",
      "#1f2a44",
      "#fff3e0",
    ]);
  });

  it("still shows built-in families when the CMS can't be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    render(<ColorMeaningsView />);
    expect(await screen.findByRole("button", { name: /^Teal/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("link", { name: /Read more/ })).toBeNull();
  });

  it("adds built-in families after CMS colors, without repeats", async () => {
    mockApi();
    render(<ColorMeaningsView />);
    await screen.findByRole("button", { name: /^Pink/ });
    expect(screen.getAllByRole("button", { name: /^Orange/ })).toHaveLength(1);
  });

  it("names any HEX and describes it from its closest family", async () => {
    mockApi();
    render(<ColorMeaningsView />);
    await screen.findByRole("button", { name: /^Orange/ });
    fireEvent.change(screen.getByLabelText("Look up any color"), {
      target: { value: "#0A2A43" },
    });
    const panel = screen.getByRole("complementary", { name: "Deep Blue details" });
    expect(panel).toHaveTextContent("Calm and dependable.");
    expect(panel).toHaveTextContent(/Based on the Blue color family/);
    expect(screen.queryByRole("link", { name: /Read more/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Build a deep blue palette" }));
    const colors = storedWorkspace().activePalette.colors;
    expect(colors[0].hex).toBe("#0a2a43");
    expect(colors.length).toBeGreaterThan(1);
  });

  it("returns to a family when a card is chosen after a lookup", async () => {
    mockApi();
    render(<ColorMeaningsView />);
    await screen.findByRole("button", { name: /^Orange/ });
    fireEvent.click(screen.getByRole("button", { name: "Find its meaning" }));
    expect(screen.getByRole("complementary", { name: "Muted Green details" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Orange/ }));
    expect(screen.getByRole("complementary", { name: "Orange details" })).toBeInTheDocument();
  });

  it("frames every cultural note as varying, for all published colors", () => {
    for (const slug of ["red", "orange", "yellow", "green", "blue", "purple", "black", "white"]) {
      expect(MEANING_GUIDANCE[slug].culturalContext).toMatch(/vary by audience and culture/);
      expect(MEANING_GUIDANCE[slug].worksWellFor.length).toBeGreaterThan(0);
    }
  });
});

describe("OverviewView", () => {
  it("carries the entered color into the tools", () => {
    render(<OverviewView />);
    fireEvent.change(screen.getByLabelText("Brand color"), { target: { value: "#173B59" } });
    fireEvent.click(screen.getByRole("button", { name: "Explore this color" }));
    expect(push).toHaveBeenCalledWith("/colors/tailwind-color-generator");
    expect(storedWorkspace().activePalette.colors[0].hex).toBe("#173b59");
  });

  it("links every tool", () => {
    render(<OverviewView />);
    for (const name of [
      /Tailwind shades/,
      /Palette generator/,
      /Color wheel/,
      /Palette ideas/,
      /Color meanings/,
      /Contrast checker/,
    ]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("labels explored colors and saved palettes separately", async () => {
    const { unmount } = render(<OverviewView />);
    expect(screen.queryByText("Recently explored")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Explore this color" }));
    unmount();

    render(<OverviewView />);
    expect(screen.getByText("Recently explored")).toBeInTheDocument();
    expect(screen.queryByText("Your saved palettes")).toBeNull();
  });
});
