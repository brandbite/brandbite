// -----------------------------------------------------------------------------
// @file: app/creative/layout.tsx
// @purpose: Creative shell on the dashboard design language.
// -----------------------------------------------------------------------------

import { SessionTimeoutWarning } from "@/components/auth/session-timeout-warning";
import { GuestPalettesNotice } from "@/components/colors/studio/guest-palettes-notice";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
// Dashboard typeface, self-hosted; --font-jakarta is set in globals.css.
import "@fontsource-variable/plus-jakarta-sans";

export const dynamic = "force-dynamic";

export default function CreativeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bb-admin-v2 min-h-screen bg-[var(--av2-bg)]">
      {/* WCAG 2.2.1 — warn before the BetterAuth session expires. No-op
          in demo mode (the /api/session response's expiresAt is null). */}
      <SessionTimeoutWarning />
      <DashboardShell role="creative">
        <GuestPalettesNotice />
        {children}
      </DashboardShell>
      {/* Floating feedback pill — see component header. */}
      <FeedbackWidget />
    </div>
  );
}
