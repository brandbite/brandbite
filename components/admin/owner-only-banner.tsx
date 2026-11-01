// -----------------------------------------------------------------------------
// @file: components/admin/owner-only-banner.tsx
// @purpose: Banner shown at the top of admin pages whose mutations are locked
//           to SITE_OWNER. Renders nothing while loading or when the viewer
//           IS the owner. Keeps the "why can't I edit this?" question off
//           the support channel. Styled with the admin v2 Callout.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useSessionRole } from "@/lib/hooks/use-session-role";
import { Callout } from "@/components/admin/v2/ui";

type Props = {
  /** Short human description of what only the owner can do on this page. */
  action: string;
};

export function OwnerOnlyBanner({ action }: Props) {
  const { isSiteOwner, loading } = useSessionRole();

  // Hide while loading (prevents flash) and for owners (who can do the thing).
  if (loading || isSiteOwner) return null;

  return (
    <div role="note" className="mb-6">
      <Callout tone="warning" title="Site owner only">
        Site admins can view this page, but only the site owner can {action}. Requests from admins
        will be rejected with a 403.
      </Callout>
    </div>
  );
}
