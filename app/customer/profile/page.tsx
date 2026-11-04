// -----------------------------------------------------------------------------
// @file: app/customer/profile/page.tsx
// @purpose: Personal profile page rendered inside the customer shell.
//           Delegates to the shared <ProfileForm /> so customer / creative /
//           admin profile pages stay in lock-step. Anything customer-specific
//           (plan, tokens, members) lives in /customer/settings.
// -----------------------------------------------------------------------------

import { PageHeader } from "@/components/admin/v2/ui";
import { ProfileForm } from "@/components/profile/profile-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your profile" };

export default function CustomerProfilePage() {
  return (
    <>
      <PageHeader
        title="Your profile"
        description="Personal details, timezone, and what we can email you about. Company-level settings (plan, members, billing) stay in Settings."
      />
      <ProfileForm layout="tabs" surface="dashboard" />
    </>
  );
}
