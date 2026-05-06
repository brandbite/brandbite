// -----------------------------------------------------------------------------
// @file: app/creative/profile/page.tsx
// @purpose: Personal profile page rendered inside the creative shell.
//           Delegates to the shared <ProfileForm />; creative-specific
//           settings (working hours, categories, pause toggle) stay in
//           /creative/settings.
// -----------------------------------------------------------------------------

import { ProfileForm } from "@/components/profile/profile-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your profile" };

export default function CreativeProfilePage() {
  return <ProfileForm />;
}
