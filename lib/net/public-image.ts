// -----------------------------------------------------------------------------
// @file: lib/net/public-image.ts
// @purpose: Fetches a small picture from a public https address a visitor
//           typed, without letting that address point the server at anything
//           private. Used to show an email signature's logo in the preview
//           (the site's own policy stops the browser loading it directly).
//
//           The rules: https on the standard port only, a host name (not an
//           IP), every address the name resolves to must be public, the
//           connection goes to the address that was checked (so the name
//           can't change its answer in between), no redirects are followed,
//           and the answer must be a small PNG, JPG, GIF or WebP.
// -----------------------------------------------------------------------------

import "server-only";

import { lookup } from "node:dns/promises";
import https from "node:https";
import { isIP } from "node:net";

export const PUBLIC_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PUBLIC_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const TIMEOUT_MS = 6000;

export class PublicImageError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** True only for an address on the open internet. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false; // this-net, private, loopback, multicast/reserved
    if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
    if (a === 169 && b === 254) return false; // link-local, cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 192 && b === 168) return false; // private
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // protocol assignments, documentation
    if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
    if (a === 198 && b === 51 && c === 100) return false; // documentation
    if (a === 203 && b === 0 && c === 113) return false; // documentation
    return true;
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    // An IPv4 address written as IPv6 is judged as that IPv4 address.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    if (lower.startsWith("::ffff:")) return false;
    // Only global unicast (2000::/3) is public; that leaves out loopback,
    // unspecified, unique-local (fc00::/7), link-local (fe80::/10), multicast.
    const first = Number.parseInt(lower.split(":")[0] || "0", 16);
    if (first < 0x2000 || first > 0x3fff) return false;
    if (lower.startsWith("2001:db8")) return false; // documentation
    return true;
  }
  return false;
}

/** The address as a URL we are willing to fetch, or an error saying why not. */
export function publicImageUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new PublicImageError("That doesn't look like a web address.", 400);
  }
  if (url.protocol !== "https:") throw new PublicImageError("Use an https address.", 400);
  if (url.port && url.port !== "443") throw new PublicImageError("Use a standard address.", 400);
  if (url.username || url.password) throw new PublicImageError("Use a plain address.", 400);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) || !host.includes(".") || /\.(local|internal|localhost|lan|home)$/i.test(host)) {
    throw new PublicImageError("Use the address of a picture on a public website.", 400);
  }
  return url;
}

export type PublicImage = { bytes: Uint8Array; contentType: string };

export async function fetchPublicImage(input: string): Promise<PublicImage> {
  const url = publicImageUrl(input);

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    throw new PublicImageError("We couldn't find that website.", 404);
  }
  if (!addresses.length || !addresses.every((entry) => isPublicAddress(entry.address))) {
    throw new PublicImageError("Use the address of a picture on a public website.", 400);
  }
  const target = addresses[0];

  return new Promise<PublicImage>((resolve, reject) => {
    const request = https.request(
      {
        host: url.hostname,
        servername: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { Accept: PUBLIC_IMAGE_TYPES.join(", "), "User-Agent": "signature-preview" },
        timeout: TIMEOUT_MS,
        agent: false,
        // Connect to the address that was checked above, whatever the name says now.
        lookup: (_hostname, options, callback) => {
          if (typeof options === "object" && options.all) {
            (callback as unknown as (e: null, a: typeof addresses) => void)(null, [target]);
          } else {
            callback(null, target.address, target.family);
          }
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          response.resume();
          reject(
            new PublicImageError(
              "That address forwards somewhere else. Use the picture's direct address.",
              422,
            ),
          );
          return;
        }
        if (status !== 200) {
          response.resume();
          reject(new PublicImageError("There is no picture at that address.", 404));
          return;
        }
        const contentType = (response.headers["content-type"] ?? "").split(";")[0].trim();
        if (!PUBLIC_IMAGE_TYPES.includes(contentType)) {
          response.resume();
          reject(
            new PublicImageError(
              contentType === "image/svg+xml"
                ? "That is an SVG. Mail apps don't show SVG; use a PNG or JPG."
                : "That address isn't a PNG, JPG, GIF or WebP picture.",
              415,
            ),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > PUBLIC_IMAGE_MAX_BYTES) {
            request.destroy();
            reject(
              new PublicImageError("That picture is over 2 MB, too heavy for a signature.", 413),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({ bytes: new Uint8Array(Buffer.concat(chunks)), contentType }),
        );
        response.on("error", () =>
          reject(new PublicImageError("We couldn't read that picture.", 502)),
        );
      },
    );
    request.on("timeout", () => {
      request.destroy();
      reject(new PublicImageError("That website took too long to answer.", 504));
    });
    request.on("error", () => reject(new PublicImageError("We couldn't reach that website.", 502)));
    request.end();
  });
}
