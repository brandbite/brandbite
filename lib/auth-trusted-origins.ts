// -----------------------------------------------------------------------------
// @file: lib/auth-trusted-origins.ts
// @purpose: Extra origins BetterAuth should accept. A Vercel preview runs on its own
//           *.vercel.app address rather than NEXT_PUBLIC_APP_URL, so sign-in there
//           fails with "Invalid origin" unless that deployment's address is trusted.
//           Production gets nothing extra, and no wildcard is ever used, because
//           anyone can host a *.vercel.app site.
// -----------------------------------------------------------------------------

export function previewTrustedOrigins(env: Record<string, string | undefined>): string[] {
  if (env.VERCEL_ENV !== "preview") return [];
  return [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`);
}
