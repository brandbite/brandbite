// -----------------------------------------------------------------------------
// @file: app/api/customer/moodboards/video-oembed/route.ts
// @purpose: Fetch video title via oembed API (YouTube, Vimeo)
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

    // Determine oembed endpoint based on provider
    const hostname = parsed.hostname.replace("www.", "");
    let oembedUrl: string | null = null;

    if (hostname === "youtube.com" || hostname === "youtu.be" || hostname === "m.youtube.com") {
      oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    } else if (hostname === "vimeo.com") {
      oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
    }

    if (!oembedUrl) {
      return NextResponse.json({ title: null });
    }

    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(oembedUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BrandBite/1.0; +https://brandbite.studio)",
        },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return NextResponse.json({ title: null });
      }

      const data = await res.json();
      const title = typeof data?.title === "string" ? data.title.trim().slice(0, 300) : null;

      return NextResponse.json({ title });
    } catch {
      clearTimeout(timeout);
      return NextResponse.json({ title: null });
    }
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[video-oembed] error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
