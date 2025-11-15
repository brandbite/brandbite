// -----------------------------------------------------------------------------
// @file: app/invite/[token]/page.tsx
// @purpose: Server wrapper for invite landing page
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import InvitePageClient from "./InvitePageClient";

type RouteParamsPromise = Promise<{
  token: string;
}>;

export default async function InvitePage({
  params,
}: {
  params: RouteParamsPromise;
}) {
  const { token } = await params; // ✅ params Promise, burada await ediyoruz
  return <InvitePageClient token={token} />;
}
