// -----------------------------------------------------------------------------
// @file: app/customer/layout.tsx
// @purpose: Customer shell on the dashboard design language. Redirects to the
//           /onboarding wizard if company setup is incomplete.
// -----------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { SessionTimeoutWarning } from "@/components/auth/session-timeout-warning";
import { GuestPalettesNotice } from "@/components/colors/studio/guest-palettes-notice";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
// Dashboard typeface, self-hosted; --font-jakarta is set in globals.css.
import "@fontsource-variable/plus-jakarta-sans";

// All customer routes are auth-gated dashboards. Skip SSG so the build
// never pulls heavy client-only deps (DOMPurify/jsdom) into server bundles.
export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  // If the user's company hasn't completed onboarding, redirect to /onboarding
  // (which lives outside the /customer route group to avoid layout loops).
  try {
    const user = await getCurrentUser();

    // No active company → send to onboarding to create/select one
    if (!user?.activeCompanyId) {
      redirect("/onboarding");
    }

    const company = await prisma.company.findUnique({
      where: { id: user.activeCompanyId },
      select: { onboardingCompletedAt: true },
    });
    if (company && !company.onboardingCompletedAt) {
      redirect("/onboarding");
    }
  } catch (err: any) {
    // redirect() throws a NEXT_REDIRECT error — re-throw it
    if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    // Other errors: silently continue to render the page
  }

  return (
    <div className="bb-admin-v2 min-h-screen bg-[var(--av2-bg)]">
      {/* WCAG 2.2.1 — warn before the BetterAuth session expires. No-op
          in demo mode (the /api/session response's expiresAt is null). */}
      <SessionTimeoutWarning />
      <DashboardShell role="customer">
        <GuestPalettesNotice />
        {children}
      </DashboardShell>
      {/* Floating feedback pill — bottom-right of every customer page.
          Hidden in demo mode (see component header). */}
      <FeedbackWidget />
    </div>
  );
}
