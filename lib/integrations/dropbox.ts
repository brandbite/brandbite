// -----------------------------------------------------------------------------
// @file: lib/integrations/dropbox.ts
// @purpose: Dropbox for source-file delivery. The Dropbox app uses "App
//           folder" access: brandbite only sees Apps/<app folder>/ in the
//           customer's Dropbox, nothing else. Paths below are relative to
//           that folder, e.g. /Website/WEB-101 Logo redesign/logo.ai.
//
//           Uploads use one-time temporary upload links (no token reaches the
//           browser). Dropbox caps those at 150 MB per file; bigger files go
//           to brandbite storage (R2) instead (decided 2026-11-10).
// -----------------------------------------------------------------------------

import {
  getCompanyIntegrationSecrets,
  markIntegrationBroken,
  updateCachedAccessToken,
} from "./company-integrations";
import { IntegrationBrokenError, IntegrationNotConnectedError } from "./google-drive";

const AUTHORIZE = "https://www.dropbox.com/oauth2/authorize";
const TOKEN = "https://api.dropboxapi.com/oauth2/token";
const API = "https://api.dropboxapi.com/2";

export const DROPBOX_CALLBACK_PATH = "/api/customer/integrations/dropbox/callback";
/** Dropbox's limit for a temporary upload link. */
export const DROPBOX_MAX_LINK_UPLOAD_BYTES = 150 * 1024 * 1024;

export type DropboxConfig = { appKey: string; appSecret: string; redirectUri: string };

export function readDropboxConfig(
  origin: string,
  env: NodeJS.ProcessEnv = process.env,
): DropboxConfig | { error: string } {
  if (!env.DROPBOX_APP_KEY || !env.DROPBOX_APP_SECRET) {
    return { error: "Missing env var(s): DROPBOX_APP_KEY, DROPBOX_APP_SECRET" };
  }
  return {
    appKey: env.DROPBOX_APP_KEY,
    appSecret: env.DROPBOX_APP_SECRET,
    redirectUri: new URL(DROPBOX_CALLBACK_PATH, origin).toString(),
  };
}

/** The folder name Dropbox gives the app ("Apps/<name>"), for links to the web. */
export function dropboxAppFolderName(env: NodeJS.ProcessEnv = process.env): string {
  return env.DROPBOX_APP_FOLDER_NAME || "brandbite";
}

export function buildDropboxAuthorizeUrl(config: DropboxConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.appKey,
    response_type: "code",
    // offline = a refresh token, so we can keep uploading after 4 hours.
    token_access_type: "offline",
    redirect_uri: config.redirectUri,
    state,
  });
  return `${AUTHORIZE}?${params.toString()}`;
}

export type DropboxTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  account_id?: string;
  scope?: string;
};

