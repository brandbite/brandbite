// -----------------------------------------------------------------------------
// @file: app/admin/layout.tsx
// @purpose: Admin shell (design language v1) — AdminShell renders the 224px
//           sidebar (icon rail when collapsed, drawer on mobile) and the
//           64px top bar around every admin page. The `.bb-admin-v2` scope
//           and Plus Jakarta Sans apply to the whole admin area so pages
//           that haven't been redesigned yet still share the new type.
// -----------------------------------------------------------------------------

import { SessionTimeoutWarning } from "@/components/auth/session-timeout-warning";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import { GoogleConnectionBanner } from "@/components/admin/google-connection-banner";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/v2/admin-shell";
import { getCurrentUser } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
// Admin typeface (design language v1), self-hosted; --font-jakarta is set
// in globals.css. Browsers only download the files on pages that use it.
import "@fontsource-variable/plus-jakarta-sans";

// All admin routes are auth-gated. Skip SSG so the build does not prerender
// pages that depend on the live DB or client-only libraries.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Page-level role gate. proxy.ts only checks that a session cookie exists,
  // so without this any signed-in customer or creative could load the admin
  // shell (and server components in it, like the Google banner). Every admin
  // API still checks the role itself — this is defence in depth.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isSiteAdminRole(user.role)) {
    redirect(user.role === "DESIGNER" ? "/creative" : "/customer");
  }

  return (
    <div className="bb-admin-v2 min-h-screen bg-[var(--av2-bg)]">
      {/* WCAG 2.2.1 — warn before the BetterAuth session expires. No-op
          in demo mode (the /api/session response's expiresAt is null). */}
      <SessionTimeoutWarning />
      <AdminShell>
        {/* Sitewide alarm while the Google Calendar connection is dead —
            bookings silently fail until someone reconnects, so this must
            not hide on the one settings page admins rarely visit. */}
        <GoogleConnectionBanner />
        {children}
      </AdminShell>
      {/* Floating feedback pill — see component header. Useful for admins
          too: dogfooding catches paper cuts before they hit customers. */}
      <FeedbackWidget />
    </div>
  );
}
