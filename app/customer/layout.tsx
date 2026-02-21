// -----------------------------------------------------------------------------
// @file: app/customer/layout.tsx
// @purpose: Customer shell — shared nav + page wrapper for all customer routes.
//           Redirects to /onboarding wizard if company setup is incomplete.
// -----------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { AppNav } from "@/components/navigation/app-nav";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // If the user's company hasn't completed onboarding, redirect to /onboarding
  // (which lives outside the /customer route group to avoid layout loops).
  try {
    const user = await getCurrentUser();
    if (user?.activeCompanyId) {
      const company = await prisma.company.findUnique({
        where: { id: user.activeCompanyId },
        select: { onboardingCompletedAt: true },
      });
      if (company && !company.onboardingCompletedAt) {
        redirect("/onboarding");
      }
    }
  } catch (err: any) {
    // redirect() throws a NEXT_REDIRECT error — re-throw it
    if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    // Other errors: silently continue to render the page
  }

  // Normal customer layout with nav
  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="relative px-4 pt-6 md:px-6 md:pt-8 lg:px-8 lg:pt-10">
        <AppNav role="customer" />
      </div>
      <div className="px-4 pb-6 md:px-6 md:pb-8 lg:px-8 lg:pb-10">{children}</div>
    </div>
  );
}
