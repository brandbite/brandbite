"use client";

// -----------------------------------------------------------------------------
// @file: components/analytics/cookie-consent-banner.tsx
// @purpose: Analytics cookie banner for public marketing pages. Shown until
//           the visitor accepts or declines; reopened from the "Cookie
//           settings" button in the Privacy Policy cookie section. Hidden
//           entirely when GA is not configured (no cookies → nothing to ask).
// -----------------------------------------------------------------------------

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CONSENT_CHANGE_EVENT,
  GA_MEASUREMENT_ID,
  OPEN_COOKIE_SETTINGS_EVENT,
  isTrackedPath,
  openCookieSettings,
  readConsent,
  writeConsent,
  type AnalyticsConsent,
} from "@/lib/analytics";

function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// On the server (and during hydration) the stored choice is unknown; report it
// as "server" so the banner never flashes in SSR markup.
const getServerConsent = () => "server" as const;

export function CookieConsentBanner() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeConsent, readConsent, getServerConsent);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    const reopen = () => setReopened(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  const open = consent === null || reopened;
  if (!GA_MEASUREMENT_ID || !open || !isTrackedPath(pathname)) return null;

  const choose = (value: AnalyticsConsent) => {
    writeConsent(value);
    setReopened(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[90] flex justify-center p-4 max-[767px]:p-3"
    >
      <div className="flex w-full max-w-[760px] items-center gap-5 rounded-2xl border border-[#E8E2DC] bg-white px-6 py-4 text-[#2B2D33] shadow-[0_8px_30px_rgba(31,32,36,0.12)] max-[767px]:flex-col max-[767px]:items-stretch max-[767px]:gap-3 max-[767px]:px-4">
        <p className="text-sm leading-5">
          We use Google Analytics cookies to understand how visitors use our site. Your choice
          doesn&rsquo;t affect anything else.{" "}
          <Link href="/privacy#cookies" className="font-semibold underline underline-offset-2">
            Cookie notice
          </Link>
        </p>
        <div className="flex shrink-0 gap-2 max-[767px]:justify-end">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="h-10 cursor-pointer rounded-[10px] border border-[#1F2024] bg-white px-4 text-sm font-semibold text-[#1F2024] transition-colors hover:bg-[#F7F4F1] focus-visible:ring-2 focus-visible:ring-[#FF6426] focus-visible:outline-none"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="h-10 cursor-pointer rounded-[10px] bg-[#1F2024] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#FF6426] focus-visible:ring-2 focus-visible:ring-[#FF6426] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/** Reopens the banner so a visitor can change or withdraw their choice. */
export function CookieSettingsButton({ className }: { className?: string }) {
  if (!GA_MEASUREMENT_ID) return null;
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      Cookie settings
    </button>
  );
}
