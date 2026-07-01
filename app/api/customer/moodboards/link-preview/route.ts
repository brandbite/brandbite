// -----------------------------------------------------------------------------
// @file: app/api/customer/moodboards/link-preview/route.ts
// @purpose: Fetch Open Graph metadata (title, description, image) for a URL
// -----------------------------------------------------------------------------

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * True for IPs we must never let the server fetch: loopback, private RFC1918,
 * link-local (incl. the 169.254.169.254 cloud-metadata endpoint), CGNAT,
 * unspecified, and their IPv6 equivalents. Guards against SSRF — the caller
 * controls the URL and we fetch it from the server's network position.
 */
function isBlockedAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
    const [a, b] = p;
    if (a === 0 || a === 10 || a === 127) return true; // this-host, private, loopback
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — re-check the embedded v4 address
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    return false;
  }
  return true; // not a literal IP — caller must resolve first
}

/** Resolve the hostname and reject if it maps to a blocked address. */
async function assertPublicHost(hostname: string): Promise<boolean> {
  const literal = isIP(hostname);
  if (literal) return !isBlockedAddress(hostname);
  try {
    const results = await lookup(hostname, { all: true });
    if (results.length === 0) return false;
    return results.every((r) => !isBlockedAddress(r.address));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url.trim() : "";

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // SSRF guard: reject URLs whose host resolves to a private/internal
    // address before we ever touch the network.
    if (!(await assertPublicHost(parsed.hostname))) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Fetch the page with a timeout. We follow redirects manually so we can
    // re-run the SSRF guard on every hop — `redirect: "follow"` would let a
    // public URL bounce us to an internal one.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let html: string;
    try {
      let current = parsed;
      let res: Response | null = null;

      for (let hop = 0; hop < 5; hop++) {
        res = await fetch(current.href, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; BrandBite/1.0; +https://brandbite.studio)",
            Accept: "text/html",
          },
          redirect: "manual",
        });

        // Not a redirect — done.
        if (res.status < 300 || res.status >= 400) break;

        const location = res.headers.get("location");
        if (!location) break;

        let next: URL;
        try {
          next = new URL(location, current.href);
        } catch {
          clearTimeout(timeout);
          return NextResponse.json({ title: null, description: null, image: null });
        }
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          clearTimeout(timeout);
          return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }
        if (!(await assertPublicHost(next.hostname))) {
          clearTimeout(timeout);
          return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }
        current = next;
      }
      clearTimeout(timeout);

      if (!res || !res.ok) {
        return NextResponse.json({ title: null, description: null, image: null });
      }

      // Only read first 50KB to avoid huge pages
      const text = await res.text();
      html = text.slice(0, 50_000);
    } catch {
      clearTimeout(timeout);
      return NextResponse.json({ title: null, description: null, image: null });
    }

    // Extract OG metadata
    const title = extractMeta(html, "og:title") ?? extractTitle(html) ?? null;
    const description =
      extractMeta(html, "og:description") ?? extractMeta(html, "description") ?? null;
    const image = extractMeta(html, "og:image") ?? null;
    const favicon = extractFavicon(html, parsed) ?? null;

    return NextResponse.json({ title, description, image, favicon });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[link-preview] error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

function extractMeta(html: string, property: string): string | undefined {
  // Match <meta property="og:title" content="..."> or <meta name="description" content="...">
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRegex(property)}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim()).slice(0, 500);
    }
  }

  return undefined;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()).slice(0, 200) : undefined;
}

function extractFavicon(html: string, pageUrl: URL): string | undefined {
  // Try <link rel="icon" href="..."> or <link rel="shortcut icon" href="...">
  const patterns = [
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const href = match[1].trim();
      // Resolve relative URLs
      try {
        return new URL(href, pageUrl.origin).href;
      } catch {
        return undefined;
      }
    }
  }

  // Default: try /favicon.ico at domain root
  return `${pageUrl.origin}/favicon.ico`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}
