// -----------------------------------------------------------------------------
// @file: components/a11y-dev-monitor.tsx
// @purpose: Dev-only accessibility monitor. Loads @axe-core/react at
//           runtime in development and prints WCAG violations to the
//           browser console as pages re-render. Produces zero bytes in
//           production builds because the dynamic import is gated behind
//           `process.env.NODE_ENV !== "production"`, which Next's compiler
//           dead-code-eliminates.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-21
// -----------------------------------------------------------------------------

"use client";

import { useEffect } from "react";

export function A11yDevMonitor() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    // Dynamic imports so the axe-core bundle (large!) never lands in
    // production. Both imports only run client-side in dev.
    let cancelled = false;
    (async () => {
      const [{ default: axe }, React, ReactDOM] = await Promise.all([
        import("@axe-core/react"),
        import("react"),
        import("react-dom"),
      ]);
      if (cancelled) return;

      // Debounce: 1s between re-audits so typing in a form doesn't spam
      // the console on every keystroke. Default rule set — axe's
      // built-in WCAG 2.2 AA coverage.
      axe(React, ReactDOM, 1000);

      // eslint-disable-next-line no-console
      console.info("[a11y] axe-core dev monitor active — WCAG violations will be logged here.");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
