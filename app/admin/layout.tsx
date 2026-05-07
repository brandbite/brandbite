// -----------------------------------------------------------------------------
// @file: app/admin/layout.tsx
// @purpose: Admin shell — fixed-left sidebar + content area. The sidebar
//           collapses to an icon rail via a user toggle and becomes a
//           slide-in drawer on mobile.
// -----------------------------------------------------------------------------

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { SessionTimeoutWarning } from "@/components/auth/session-timeout-warning";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";

// All admin routes are auth-gated. Skip SSG so the build does not prerender
// pages that depend on the live DB or client-only libraries.
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bb-bg-card)] text-[var(--bb-secondary)]">
      {/* WCAG 2.2.1 — warn before the BetterAuth session expires. No-op
          in demo mode (the /api/session response's expiresAt is null). */}
      <SessionTimeoutWarning />
      <AppSidebar role="admin" />
      {/*
        Content is offset by the live sidebar width on md+. The sidebar
        writes --bb-sidebar-w to <html> whenever the user toggles collapse,
        so this stays in sync without prop drilling. Fallback = 240px for
        the very first paint before the client hydrates.
      */}
      <div className="md:pl-[var(--bb-sidebar-w,240px)] md:transition-[padding] md:duration-200">
        {/* Horizontal padding intentionally matches the pre-sidebar layout
            (md:px-6 lg:px-8). The sidebar already claims 240px of the
            viewport; bumping content padding further squeezes pages
            designed for the old full-width top-nav layout (e.g. /admin/plans
            2-col grid). */}
        <main id="main-content" className="px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
      {/* Floating feedback pill — see component header. Useful for admins
          too: dogfooding catches paper cuts before they hit customers. */}
      <FeedbackWidget />
    </div>
  );
}
