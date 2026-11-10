// -----------------------------------------------------------------------------
// @file: lib/integrations/google-drive.ts
// @purpose: Google Drive for source-file delivery. Uses the `drive.file`
//           scope only: brandbite can see and change the files and folders it
//           created (the "brandbite" folder and what goes in it), nothing
//           else in the customer's Drive. Its own Google Cloud project and
//           OAuth client (GOOGLE_DRIVE_CLIENT_ID / _SECRET), so customers see
//           brandbite on Google's consent screen.
// -----------------------------------------------------------------------------

import { refreshAccessToken, type GoogleOauthConfig } from "@/lib/google/oauth";

import {
  getCompanyIntegrationSecrets,
  markIntegrationBroken,
  updateCachedAccessToken,
} from "./company-integrations";

export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
] as const;

export const GOOGLE_DRIVE_CALLBACK_PATH = "/api/customer/integrations/google-drive/callback";
export const GOOGLE_DRIVE_ROOT_FOLDER_NAME = "brandbite";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export class IntegrationNotConnectedError extends Error {
  constructor(message = "Google Drive is not connected.") {
    super(message);
    this.name = "IntegrationNotConnectedError";
  }
}

export class IntegrationBrokenError extends Error {
  constructor(message = "Google Drive needs to be reconnected.") {
    super(message);
    this.name = "IntegrationBrokenError";
  }
}

/** OAuth config with the Drive callback on the current origin. */
export function readDriveOauthConfig(
  origin: string,
  env: NodeJS.ProcessEnv = process.env,
): GoogleOauthConfig | { error: string } {
  const clientId = env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { error: "Missing env var(s): GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET" };
  }
  return {
    clientId,
    clientSecret,
    redirectUri: new URL(GOOGLE_DRIVE_CALLBACK_PATH, origin).toString(),
  };
}

/** Google says the grant is gone (revoked, expired, app removed). */
export function isRevokedGrantError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid_grant|unauthorized_client|invalid_client/i.test(message);
}

/**
 * A working access token for the company's Drive: the cached one while it
 * has a minute left, otherwise a fresh one from the refresh token. A revoked
 * grant marks the connection BROKEN so the customer is asked to reconnect.
 */
export async function getDriveAccessToken(
  companyId: string,
  origin: string,
  now: Date = new Date(),
): Promise<{ accessToken: string; rootFolderId: string | null }> {
  const secrets = await getCompanyIntegrationSecrets(companyId, "GOOGLE_DRIVE");
  if (!secrets) throw new IntegrationNotConnectedError();
  if (secrets.status === "BROKEN") throw new IntegrationBrokenError();
  if (
    secrets.accessToken &&
    secrets.accessTokenExpiresAt &&
    secrets.accessTokenExpiresAt.getTime() - now.getTime() > 60_000
  ) {
    return { accessToken: secrets.accessToken, rootFolderId: secrets.externalRootId };
  }
  if (!secrets.refreshToken) throw new IntegrationBrokenError();

  const config = readDriveOauthConfig(origin);
  if ("error" in config) throw new Error(`Google OAuth is not configured: ${config.error}`);
  try {
    const fresh = await refreshAccessToken(config, secrets.refreshToken);
    const expiresAt = new Date(now.getTime() + fresh.expires_in * 1000);
    await updateCachedAccessToken(secrets.id, fresh.access_token, expiresAt);
    return { accessToken: fresh.access_token, rootFolderId: secrets.externalRootId };
  } catch (error) {
    if (isRevokedGrantError(error)) {
      await markIntegrationBroken(
        secrets.id,
        error instanceof Error ? error.message : "Google revoked access.",
      );
      throw new IntegrationBrokenError();
    }
    throw error;
  }
}

async function driveFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  return res;
}

/** True when the folder still exists, is ours to see and isn't in the trash. */
export async function isUsableFolder(accessToken: string, folderId: string): Promise<boolean> {
  const res = await driveFetch(
    accessToken,
    `/files/${encodeURIComponent(folderId)}?fields=id,trashed,mimeType`,
  );
  if (!res.ok) return false;
  const file = (await res.json()) as { trashed?: boolean; mimeType?: string };
  return !file.trashed && file.mimeType === FOLDER_MIME;
}