async function tokenRequest(config: DropboxConfig, body: Record<string, string>) {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...body,
      client_id: config.appKey,
      client_secret: config.appSecret,
    }).toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dropbox token request failed (${res.status}): ${text}`);
  }
  return (await res.json()) as DropboxTokenResponse;
}

export function exchangeDropboxCode(config: DropboxConfig, code: string) {
  return tokenRequest(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
}

async function dropboxApi<T>(accessToken: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body === null ? {} : { "Content-Type": "application/json" }),
    },
    body: body === null ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const error = new Error(`Dropbox ${path} failed (${res.status}): ${text}`) as Error & {
      status?: number;
    };
    error.status = res.status;
    throw error;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** The connected account's email, for "Connected as …". */
export async function getDropboxAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const account = await dropboxApi<{ email?: string }>(
      accessToken,
      "/users/get_current_account",
      null,
    );
    return account?.email ?? null;
  } catch {
    return null;
  }
}

export async function revokeDropboxToken(accessToken: string): Promise<void> {
  try {
    await dropboxApi(accessToken, "/auth/token/revoke", null);
  } catch {
    // best effort: the row is removed either way
  }
}

export function isRevokedDropboxGrant(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid_grant|invalid_access_token|expired_access_token|\(401\)/i.test(message);
}

/** A working access token: the cached one while it has a minute left, else a refresh. */
export async function getDropboxAccessToken(
  companyId: string,
  origin: string,
  now: Date = new Date(),
): Promise<string> {
  const secrets = await getCompanyIntegrationSecrets(companyId, "DROPBOX");
  if (!secrets) throw new IntegrationNotConnectedError("Dropbox is not connected.");
  if (secrets.status === "BROKEN")
    throw new IntegrationBrokenError("Dropbox needs to be reconnected.");
  if (
    secrets.accessToken &&
    secrets.accessTokenExpiresAt &&
    secrets.accessTokenExpiresAt.getTime() - now.getTime() > 60_000
  ) {
    return secrets.accessToken;
  }
  if (!secrets.refreshToken) throw new IntegrationBrokenError("Dropbox needs to be reconnected.");
  const config = readDropboxConfig(origin);
  if ("error" in config) throw new Error(`Dropbox is not configured: ${config.error}`);
  try {
    const fresh = await tokenRequest(config, {
      grant_type: "refresh_token",
      refresh_token: secrets.refreshToken,
    });
    await updateCachedAccessToken(
      secrets.id,
      fresh.access_token,
      new Date(now.getTime() + fresh.expires_in * 1000),
    );
    return fresh.access_token;
  } catch (error) {
    if (isRevokedDropboxGrant(error)) {
      await markIntegrationBroken(
        secrets.id,
        error instanceof Error ? error.message : "Dropbox revoked access.",
      );
      throw new IntegrationBrokenError("Dropbox needs to be reconnected.");
    }
    throw error;
  }
}

/** One path segment Dropbox accepts: no slashes, no control characters, trimmed. */
export function dropboxSafeSegment(name: string): string {
  const clean = name
    .replace(/[\\/]+/g, "-")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return (clean || "Untitled").slice(0, 200);
}

/** /<Project>/<CODE Title>/<file name> inside the app folder. */
export function dropboxFilePath(projectName: string, ticketFolder: string, fileName: string) {
  return `/${dropboxSafeSegment(projectName)}/${dropboxSafeSegment(ticketFolder)}/${dropboxSafeSegment(fileName)}`;
}

/**
 * A one-time link the browser POSTs the file to (Content-Type
 * application/octet-stream). Valid 4 hours; Dropbox creates missing folders
 * and renames on a clash ("logo (1).ai").
 */
export async function getDropboxUploadLink(accessToken: string, path: string): Promise<string> {
  const result = await dropboxApi<{ link: string }>(
    accessToken,
    "/files/get_temporary_upload_link",
    {
      commit_info: { path, mode: "add", autorename: true, mute: false },
      duration: 14_400,
    },
  );
  return result.link;
}

export type DropboxFileInfo = {
  id: string;
  name: string;
  pathDisplay: string;
  size: number;
};

/**
 * Find the uploaded file in its folder: the exact name, or the renamed copy
 * Dropbox makes on a clash ("name (1).ext"), with the expected size.
 */
export async function findDropboxUpload(
  accessToken: string,
  intendedPath: string,
  size: number,
): Promise<DropboxFileInfo | null> {
  const slash = intendedPath.lastIndexOf("/");
  const folder = intendedPath.slice(0, slash);
  const fileName = intendedPath.slice(slash + 1);
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : "";
  const renamed = new RegExp(
    `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(\\d+\\)${ext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    "i",
  );
  try {
    const listing = await dropboxApi<{
      entries: {
        ".tag": string;
        id: string;
        name: string;
        path_display: string;
        size?: number;
        server_modified?: string;
      }[];
    }>(accessToken, "/files/list_folder", { path: folder, limit: 2000 });
    const matches = listing.entries
      .filter((e) => e[".tag"] === "file" && e.size === size)
      .filter((e) => e.name.toLowerCase() === fileName.toLowerCase() || renamed.test(e.name))
      .sort((a, b) => (b.server_modified ?? "").localeCompare(a.server_modified ?? ""));
    const hit = matches[0];
    return hit
      ? { id: hit.id, name: hit.name, pathDisplay: hit.path_display, size: hit.size! }
      : null;
  } catch {
    return null;
  }
}

