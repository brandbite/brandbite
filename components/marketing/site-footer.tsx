// -----------------------------------------------------------------------------
// @file: components/marketing/site-footer.tsx
// @purpose: Shared footer for all marketing pages.
//
//           Brand statement, link columns, and the legal-link strip are
//           DB-driven via PageBlock(pageKey="global", type="SITE_FOOTER").
//           Editable from /admin/site. Logo, brand-primary highlight on
//           the brand statement, and the copyright year stay hardcoded —
//           those don't change with content edits.
//
//           Was a server component before this PR — now a client
//           component so it can fetch /api/page-blocks/global on mount.
//           Same approach as site-header.tsx and the landing page
//           sections.
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DEFAULT_SITE_FOOTER_DATA } from "@/lib/blocks/defaults";
import { BLOCK_TYPES, parseBlockData, type SiteFooterData } from "@/lib/blocks/types";

type GlobalBlocksApiPayload = { type?: string; data?: unknown };

export function SiteFooter() {
  const [data, setData] = useState<SiteFooterData>(DEFAULT_SITE_FOOTER_DATA);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/page-blocks/global")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/page-blocks/global returned ${res.status}`);
        return res.json();
      })
      .then((json: { blocks?: GlobalBlocksApiPayload[] }) => {
        if (cancelled) return;
        const row = json.blocks?.find((b) => b?.type === BLOCK_TYPES.SITE_FOOTER);
        if (!row) return;
        const parsed = parseBlockData({ type: BLOCK_TYPES.SITE_FOOTER, data: row.data });
        if (parsed && parsed.type === BLOCK_TYPES.SITE_FOOTER) {
          setData(parsed.data);
        }
      })
      .catch(() => {
        // Silent fallback to defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="bg-[#2A2A2D] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-6">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Image
              src="/brandbite-logo.svg"
              alt="Brandbite"
              width={140}
              height={35}
              className="h-7 w-auto brightness-0 invert"
            />
            {data.brandStatement ? (
              <p className="mt-3 text-sm leading-relaxed text-gray-400">
                {/* Render the brand statement with the last comma-separated
                    phrase highlighted in primary, matching the original
                    "All your creatives, one subscription" treatment. If
                    the statement has no comma we render it plain. */}
                <BrandStatement text={data.brandStatement} />
              </p>
            ) : null}
          </div>

          {/* Link columns */}
          {data.columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={`${col.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-300 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar — copyright + repeat-of-legal links */}
      <div className="bg-[var(--bb-primary)] px-6 py-3">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-white/80">
            &copy; {new Date().getFullYear()} Brandbite. All rights reserved.
          </p>
          {data.legalLinks && data.legalLinks.length > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80">
              {data.legalLinks.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

/**
 * Brand statement renderer that highlights the final comma-separated
 * phrase in primary, preserving the original "All your creatives,
 * one subscription" visual treatment when admins keep the comma
 * convention. Falls back to plain text when no comma is present.
 */
function BrandStatement({ text }: { text: string }) {
  const lastCommaIdx = text.lastIndexOf(",");
  if (lastCommaIdx === -1) {
    return <>{text}</>;
  }
  const head = text.slice(0, lastCommaIdx + 1);
  const tail = text.slice(lastCommaIdx + 1).trimStart();
  return (
    <>
      {head} <span className="text-[var(--bb-primary)]">{tail}</span>
    </>
  );
}
