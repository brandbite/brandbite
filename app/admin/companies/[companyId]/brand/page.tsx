// -----------------------------------------------------------------------------
// @file: app/admin/companies/[companyId]/brand/page.tsx
// @purpose: A company's brand guide for site admins, read-only: brand
//           details, colors, fonts and the brand files to download.
// @version: v1.1.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

"use client";

import { use } from "react";

import { PageHeader, TextLink } from "@/components/admin/v2/ui";
import { BrandGuidePanel } from "@/components/brand/ticket-brand-guide";

export default function AdminCompanyBrandPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = use(params);
  return (
    <>
      <PageHeader
        title="Brand guide"
        actions={
          <TextLink href="/admin/companies" arrow={false}>
            Back to companies
          </TextLink>
        }
      />
      <BrandGuidePanel apiBase={`/api/admin/companies/${companyId}/brand`} layout="page" />
    </>
  );
}
