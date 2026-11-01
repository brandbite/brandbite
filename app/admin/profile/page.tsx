// -----------------------------------------------------------------------------
// @file: app/admin/profile/page.tsx
// @purpose: Personal profile page rendered inside the admin shell.
//           Delegates to the shared <ProfileForm /> in its "tabs" layout
//           (Personal details / Notifications / Security & sessions) on the
//           admin design language v1; admin-only flows (MFA enrollment,
//           audit log, user management) stay under /admin/settings +
//           /admin/users.
//
//           SITE_OWNER and SITE_ADMIN do not see the "Delete account"
//           section — admin deletions go through /admin/users by another
//           SITE_OWNER, never self-service.
// -----------------------------------------------------------------------------

import { PageHeader } from "@/components/admin/v2/ui";
import { ProfileForm } from "@/components/profile/profile-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your profile" };

export default function AdminProfilePage() {
  return (
    <>
      <PageHeader
        title="Your profile"
        description="Manage your details, notification preferences and account security."
      />
      <ProfileForm layout="tabs" />
    </>
  );
}
