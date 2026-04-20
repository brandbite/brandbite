// -----------------------------------------------------------------------------
// @file: app/customer/layout.tsx
// @purpose: Customer shell — shared nav + page wrapper for all customer routes.
//           Redirects to /onboarding wizard if company setup is incomplete.
// -----------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  // Normal customer layout with sidebar
  return (
    <div className="min-h-screen bg-[var(--bb-bg-card)] text-[var(--bb-secondary)]">
      <AppSidebar role="customer" />
      <div className="md:pl-[var(--bb-sidebar-w,240px)] md:transition-[padding] md:duration-200">
        <main className="px-4 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
