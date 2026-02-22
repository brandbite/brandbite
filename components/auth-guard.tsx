// -----------------------------------------------------------------------------
// @file: components/auth-guard.tsx
// @purpose: Global 401 interceptor — redirects to /login on expired sessions
// -----------------------------------------------------------------------------

"use client";

import { useEffect } from "react";

/**
 * Patches the global fetch to detect 401 responses on our own API routes.
 * When a 401 is detected (session expired / revoked), the user is
 * redirected to /login so they can re-authenticate.
 *
 * Rendered once in the root layout. No visible UI.
 */
export function AuthGuard() {
  useEffect(() => {
    // Skip in demo mode — demo cookies don't expire
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return;

    const originalFetch = window.fetch;

    window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
      const res = await originalFetch(input, init);

      // Only intercept our own API routes, not external calls
      if (res.status === 401) {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;

        if (url.startsWith("/api/") && !url.startsWith("/api/auth/")) {
          // Redirect to login — session has expired
          window.location.href = "/login";
        }
      }

      return res;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