/** Link to the file in Dropbox on the web (the customer's own account). */
export function dropboxWebUrl(pathDisplay: string, env: NodeJS.ProcessEnv = process.env): string {
  const segments = `Apps/${dropboxAppFolderName(env)}${pathDisplay}`
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `https://www.dropbox.com/home/${segments}`;
}

/** Delete a file (Dropbox keeps it in "Deleted files" for at least 30 days). */
export async function deleteDropboxFile(accessToken: string, idOrPath: string): Promise<void> {
  try {
    await dropboxApi(accessToken, "/files/delete_v2", { path: idOrPath });
  } catch (error) {
    if ((error as { status?: number }).status === 409) return; // already gone
    throw error;
  }
}

const CONTENT = "https://content.dropboxapi.com/2";
/** Chunk size for upload sessions (Dropbox allows up to 150 MB per call). */
const SESSION_CHUNK_BYTES = 64 * 1024 * 1024;

type DropboxUploadResult = { id: string; name: string; path_display: string; size: number };

/** JSON for the Dropbox-API-Arg header: headers must be ASCII, so escape the rest. */
export function dropboxHeaderJson(arg: unknown): string {
  return JSON.stringify(arg).replace(
    /[\u007f-￿]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}

async function contentCall<T>(
  accessToken: string,
  path: string,
  arg: unknown,
  body: BodyInit | Uint8Array,
): Promise<T> {
  const res = await fetch(`${CONTENT}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      // Header values must be ASCII: escape non-ASCII characters in the JSON.
      "Dropbox-API-Arg": dropboxHeaderJson(arg),
    },
    body: body as BodyInit,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dropbox ${path} failed (${res.status}): ${text}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Read exactly `size` bytes (or what's left) from a stream reader. */
async function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  carry: { buf: Uint8Array | null },
  size: number,
): Promise<Uint8Array | null> {
  const parts: Uint8Array[] = [];
  let total = 0;
  if (carry.buf) {
    parts.push(carry.buf);
    total += carry.buf.byteLength;
    carry.buf = null;
  }
  while (total < size) {
    const { value, done } = await reader.read();
    if (done) break;
    parts.push(value);
    total += value.byteLength;
  }
  if (total === 0) return null;
  const all = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.byteLength;
  }
  if (total > size) {
    carry.buf = all.slice(size);
    return all.slice(0, size);
  }
  return all;
}

/**
 * Server-side upload (used when moving brandbite-stored files into a newly
 * connected Dropbox). Streams the bytes in 64 MB upload-session chunks, so
 * any size works and memory stays bounded.
 */
export async function uploadDropboxFile(
  accessToken: string,
  path: string,
  stream: ReadableStream<Uint8Array>,
): Promise<DropboxFileInfo> {
  const reader = stream.getReader();
  const carry = { buf: null as Uint8Array | null };
  const commit = { path, mode: "add", autorename: true, mute: true };
  let chunk = await readChunk(reader, carry, SESSION_CHUNK_BYTES);
  const first = chunk ?? new Uint8Array(0);
  const next = await readChunk(reader, carry, SESSION_CHUNK_BYTES);

  let result: DropboxUploadResult;
  if (!next) {
    result = await contentCall<DropboxUploadResult>(accessToken, "/files/upload", commit, first);
  } else {
    const { session_id } = await contentCall<{ session_id: string }>(
      accessToken,
      "/files/upload_session/start",
      { close: false },
      first,
    );
    let offset = first.byteLength;
    chunk = next;
    for (;;) {
      const after = await readChunk(reader, carry, SESSION_CHUNK_BYTES);
      if (!after) {
        result = await contentCall<DropboxUploadResult>(
          accessToken,
          "/files/upload_session/finish",
          { cursor: { session_id, offset }, commit },
          chunk,
        );
        break;
      }
      await contentCall(
        accessToken,
        "/files/upload_session/append_v2",
        { cursor: { session_id, offset }, close: false },
        chunk,
      );
      offset += chunk.byteLength;
      chunk = after;
    }
  }
  return { id: result.id, name: result.name, pathDisplay: result.path_display, size: result.size };
}
