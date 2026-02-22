// -----------------------------------------------------------------------------
// @file: lib/auth-client.ts
// @purpose: BetterAuth React client — provides signIn, signUp, signOut,
//           useSession, and magic link methods for client components.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-22
// -----------------------------------------------------------------------------

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});
