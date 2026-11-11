// -----------------------------------------------------------------------------
// @file: scripts/spotify/generate-playlists.mjs
// @purpose: One-time generator for the brand playlists: one Spotify playlist
//           for every combination of one, two or three moods (41 in all),
//           created on brandbite's own Spotify account. The app never calls
//           Spotify's API; it only embeds the links this writes to
//           lib/soundtrack/generated-playlists.json.
//
//           node scripts/spotify/generate-playlists.mjs verify
//             Looks every track in mood-tracks.json up on Spotify (no sign-in)
//             and saves the matches to track-uris.json. Explicit versions and
//             tracks that can't be found are left out.
//           node scripts/spotify/generate-playlists.mjs login
//             Prints a sign-in link for the brandbite Spotify account.
//           node scripts/spotify/generate-playlists.mjs create [--only A+B] [--limit N]
//             Creates the playlists that aren't in the output file yet.
//
//           Needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env or
//           .env.local, and http://127.0.0.1:8888/callback as the app's
//           redirect URI. Touches no database.
// -----------------------------------------------------------------------------

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const TRACKS_FILE = path.join(HERE, "mood-tracks.json");
const URIS_FILE = path.join(HERE, "track-uris.json");
const OUT_FILE = path.join(ROOT, "lib/soundtrack/generated-playlists.json");
// The sign-in token stays outside the repo.
const TOKEN_FILE = path.join(os.tmpdir(), "brandbite-spotify-token.json");
const REDIRECT = "http://127.0.0.1:8888/callback";
const SCOPES = "playlist-modify-public playlist-modify-private";

const MOODS = ["ENERGETIC", "MINIMAL", "LUXURY", "PLAYFUL", "WARM", "BOLD"];
const NAMES = {
  ENERGETIC: "Energetic",
  MINIMAL: "Minimal",
  LUXURY: "Luxury",
  PLAYFUL: "Playful",
  WARM: "Warm",
  BOLD: "Bold",
};
/** Tracks per playlist. */
const SIZE = 30;

function env(name) {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=["']?(.*?)["']?\s*$/);
      if (m && m[1] === name && m[2]) return m[2];
    }
  }
  throw new Error(`${name} is missing from .env / .env.local`);
}

const readJson = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const basic = () =>
  "Basic " +
  Buffer.from(`${env("SPOTIFY_CLIENT_ID")}:${env("SPOTIFY_CLIENT_SECRET")}`).toString("base64");

async function tokenRequest(params) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: basic(), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function api(token, url, init = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url.startsWith("http") ? url : `https://api.spotify.com/v1${url}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    if (res.status === 429) {
      await sleep((Number(res.headers.get("retry-after")) || 2) * 1000 + 500);
      continue;
    }
    if (!res.ok) {
      throw new Error(`${init.method ?? "GET"} ${url} failed (${res.status}): ${await res.text()}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  throw new Error(`${url}: still rate-limited after 5 tries`);
}

const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Every combination of one, two or three moods, in MOODS order. */
function combinations() {
  const out = [];
  for (let a = 0; a < MOODS.length; a++) {
    out.push([MOODS[a]]);
    for (let b = a + 1; b < MOODS.length; b++) {
      out.push([MOODS[a], MOODS[b]]);
      for (let c = b + 1; c < MOODS.length; c++) out.push([MOODS[a], MOODS[b], MOODS[c]]);
    }
  }
  return out;
}

/** Equal shares from each mood, taken in turn, without repeats. */
function mix(moods, uris) {
  const seen = new Set();
  const out = [];
  const longest = Math.max(...moods.map((m) => uris[m].length));
  for (let i = 0; i < longest && out.length < SIZE; i++) {
    for (const mood of moods) {
      const uri = uris[mood][i]?.uri;
      if (uri && !seen.has(uri) && out.length < SIZE) {
        seen.add(uri);
        out.push(uri);
      }
    }
  }
  return out;
}

