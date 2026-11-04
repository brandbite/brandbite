// -----------------------------------------------------------------------------
// @file: app/creative/profile/page.tsx
// @purpose: Personal profile page rendered inside the creative shell.
//           Delegates to the shared <ProfileForm />; creative-specific
//           settings (skills, availability, payout tiers) stay in
//           /creative/settings.
// -----------------------------------------------------------------------------

import { PageHeader } from "@/components/admin/v2/ui";
import { ProfileForm } from "@/components/profile/profile-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your profile" };

export default function CreativeProfilePage() {
  return (
    <>
      <PageHeader
        title="Your profile"
        description="Manage your identity and timezone. Set your working hours in Workload."
      />
      <ProfileForm layout="tabs" surface="dashboard" />
    </>
  );
}
