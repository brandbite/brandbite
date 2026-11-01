// -----------------------------------------------------------------------------
// @file: app/admin/layout.tsx
// @purpose: Admin shell (design language v1) — AdminShell renders the 224px
//           sidebar (icon rail when collapsed, drawer on mobile) and the
//           64px top bar around every admin page. The `.bb-admin-v2` scope
//           and Plus Jakarta Sans apply to the whole admin area so pages
//           that haven't been redesigned yet still share the new type.
// -----------------------------------------------------------------------------

import { SessionTimeoutWarning } from "@/components/auth/session-timeout-warning";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import { GoogleConnectionBanner } from "@/components/admin/google-connection-banner";
import { AdminShell } from "@/components/admin/v2/admin-shell";
import { adminFont } from "@/lib/fonts/admin";

// All admin routes are auth-gated. Skip SSG so the build does not prerender
// pages that depend on the live DB or client-only libraries.
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${adminFont.variable} bb-admin-v2 min-h-screen bg-[var(--av2-bg)]`}>
      {/* WCAG 2.2.1 — warn before the BetterAuth session expires. No-op
          in demo mode (the /api/session response's expiresAt is null). */}
      <SessionTimeoutWarning />
      <AdminShell>
        {/* Sitewide alarm while the Google Calendar connection is dead —
            bookings silently fail until someone reconnects, so this must
            not hide on the one settings page admins rarely visit. */}
        <GoogleConnectionBanner />
        {children}
      </AdminShell>
      {/* Floating feedback pill — see component header. Useful for admins
          too: dogfooding catches paper cuts before they hit customers. */}
      <FeedbackWidget />
    </div>
  );
}