async function verify() {
  const { access_token: token } = await tokenRequest({ grant_type: "client_credentials" });
  const tracks = readJson(TRACKS_FILE, {});
  const found = {};
  const missing = [];
  for (const mood of MOODS) {
    found[mood] = [];
    for (const [artist, title] of tracks[mood]) {
      const wantArtist = norm(artist);
      const wantTitle = norm(title).split(" ").slice(0, 2).join(" ");
      let hit = null;
      for (const q of [`track:"${title}" artist:"${artist}"`, `${title} ${artist}`]) {
        const json = await api(token, `/search?type=track&limit=10&q=${encodeURIComponent(q)}`);
        hit = (json.tracks?.items ?? []).find(
          (t) =>
            !t.explicit &&
            t.artists.some((a) => {
              const name = norm(a.name);
              return name.includes(wantArtist) || wantArtist.includes(name);
            }) &&
            norm(t.name).startsWith(wantTitle),
        );
        await sleep(120);
        if (hit) break;
      }
      if (hit) found[mood].push({ uri: hit.uri, artist: hit.artists[0].name, title: hit.name });
      else missing.push(`${mood}: ${artist} - ${title}`);
    }
    console.log(`${mood}: ${found[mood].length} of ${tracks[mood].length} found`);
  }
  writeJson(URIS_FILE, found);
  if (missing.length) {
    console.log(`\nLeft out (not found, or explicit only):\n  ${missing.join("\n  ")}`);
  }
}

async function login() {
  const state = Math.random().toString(36).slice(2);
  const link =
    "https://accounts.spotify.com/authorize?" +
    new URLSearchParams({
      client_id: env("SPOTIFY_CLIENT_ID"),
      response_type: "code",
      redirect_uri: REDIRECT,
      scope: SCOPES,
      state,
    });
  await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, REDIRECT);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      try {
        if (url.searchParams.get("state") !== state) throw new Error("state mismatch");
        const code = url.searchParams.get("code");
        if (!code) throw new Error(url.searchParams.get("error") ?? "no code");
        const token = await tokenRequest({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT,
        });
        writeJson(TOKEN_FILE, { refresh_token: token.refresh_token });
        res.end("Signed in. You can close this tab.");
        resolve();
      } catch (err) {
        res.end(`Sign-in failed: ${err.message}`);
        reject(err);
      } finally {
        server.close();
      }
    });
    server.listen(8888, "127.0.0.1", () => {
      console.log(`Open this link and sign in with the brandbite Spotify account:\n\n${link}\n`);
    });
  });
  console.log("Signed in.");
}

async function userToken() {
  const saved = readJson(TOKEN_FILE, null);
  if (!saved?.refresh_token) throw new Error("Not signed in yet: run the `login` step first.");
  const token = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: saved.refresh_token,
  });
  if (token.refresh_token) writeJson(TOKEN_FILE, { refresh_token: token.refresh_token });
  return token.access_token;
}

async function create(args) {
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
  const uris = readJson(URIS_FILE, null);
  if (!uris) throw new Error("Run the `verify` step first.");
  const token = await userToken();
  const out = readJson(OUT_FILE, {});
  let made = 0;
  for (const moods of combinations()) {
    const key = moods.join("+");
    if (out[key] || (only && only !== key) || made >= limit) continue;
    const names = moods.map((m) => NAMES[m]);
    const playlist = await api(token, "/me/playlists", {
      method: "POST",
      body: {
        name: `brandbite · ${names.join(" + ")}`,
        description: `A brand playlist from brandbite.studio for brands that feel ${names.join(", ").toLowerCase()}.`,
        public: true,
      },
    });
    await api(token, `/playlists/${playlist.id}/items`, {
      method: "POST",
      body: { uris: mix(moods, uris) },
    });
    out[key] = `https://open.spotify.com/playlist/${playlist.id}`;
    writeJson(OUT_FILE, out);
    made += 1;
    console.log(`${key}: ${out[key]}`);
    await sleep(400);
  }
  console.log(
    `\n${made} created; ${Object.keys(out).length} of ${combinations().length} are in ${path.relative(ROOT, OUT_FILE)}`,
  );
}

const [command, ...rest] = process.argv.slice(2);
const run = { verify, login, create: () => create(rest) }[command];
if (run) {
  run().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
} else {
  console.log(
    "Usage: node scripts/spotify/generate-playlists.mjs verify | login | create [--only A+B] [--limit N]",
  );
}
