// -----------------------------------------------------------------------------
// @file: app/customer/tickets/new/page.tsx
// @purpose: New ticket creation page (customer-facing)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-22
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import NewTicketForm from "./NewTicketForm";
import { CustomerNav } from "@/components/navigation/customer-nav";

const DEFAULT_COMPANY_SLUG = "acme-studio";

export default async function CustomerNewTicketPage() {
  const company = await prisma.company.findUnique({
    where: { slug: DEFAULT_COMPANY_SLUG },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!company) {
    // Simple fallback; in a real app this would be a proper error page.
    return (
      <div className="min-h-screen bg-[#f5f3f0] px-6 py-10 text-[#424143]">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            Company not found
          </h1>
          <p className="mt-2 text-sm text-[#7a7a7a]">
            Demo company with slug "{DEFAULT_COMPANY_SLUG}" was not found.
          </p>
        </div>
      </div>
    );
  }

  const projects = await prisma.project.findMany({
    where: { companyId: company.id },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const jobTypes = await prisma.jobType.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* Top navigation */}
        <CustomerNav />

        <main className="mt-4 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-6 shadow-sm">
          <div className="mb-4">
            <h1 className="text-xl font-semibold tracking-tight">
              Create a new design request
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Describe what you need, pick a project and a job type. We will
              route this request to your design team.
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Company:{" "}
              <span className="font-medium text-[#424143]">
                {company.name}
              </span>{" "}
              ({company.slug})
            </p>
          </div>

          <NewTicketForm
            companySlug={company.slug}
            projects={projects}
            jobTypes={jobTypes}
          />
        </main>
      </div>
    </div>
  );
}
