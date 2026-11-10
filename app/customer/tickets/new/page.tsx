// -----------------------------------------------------------------------------
// @file: app/customer/tickets/new/page.tsx
// @purpose: New ticket creation page (customer-facing)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-22
// -----------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { PageHeader } from "@/components/admin/v2/ui";
import { BackLink } from "@/components/dashboard/tickets/shared";
import NewTicketForm from "./NewTicketForm";
import type { TagOption } from "@/components/ui/tag-multi-select";
import { getAiTicketsMode, isAiTicketsAllowed, isTagsEnabled } from "@/lib/feature-flags";
import { DRAFT_ATTACHMENT_SELECT, draftToClient } from "@/lib/ticket-drafts";

export default async function CustomerNewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ jobTypeId?: string; draft?: string }>;
}) {
  const user = await getCurrentUserOrThrow();

  if (!user.activeCompanyId) {
    redirect("/onboarding");
  }

  const params = await searchParams;
  const initialJobTypeId = params.jobTypeId ?? undefined;
  const company = await prisma.company.findUnique({
    where: { id: user.activeCompanyId },
    select: {
      id: true,
      name: true,
      slug: true,
      tokenBalance: true,
    },
  });

  if (!company) {
    redirect("/onboarding");
  }

  // Only the person's own draft; a link to anything else goes to their list.
  const draftRow = params.draft
    ? await prisma.ticketDraft.findFirst({
        where: { id: params.draft, createdById: user.id, companyId: company.id },
        include: { attachments: { select: DRAFT_ATTACHMENT_SELECT } },
      })
    : null;
  if (params.draft && !draftRow) {
    redirect("/customer/tickets/drafts");
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

  const rawJobTypes = await prisma.jobType.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      category: true,
      categoryRef: {
        select: { name: true, icon: true, sortOrder: true },
      },
      description: true,
      tokenCost: true,
      hasQuantity: true,
      quantityLabel: true,
      defaultQuantity: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Flatten categoryRef into the job type for the picker
  const jobTypes = rawJobTypes.map((jt) => ({
    id: jt.id,
    name: jt.name,
    category: jt.categoryRef?.name ?? jt.category,
    categorySortOrder: jt.categoryRef?.sortOrder ?? 999,
    description: jt.description,
    tokenCost: jt.tokenCost,
    hasQuantity: jt.hasQuantity,
    quantityLabel: jt.quantityLabel,
    defaultQuantity: jt.defaultQuantity,
  }));

  // Skip the tag query entirely when the global flag is off — the form
  // renders the TagMultiSelect only if it has at least one option OR
  // canCreateTags is true, so an empty array is the natural hide path.
  const aiEnabled = isAiTicketsAllowed(await getAiTicketsMode());

  const tagsEnabled = await isTagsEnabled();
  const tags = tagsEnabled
    ? await prisma.ticketTag.findMany({
        where: { companyId: company.id },
        select: {
          id: true,
          name: true,
          color: true,
        },
        orderBy: {
          name: "asc",
        },
      })
    : [];

  return (
    <>
      <BackLink href="/customer/tickets">Back to requests</BackLink>
      <PageHeader
        title={draftRow ? "Continue your draft" : "Create a new request"}
        description="Describe what you need, pick a project and a service. We will route this request to your creative team."
        meta={
          <>
            Company <span className="font-medium text-[var(--av2-text)]">{company.name}</span>
          </>
        }
      />

      <NewTicketForm
        companySlug={company.slug}
        projects={projects}
        jobTypes={jobTypes}
        tokenBalance={company.tokenBalance}
        tags={tags as unknown as TagOption[]}
        initialJobTypeId={initialJobTypeId}
        initialDraft={draftRow ? draftToClient(draftRow) : null}
        aiEnabled={aiEnabled}
        // When the global flag is off, force-hide tag UI for everyone —
        // including OWNER/PM who would otherwise see the create-tag chip
        // via the canManageTagsCheck fallback inside the form. Passing
        // `false` overrides that fallback (the form uses `??`, not `||`).
        canCreateTags={tagsEnabled ? undefined : false}
      />
    </>
  );
}
