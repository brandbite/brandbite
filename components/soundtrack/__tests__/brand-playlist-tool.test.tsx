// -----------------------------------------------------------------------------
// @file: components/soundtrack/__tests__/brand-playlist-tool.test.tsx
// @purpose: The Brand playlist generator gives the playlist made for the mix
//           of the picked words' moods, not just the first word's.
// -----------------------------------------------------------------------------

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandPlaylistTool, type ToolMood } from "@/components/soundtrack/brand-playlist-tool";
import { comboKey, comboLabel } from "@/lib/soundtrack/combos";

const list = (id: string) => ({
  url: `https://open.spotify.com/playlist/${id}`,
  embedUrl: `https://open.spotify.com/embed/playlist/${id}`,
  title: id,
});

const moods: ToolMood[] = [
  { value: "MINIMAL", label: "Minimal · Calm", words: ["Calm", "Modern"], playlists: [] },
  { value: "LUXURY", label: "Luxury · Elegant", words: ["Elegant"], playlists: [] },
  { value: "BOLD", label: "Bold · Confident", words: ["Bold"], playlists: [list("ownerBold")] },
];
const mixes = {
  MINIMAL: list("minimal"),
  BOLD: list("bold"),
  "MINIMAL+BOLD": list("minimalBold"),
  "MINIMAL+LUXURY+BOLD": list("all3"),
};

const pick = (word: string) => fireEvent.click(screen.getByRole("button", { name: word }));
const playing = () => document.querySelector("iframe")?.getAttribute("src");

describe("combo keys", () => {
  it("ignore pick order and repeats", () => {
    expect(comboKey(["BOLD", "MINIMAL", "BOLD"])).toBe("MINIMAL+BOLD");
    expect(comboLabel(["BOLD", "MINIMAL"])).toBe("Bold + Minimal");
    expect(comboLabel(["BOLD"])).toBe("Bold · Confident");
  });
});

describe("BrandPlaylistTool", () => {
  it("plays the playlist for the mix of the picked moods", () => {
    render(<BrandPlaylistTool moods={moods} mixes={mixes} />);
    pick("Bold");
    expect(playing()).toContain("/bold");
    pick("Calm");
    expect(playing()).toContain("/minimalBold");
    expect(screen.getByText("Bold + Minimal")).toBeTruthy();
    pick("Elegant");
    expect(playing()).toContain("/all3");
  });

  it("treats two words of the same mood as that mood", () => {
    render(<BrandPlaylistTool moods={moods} mixes={mixes} />);
    pick("Calm");
    pick("Modern");
    expect(playing()).toContain("/minimal");
    expect(screen.getByText("Minimal · Calm")).toBeTruthy();
  });

  it("offers the owner's lists for the picked moods under Try another", () => {
    render(<BrandPlaylistTool moods={moods} mixes={mixes} />);
    pick("Bold");
    fireEvent.click(screen.getByRole("button", { name: "Try another" }));
    expect(playing()).toContain("/ownerBold");
  });

  it("says so when a mix has no playlist", () => {
    render(<BrandPlaylistTool moods={moods} mixes={mixes} />);
    pick("Elegant");
    expect(screen.getByText(/don.t have a playlist for Luxury · Elegant yet/)).toBeTruthy();
    expect(playing()).toBeUndefined();
  });
});
