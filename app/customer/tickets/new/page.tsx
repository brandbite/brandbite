// -----------------------------------------------------------------------------
// @file: app/customer/tickets/new/page.tsx
// @purpose: New ticket creation page (customer-facing)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import NewTicketForm from "./NewTicketForm";

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
        {/* Top navigation (Brandbite style) */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f15b2b] text-sm font-semibold text-white">
              B
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Brandbite
            </span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-[#7a7a7a] md:flex">
            <button className="font-medium text-[#7a7a7a]">
              My tickets
            </button>
            <button className="font-medium text-[#424143]">
              New ticket
            </button>
            <button className="font-medium text-[#7a7a7a]">Tokens</button>
          </nav>
        </header>

        <main className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-6 shadow-sm">
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