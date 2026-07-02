// -----------------------------------------------------------------------------
// @file: app/creative/profile/page.tsx
// @purpose: Personal profile page rendered inside the creative shell.
//           Delegates to the shared <ProfileForm />; creative-specific
//           settings (working hours, categories, pause toggle) stay in
//           /creative/settings.
// -----------------------------------------------------------------------------

import Link from "next/link";

import { ProfileForm } from "@/components/profile/profile-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your profile" };

export default function CreativeProfilePage() {
  return (
    <div className="space-y-4">
      {/* Onboarding guidance — orient new creatives to the setup steps.
          Requested from creative smoke-test feedback (a short tutorial line). */}
      <div className="rounded-xl border border-[var(--bb-info-border)] bg-[var(--bb-info-bg)] px-4 py-3 text-sm text-[var(--bb-info-text)]">
        <p className="font-semibold">Finish setting up your account</p>
        <p className="mt-1 text-[13px]">
          Complete your profile below, then set your working hours, skills, and availability in{" "}
          <Link href="/creative/settings" className="font-semibold underline">
            Settings
          </Link>{" "}
          so work can be assigned to you.
        </p>
      </div>
      <ProfileForm />
    </div>
  );
}
