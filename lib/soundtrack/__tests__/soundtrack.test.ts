// -----------------------------------------------------------------------------
// @file: lib/soundtrack/__tests__/soundtrack.test.ts
// @purpose: Spotify link parsing, the mood rules, and the admin setting that
//           holds each mood's playlists.
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { parseVideoUrl } from "@/lib/moodboard";
import { updateAdminSettingSchema } from "@/lib/schemas/admin-settings.schemas";

import { detectMood } from "../moods";
import { parseSpotifyList, parseSpotifyUrl, spotifyEmbedUrl } from "../spotify";

const PLAYLIST = "https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ";

describe("Spotify links", () => {
  it("reads playlist and album links, with share parameters or a locale prefix", () => {
    expect(parseSpotifyUrl(`${PLAYLIST}?si=abc123`)).toEqual({
      kind: "playlist",
      id: "37i9dQZF1DWZeKCadgRdKQ",
    });
    expect(
      parseSpotifyUrl("https://open.spotify.com/intl-tr/album/4aawyAB9vmqN3uQ7FjRGTy"),
    ).toEqual({ kind: "album", id: "4aawyAB9vmqN3uQ7FjRGTy" });
  });

  it.each([
    "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl",
    "https://evil.example/playlist/37i9dQZF1DWZeKCadgRdKQ",
    "http://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ",
    "javascript:alert(1)",
    "",
  ])("rejects %s", (url) => {
    expect(parseSpotifyUrl(url)).toBeNull();
  });

  it("builds the embed link", () => {
    expect(spotifyEmbedUrl(parseSpotifyUrl(PLAYLIST)!)).toBe(
      "https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKCadgRdKQ",
    );
  });

  it("splits a setting into clean, unique links", () => {
    expect(parseSpotifyList(`${PLAYLIST}?si=1, ${PLAYLIST}\nnot-a-link`)).toEqual([PLAYLIST]);
  });

  it("plays in place on a moodboard", () => {
    expect(parseVideoUrl(PLAYLIST)).toEqual({
      embedUrl: "https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKCadgRdKQ",
      provider: "spotify",
    });
  });
});

describe("detectMood", () => {
  it("picks the mood with the most keywords", () => {
    expect(detectMood("Premium packaging", "Elegant, refined look for a jewelry brand")).toBe(
      "LUXURY",
    );
    expect(detectMood("Kids party flyer", "<p>Fun, colorful, with a mascot</p>")).toBe("PLAYFUL");
    expect(detectMood("Product launch campaign", "Vibrant and dynamic")).toBe("ENERGETIC");
  });

  it("matches whole words only and falls back to calm", () => {
    expect(detectMood("Appointment reminder")).toBe("MINIMAL"); // not "app"
    expect(detectMood(null, undefined, "")).toBe("MINIMAL");
  });
});

describe("mood playlist settings", () => {
  const ok = (value: string) =>
    updateAdminSettingSchema.safeParse({ key: "SOUNDTRACK_PLAYLISTS_MINIMAL", value }).success;

  it("accepts Spotify links, several of them, or nothing", () => {
    expect(ok(PLAYLIST)).toBe(true);
    expect(ok(`${PLAYLIST}, https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy`)).toBe(true);
    expect(ok("")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(ok("https://youtube.com/watch?v=1")).toBe(false);
    expect(ok(`${PLAYLIST}, hello`)).toBe(false);
  });

  it("still refuses empty values for other settings", () => {
    expect(updateAdminSettingSchema.safeParse({ key: "TAGS_ENABLED", value: "" }).success).toBe(
      false,
    );
  });
});
