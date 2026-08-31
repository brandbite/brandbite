// -----------------------------------------------------------------------------
// @file: app/api/plugins/[product]/[action]/route.ts
// @purpose: Licence activation, checking and update delivery for the Brandbite
//           WordPress plugins. Called by the plugin itself rather than by a
//           browser, so it is authenticated by licence key — there is no
//           session here and getCurrentUserOrThrow must not be used.
// @version: v0.1.0
// @status: active
// @lastUpdate: 2026-08-31
//
//   POST /api/plugins/<product>/activate     bind a key to a site
//   POST /api/plugins/<product>/check        daily re-check from WP-Cron
//   POST /api/plugins/<product>/deactivate   free the seat
//   GET  /api/plugins/<product>/version      update notice + details popup
//   GET  /api/plugins/<product>/download     the zip, behind a signed token
//
// Three things in the contract are load-bearing and easy to break by accident:
//
//   1. A 5xx or a timeout means "we could not be reached", and the plugin
//      keeps working on its previous answer for fourteen days. So a database
//      fault must surface as a 500 — never as { status: "invalid" }, which
//      would stop a paying customer's site converting within the hour. That is
//      why nothing below wraps Prisma in a try/catch that swallows.
//   2. "invalid", "expired", "limit_reached" and "deactivated" are final. The
//      plugin gives them no grace at all.
//   3. Nothing here can stop a site serving the WebP files it already has. The
//      only lever is whether new images get converted.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { resolveAssetUrl } from "@/lib/r2";
import {
  normaliseSite,
  signDownloadToken,
  verifyDownloadToken,
  type LicenceStatus,
} from "@/lib/plugin-licence";

const NO_STORE = { "Cache-Control": "no-store" };

const POST_ACTIONS = ["activate", "check", "deactivate"] as const;

interface Answer {
  status: LicenceStatus;
  expires: string;
  message: string;
  sites_used?: number;
  sites_limit?: number;
}

function answer(body: Answer) {
  return NextResponse.json(body, { headers: NO_STORE });
}

function expiryOf(licence: { expiresAt: Date | null }): string {
  return licence.expiresAt ? licence.expiresAt.toISOString().slice(0, 10) : "";
}

function downloadSecret(): string {
  return process.env.PLUGIN_DOWNLOAD_SECRET ?? "";
}

// ---------------------------------------------------------------------------
// POST — activate, check, deactivate
// ---------------------------------------------------------------------------

export async function POST(
  req: Request,
  { params }: { params: Promise<{ product: string; action: string }> },
) {
  const { product, action } = await params;

  if (!POST_ACTIONS.includes(action as (typeof POST_ACTIONS)[number])) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Unauthenticated and enumerable, so it is limited by IP. Generous enough
  // that a legitimate site — which calls activate once and check once a day —
  // never sees it, tight enough that guessing keys is not worth starting.
  const ip = getClientIp(req.headers);
  const limit = await rateLimit(`plugin-licence:${ip}`, { limit: 20, windowSeconds: 60 });
  if (!limit.allowed) {
    // 429 is not a verdict, so the plugin treats it as "could not be reached"
    // and keeps working on its previous answer. That is the behaviour we want.
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: NO_STORE });
  }

  let key = "";
  let site = "";
  let version = "";

  try {
    const form = await req.formData();
    key = String(form.get("key") ?? "").trim();
    site = normaliseSite(String(form.get("site") ?? ""));
    version = String(form.get("version") ?? "").slice(0, 20);
  } catch {
    return answer({
      status: "invalid",
      expires: "",
      message: "The request could not be read.",
    });
  }

  if (!key || !site) {
    return answer({
      status: "invalid",
      expires: "",
      message: "The request was missing a key or a site address.",
    });
  }

  const licence = await prisma.pluginLicence.findFirst({
    where: { key, product },
    include: { sites: true },
  });

  if (!licence) {
    return answer({
      status: "invalid",
      expires: "",
      message:
        "We could not find that key. Check it against your receipt, including the BB- at the front.",
    });
  }

  if (licence.revokedAt) {
    return answer({
      status: "invalid",
      expires: expiryOf(licence),
      message: "This key has been cancelled. Get in touch if that is unexpected.",
    });
  }

  const existing = licence.sites.find((s) => s.site === site);

  if (action === "deactivate") {
    if (existing) {
      await prisma.pluginLicenceSite.delete({ where: { id: existing.id } });
    }

    return answer({
      status: "deactivated",
      expires: expiryOf(licence),
      message: "This site has been released. The key is free to use somewhere else.",
      sites_used: licence.sites.length - (existing ? 1 : 0),
      sites_limit: licence.siteLimit,
    });
  }

  // Expiry is checked after deactivate on purpose: someone whose key has
  // lapsed must still be able to release a site, or they can never move it.
  if (licence.expiresAt && licence.expiresAt < new Date()) {
    return answer({
      status: "expired",
      expires: expiryOf(licence),
      message:
        "This key expired. Renewing re-enables converting; the images you already have carry on being served either way.",
    });
  }

  // A site already on the licence never counts against the limit again, so
  // moving between staging and live, or reinstalling after a rebuild, cannot
  // slowly lock someone out of their own key.
  if (!existing && licence.sites.length >= licence.siteLimit) {
    return answer({
      status: "limit_reached",
      expires: expiryOf(licence),
      message: `This key covers ${licence.siteLimit} site${
        licence.siteLimit === 1 ? "" : "s"
      } and is already on ${licence.sites.length}. Deactivate one from its own Media → Images screen, or upgrade the plan.`,
      sites_used: licence.sites.length,
      sites_limit: licence.siteLimit,
    });
  }

  await prisma.pluginLicenceSite.upsert({
    where: { licenceId_site: { licenceId: licence.id, site } },
    create: { licenceId: licence.id, site, version, lastSeenAt: new Date() },
    update: { version, lastSeenAt: new Date() },
  });

  return answer({
    status: "active",
    expires: expiryOf(licence),
    message: "",
    sites_used: existing ? licence.sites.length : licence.sites.length + 1,
    sites_limit: licence.siteLimit,
  });
}

