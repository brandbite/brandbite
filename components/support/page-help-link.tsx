"use client";

// -----------------------------------------------------------------------------
// @file: components/support/page-help-link.tsx
// @purpose: The per-page "?" help link. Resolves the Support guide for the
//           current pathname and links to it, falling back to the role's
//           Support home when the page has no guide yet. Rendered in the
//           admin top bar and in the customer/creative sidebar bottom rail.
// -----------------------------------------------------------------------------

import Link from "next/link";
import { usePathname } from "next/navigation";

import { IconFaq } from "@/components/navigation/nav-icons";
import { findGuideForPath, guideHref, supportBasePath, type SupportRole } from "@/lib/support";
import { useSessionRole } from "@/lib/hooks/use-session-role";

export function PageHelpLink({
  role,
  className,
  iconSize = 18,
  showLabel = false,
}: {
  role: SupportRole;
  className?: string;
  iconSize?: number;
  /** Render the "Help" text next to the icon. */
  showLabel?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const { isSiteOwner } = useSessionRole();
  const guide = findGuideForPath(role, pathname, { isSiteOwner });
  const onSupport = pathname.startsWith(supportBasePath(role));

  const href = guide && !onSupport ? guideHref(role, guide.slug) : supportBasePath(role);
  const label = guide && !onSupport ? `Help: ${guide.title}` : "Help and support";

  return (
    <Link href={href} aria-label={label} title={label} className={className}>
      <IconFaq width={iconSize} height={iconSize} className="shrink-0" />
      {showLabel && <span>Help</span>}
    </Link>
  );
}
