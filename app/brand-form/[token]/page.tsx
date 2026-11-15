// -----------------------------------------------------------------------------
// @file: app/brand-form/[token]/page.tsx
// @purpose: Public page behind a brand form link. Someone at the customer's
//           company describes the brand without an account. Not indexed: a
//           link is only meant for the person it was sent to.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { BrandForm } from "@/components/brand/brand-form";
import { BrandLogo } from "@/components/ui/brand-logo";
import { findQuestionnaireByToken } from "@/lib/brand/questionnaire.server";

export const metadata: Metadata = {
  title: "Brand form",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BrandFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findQuestionnaireByToken(token).catch((error) => {
    console.error("[brand-form] load error", error);
    return { state: "missing" as const };
  });

  return (
    <div className="bb-admin-v2 flex min-h-screen flex-col bg-[var(--av2-bg)]">
      <header className="px-4 py-4 sm:px-8">
        <BrandLogo width={120} className="h-6 w-auto" />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-8">
        <div className="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-6 sm:p-10">
          {found.state === "open" ? (
            <BrandForm token={token} companyName={found.form.companyName} />
          ) : (
            <div>
              <h1 className="text-[32px] leading-10 font-bold tracking-tight">
                {found.state === "closed" ? "This form is closed" : "This link doesn't work"}
              </h1>
              <p className="mt-2 text-base text-[var(--av2-text-2)]">
                {found.state === "closed"
                  ? "It has already been answered, or the link has expired. Ask the person who sent it for a new one."
                  : "Check that you copied the whole link, or ask the person who sent it for a new one."}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