export async function createFolder(
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const res = await driveFetch(accessToken, "/files?fields=id", {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Drive folder create failed (${res.status}): ${text}`);
  }
  return ((await res.json()) as { id: string }).id;
}

/**
 * The "brandbite" folder in the customer's Drive: reuse the one from an
 * earlier connection when it is still there, otherwise create it.
 */
export async function ensureRootFolder(
  accessToken: string,
  existingId: string | null,
): Promise<string> {
  if (existingId && (await isUsableFolder(accessToken, existingId))) return existingId;
  return createFolder(accessToken, GOOGLE_DRIVE_ROOT_FOLDER_NAME);
}

/** Link to open a Drive folder in the browser. */
export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
}

const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

/** Drive rejects nothing in names, but keep them short and on one line. */
export function driveSafeName(name: string): string {
  const clean = name.replace(/[\r\n\t]+/g, " ").trim();
  return (clean || "Untitled").slice(0, 200);
}

/**
 * Open a resumable upload session in the given folder. The browser then
 * sends the bytes straight to Google with one PUT to the returned URL, so
 * the file never passes through our servers. Passing the page's origin lets
 * Google answer that browser PUT with CORS headers.
 */
export async function startDriveUpload(
  accessToken: string,
  args: { name: string; mimeType: string; sizeBytes: number; parentId: string; origin: string },
): Promise<string> {
  const res = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,name,size,webViewLink,parents`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": args.mimeType,
        "X-Upload-Content-Length": String(args.sizeBytes),
        Origin: args.origin,
      },
      body: JSON.stringify({ name: driveSafeName(args.name), parents: [args.parentId] }),
      cache: "no-store",
    },
  );
  const location = res.headers.get("Location");
  if (!res.ok || !location) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Drive upload session failed (${res.status}): ${text}`);
  }
  return location;
}

export type DriveFileInfo = {
  id: string;
  name: string;
  size: number | null;
  webViewLink: string | null;
  parents: string[];
  trashed: boolean;
};

export async function getDriveFile(
  accessToken: string,
  fileId: string,
): Promise<DriveFileInfo | null> {
  const res = await driveFetch(
    accessToken,
    `/files/${encodeURIComponent(fileId)}?fields=id,name,size,webViewLink,parents,trashed`,
  );
  if (!res.ok) return null;
  const file = (await res.json()) as {
    id: string;
    name: string;
    size?: string;
    webViewLink?: string;
    parents?: string[];
    trashed?: boolean;
  };
  return {
    id: file.id,
    name: file.name,
    size: file.size ? Number(file.size) : null,
    webViewLink: file.webViewLink ?? null,
    parents: file.parents ?? [],
    trashed: Boolean(file.trashed),
  };
}

/** Move a file to the Drive trash (the customer can still restore it there). */
export async function trashDriveFile(accessToken: string, fileId: string): Promise<boolean> {
  const res = await driveFetch(accessToken, `/files/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    body: JSON.stringify({ trashed: true }),
  });
  return res.ok || res.status === 404;
}

/**
 * Find a file brandbite uploaded into a folder by its exact name, newest
 * first. Used when the browser couldn't read Drive's answer to the upload.
 */
export async function findDriveFileInFolder(
  accessToken: string,
  folderId: string,
  name: string,
): Promise<DriveFileInfo | null> {
  // Drive query strings escape backslashes and single quotes with a backslash.
  const escaped = driveSafeName(name).replace(/[\\']/g, (ch) => `\\${ch}`);
  const q = `'${folderId}' in parents and name = '${escaped}' and trashed = false`;
  const res = await driveFetch(
    accessToken,
    `/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&pageSize=5&fields=files(id,name,size,webViewLink,parents,trashed)`,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    files?: {
      id: string;
      name: string;
      size?: string;
      webViewLink?: string;
      parents?: string[];
      trashed?: boolean;
    }[];
  };
  const file = json.files?.[0];
  if (!file) return null;
  return {
    id: file.id,
    name: file.name,
    size: file.size ? Number(file.size) : null,
    webViewLink: file.webViewLink ?? null,
    parents: file.parents ?? [],
    trashed: Boolean(file.trashed),
  };
}
