"use client";

// -----------------------------------------------------------------------------
// @file: components/analytics/google-analytics.tsx
// @purpose: Loads GA4 (gtag.js) on public marketing pages only, with Google
//           Consent Mode v2. Mounted once in the root layout; renders nothing
//           when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset (local, demo, tests).
//
//           - gtag.js is only fetched after the visitor lands on a tracked
//             route, so app-only sessions never contact Google.
//           - Page views are sent manually on pathname change (config uses
//             send_page_view:false) and GA is hard-disabled via the
//             `ga-disable-<id>` flag while on an untracked route, so GA's own
//             history-change detection can't leak /customer, /admin etc.
//           - Consent defaults to denied; analytics_storage flips to granted
//             only once the visitor accepts in <CookieConsentBanner />.
// -----------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

import {
  CONSENT_CHANGE_EVENT,
  GA_MEASUREMENT_ID,
  isTrackedPath,
  readConsent,
  type AnalyticsConsent,
} from "@/lib/analytics";

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

function ensureGtag(): Gtag {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // gtag.js expects the raw `arguments` object, not an array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    const stored = readConsent();
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: stored === "granted" ? "granted" : "denied",
      wait_for_update: 500,
    });
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
  }
  return window.gtag;
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const tracked = isTrackedPath(pathname);
  // Sticky: once a tracked page has been seen, keep the script mounted.
  const [shouldLoad, setShouldLoad] = useState(false);
  if (GA_MEASUREMENT_ID && tracked && !shouldLoad) setShouldLoad(true);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    const disableKey = `ga-disable-${GA_MEASUREMENT_ID}`;
    (window as unknown as Record<string, boolean>)[disableKey] = !tracked;
    if (!tracked) return;

    const gtag = ensureGtag();
    gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: pathname,
      page_title: document.title,
    });
  }, [pathname, tracked]);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    const onChange = (e: Event) => {
      const value = (e as CustomEvent<AnalyticsConsent>).detail;
      if (value !== "granted" && value !== "denied") return;
      ensureGtag()("consent", "update", { analytics_storage: value });
    };
    window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
  }, []);

  if (!GA_MEASUREMENT_ID || !shouldLoad) return null;

  return (
    <Script
      id="ga4-gtag"
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`}
      strategy="afterInteractive"
    />
  );
}
