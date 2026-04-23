// -----------------------------------------------------------------------------
// @file: next.config.ts
// @purpose: Next.js configuration — security headers, Sentry, optimizations
// -----------------------------------------------------------------------------

import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    // Kept alongside CSP frame-ancestors for older browsers that only honour
    // the legacy header. Modern browsers read frame-ancestors and ignore this.
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    // window.opener isolation + Spectre mitigation. Blocks a malicious
    // popup from reading window.opener back to our origin. We don't rely
    // on cross-origin window.opener communication anywhere, so this is safe.
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    // Obsolete Flash/PDF policy file exfil vector — zero-cost hardening.
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://placehold.co https://img.youtube.com https://i.ytimg.com https://i3.ytimg.com https://i.vimeocdn.com",
      "connect-src 'self' https://api.stripe.com https://*.ingest.sentry.io",
      "frame-src https://js.stripe.com https://www.youtube.com https://player.vimeo.com https://www.loom.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      // Prevents phishing-by-form-exfil: if XSS injects a <form action="https://evil">,
      // the browser refuses to submit it.
      "form-action 'self'",
      // Modern, CSP-native version of X-Frame-Options. DENY-equivalent.
      "frame-ancestors 'none'",
      // Auto-upgrade any accidental http:// subresource to https://. Belt-and-braces
      // with HSTS which forces it at the navigation level.
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["isomorphic-dompurify"],
  images: {
    // R2-hosted assets (hero images, thumbnails) served either through the
    // S3-compatible origin or an optional custom public domain (R2_PUBLIC_BASE_URL).
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.r2.dev" },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only log source map upload in CI
  silent: !process.env.CI,

  // Tree-shake Sentry logger in production
  disableLogger: true,

  // Hide source maps from client bundles
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
