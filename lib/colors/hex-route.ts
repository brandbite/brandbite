// -----------------------------------------------------------------------------
// @file: lib/colors/hex-route.ts
// @purpose: Decides what a /colors/hex/<value> address should do, before the page
//           renders. The root loading.tsx starts the response early, so by the time
//           a page could redirect or 404, the status is already 200.
// -----------------------------------------------------------------------------

import { parseOpaqueHex } from "./convert";

const PREFIX = "/colors/hex/";

export type HexRoute = { kind: "page" } | { kind: "redirect"; to: string } | { kind: "missing" };

// Files Next.js serves under each color page (lib/seo/og-image.tsx).
const COLOR_PAGE_FILES = new Set(["opengraph-image"]);

export function resolveHexRoute(pathname: string): HexRoute {
  if (!pathname.startsWith(PREFIX)) return { kind: "page" };

  const rest = pathname.slice(PREFIX.length);
  const slash = rest.indexOf("/");
  const value = slash === -1 ? rest : rest.slice(0, slash);
  const file = slash === -1 ? null : rest.slice(slash + 1);
  if (file !== null && !COLOR_PAGE_FILES.has(file)) return { kind: "missing" };

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return { kind: "missing" };
  }

  const hex = parseOpaqueHex(decoded);
  if (!hex) return { kind: "missing" };

  // One address per color, so #FF7F50, FF7F50 and #f75 don't compete.
  const canonical = hex.slice(1);
  if (value === canonical) return { kind: "page" };
  return { kind: "redirect", to: PREFIX + canonical + (file ? `/${file}` : "") };
}