// ---------------------------------------------------------------------------
// GET — version, download
// ---------------------------------------------------------------------------

export async function GET(
  req: Request,
  { params }: { params: Promise<{ product: string; action: string }> },
) {
  const { product, action } = await params;
  const url = new URL(req.url);

  if (action === "download") {
    return handleDownload(product, url);
  }

  if (action !== "version") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const release = await prisma.pluginRelease.findFirst({
    where: { product, published: true },
    orderBy: { releasedAt: "desc" },
  });

  if (!release) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: NO_STORE });
  }

  const key = (url.searchParams.get("key") ?? "").trim();
  const site = normaliseSite(url.searchParams.get("site") ?? "");

  const entitled = key
    ? await prisma.pluginLicence.findFirst({
        where: {
          key,
          product,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          sites: { some: { site } },
        },
        select: { id: true },
      })
    : null;

  const secret = downloadSecret();
  if (!secret) {
    console.warn("[plugins] PLUGIN_DOWNLOAD_SECRET is not set — no packages can be issued");
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  // A site with no valid key still learns that an update exists — it just gets
  // no package to install from. A lapsed customer seeing a nudge is friendlier
  // than one seeing silence, and it is the moment they are most likely to renew.
  const packageUrl =
    entitled && secret
      ? `${origin}/api/plugins/${product}/download?token=${signDownloadToken(product, key, secret)}`
      : "";

  return NextResponse.json(
    {
      version: release.version,
      package: packageUrl,
      url: `https://brandbite.studio/plugins/${product}`,
      requires: release.requiresWp,
      requires_php: release.requiresPhp,
      tested: release.testedWp,
      last_updated: release.releasedAt.toISOString().slice(0, 19).replace("T", " "),
      sections: {
        description: release.description,
        changelog: release.changelog,
      },
    },
    { headers: NO_STORE },
  );
}

/**
 * Stream the zip rather than redirecting to it.
 *
 * A redirect would hand the customer the storage URL, which then works for
 * anyone they pass it to and for as long as the object exists. Streaming keeps
 * the bucket private and keeps the signed token as the only way in.
 */
async function handleDownload(product: string, url: URL) {
  const token = url.searchParams.get("token") ?? "";
  const claims = verifyDownloadToken(token, product, downloadSecret());

  if (!claims) {
    return NextResponse.json({ error: "LINK_EXPIRED" }, { status: 403, headers: NO_STORE });
  }

  const release = await prisma.pluginRelease.findFirst({
    where: { product, published: true },
    orderBy: { releasedAt: "desc" },
  });

  if (!release) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: NO_STORE });
  }

  const packageUrl = await resolveAssetUrl(release.packageKey, null);

  if (!packageUrl) {
    return NextResponse.json({ error: "PACKAGE_UNAVAILABLE" }, { status: 502, headers: NO_STORE });
  }

  const upstream = await fetch(packageUrl, { cache: "no-store" });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "PACKAGE_UNAVAILABLE" }, { status: 502, headers: NO_STORE });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${product}-${release.version}.zip"`,
      ...NO_STORE,
    },
  });
}
