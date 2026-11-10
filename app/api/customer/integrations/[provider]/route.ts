// -----------------------------------------------------------------------------
// @file: app/api/customer/integrations/[provider]/route.ts
// @purpose: Disconnect one provider for the active company (OWNER / PM).
//           Tells the provider to drop our access too (best effort), then
//           forgets the tokens. Connecting happens through each provider's
//           OAuth flow.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { revokeToken } from "@/lib/google/oauth";
import { getDropboxAccessToken, revokeDropboxToken } from "@/lib/integrations/dropbox";
import {
  PROVIDER_LABELS,
  deleteCompanyIntegration,
  getCompanyIntegrationSecrets,
  providerFromSlug,
} from "@/lib/integrations/company-integrations";
import { canManageIntegrations, normalizeCompanyRole } from "@/lib/permissions/companyRoles";

export async function DELETE(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customer accounts have integrations." },
        { status: 403 },
      );
    }
    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company selected." }, { status: 400 });
    }
    if (!canManageIntegrations(normalizeCompanyRole(user.companyRole))) {
      return NextResponse.json(
        { error: "Only company owners or project managers can change integrations." },
        { status: 403 },
      );
    }
    const provider = providerFromSlug((await params).provider);
    if (!provider) {
      return NextResponse.json({ error: "Unknown integration." }, { status: 404 });
    }
    if (provider === "GOOGLE_DRIVE") {
      const secrets = await getCompanyIntegrationSecrets(user.activeCompanyId, provider).catch(
        () => null,
      );
      if (secrets?.refreshToken) await revokeToken(secrets.refreshToken);
    }
    if (provider === "DROPBOX") {
      const token = await getDropboxAccessToken(
        user.activeCompanyId,
        new URL(req.url).origin,
      ).catch(() => null);
      if (token) await revokeDropboxToken(token);
    }
    const removed = await deleteCompanyIntegration(user.activeCompanyId, provider);
    if (!removed) {
      return NextResponse.json(
        { error: `${PROVIDER_LABELS[provider]} is not connected.` },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    console.error("[customer.integrations] DELETE error", error);
    return NextResponse.json({ error: "Could not disconnect the integration." }, { status: 500 });
  }
}
