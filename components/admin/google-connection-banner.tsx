// -----------------------------------------------------------------------------
// @file: components/admin/google-connection-banner.tsx
// @purpose: Admin-wide red banner shown while the Google Calendar OAuth
//           connection is flagged broken (ConsultationSettings.
//           googleConnectionBrokenAt — see lib/google/connection-health.ts).
//           Rendered from the admin layout so the breakage is visible on
//           every admin page, not just the settings screen the admin has
//           no reason to visit. Renders nothing when healthy, on DB
//           hiccups (a broken banner-query must never take down the
//           admin shell), or when Google was never connected.
// -----------------------------------------------------------------------------

import Link from "next/link";

import { InlineAlert } from "@/components/ui/inline-alert";
import { prisma } from "@/lib/prisma";

export async function GoogleConnectionBanner() {
  let row: { googleConnectionBrokenAt: Date | null; googleConnectionLastError: string | null };
  try {
    const found = await prisma.consultationSettings.findUnique({
      where: { singleton: true },
      select: { googleConnectionBrokenAt: true, googleConnectionLastError: true },
    });
    if (!found) return null;
    row = found;
  } catch {
    return null;
  }
  if (!row.googleConnectionBrokenAt) return null;

  return (
    <div className="mb-6">
      <InlineAlert variant="error" title="Google Calendar connection is broken">
        Google rejected the stored credentials
        {row.googleConnectionLastError ? ` (${row.googleConnectionLastError})` : ""} — consultation
        and interview bookings cannot create calendar events until it&apos;s reconnected.{" "}
        <Link className="font-semibold underline" href="/admin/consultations/settings">
          Reconnect Google Calendar
        </Link>
      </InlineAlert>
    </div>
  );
}
