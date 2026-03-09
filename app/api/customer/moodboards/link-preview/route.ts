// -----------------------------------------------------------------------------
// @file: app/api/customer/moodboards/link-preview/route.ts
// @purpose: Fetch Open Graph metadata (title, description, image) for a URL
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";

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

    // Fetch the page with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let html: string;
    try {
      const res = await fetch(parsed.href, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BrandBite/1.0; +https://brandbite.studio)",
          Accept: "text/html",
        },
        redirect: "follow",
      });
      clearTimeout(timeout);

      if (!res.ok) {
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
