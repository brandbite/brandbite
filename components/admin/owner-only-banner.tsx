// -----------------------------------------------------------------------------
// @file: components/admin/owner-only-banner.tsx
// @purpose: Banner shown at the top of admin pages whose mutations are locked
//           to SITE_OWNER. Renders nothing while loading or when the viewer
//           IS the owner. Keeps the "why can't I edit this?" question off
//           the support channel.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-21
// -----------------------------------------------------------------------------

"use client";

import { useSessionRole } from "@/lib/hooks/use-session-role";

type Props = {
  /** Short human description of what only the owner can do on this page. */
  action: string;
};

export function OwnerOnlyBanner({ action }: Props) {
  const { isSiteOwner, loading } = useSessionRole();

  // Hide while loading (prevents flash) and for owners (who can do the thing).
  if (loading || isSiteOwner) return null;

  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-3 rounded-xl border border-[var(--bb-warning-border)] bg-[var(--bb-warning-bg)] px-4 py-3 text-sm text-[var(--bb-warning-text)]"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Site owner only</p>
        <p className="mt-0.5 text-xs leading-relaxed opacity-90">
          Site admins can view this page, but only the site owner can {action}. Requests from admins
          will be rejected with a 403.
        </p>
      </div>
    </div>
  );
}
