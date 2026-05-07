// -----------------------------------------------------------------------------
// @file: app/creative/layout.tsx
// @purpose: Creative shell — fixed-left sidebar + content area.
// -----------------------------------------------------------------------------

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { SessionTimeoutWarning } from "@/components/auth/session-timeout-warning";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";

export const dynamic = "force-dynamic";

export default function CreativeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bb-bg-card)] text-[var(--bb-secondary)]">
      {/* WCAG 2.2.1 — warn before the BetterAuth session expires. No-op
          in demo mode (the /api/session response's expiresAt is null). */}
      <SessionTimeoutWarning />
      <AppSidebar role="creative" />
      <div className="md:pl-[var(--bb-sidebar-w,240px)] md:transition-[padding] md:duration-200">
        <main id="main-content" className="px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
      {/* Floating feedback pill — see component header. */}
      <FeedbackWidget />
    </div>
  );
}
