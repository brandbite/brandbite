// -----------------------------------------------------------------------------
// @file: prisma/seed.mjs
// @purpose: Seed script for Brandbite demo data (companies, projects, tickets, tokens)
// @version: v1.2.0
// @lastUpdate: 2025-11-20
// -----------------------------------------------------------------------------

import {
  PrismaClient,
  UserRole,
  CompanyRole,
  ProjectRole,
  TicketStatus,
  TicketPriority,
  LedgerDirection,
  WithdrawalStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Brandbite demo data...");

  // ---------------------------------------------------------------------------
  // 0) TEMİZLİK
  // ---------------------------------------------------------------------------
  // Not: Bu kısım dev DB için. Tüm kayıtlari siliyor.
  // Production’da kullanılmamalı.

  // Ticket ile ilişkili child tablolari önce temizle
  await prisma.ticketAssignmentLog.deleteMany({});
  await prisma.ticketComment.deleteMany({});
  await prisma.tokenLedger.deleteMany({});
  await prisma.withdrawal.deleteMany({});

  // Sonra ticket ve diğer üst seviye kayıtlar
  await prisma.ticket.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.companyMember.deleteMany({});
  await prisma.companyInvite.deleteMany({});
  await prisma.company.deleteMany({});
  await prisma.plan.deleteMany({});
  await prisma.jobType.deleteMany({});
  await prisma.userAccount.deleteMany({});

  console.log("✅ Existing data cleared.");

  // ---------------------------------------------------------------------------
  // 1) USERS
  // ---------------------------------------------------------------------------

  const siteOwner = await prisma.userAccount.create({
    data: {
      authUserId: "demo-site-owner-1",
      email: "owner@brandbite-demo.com",
      name: "Demo Site Owner",
      role: UserRole.SITE_OWNER,
    },
  });

  const adminUser = await prisma.userAccount.create({
    data: {
      authUserId: "demo-site-admin-1",
      email: "admin@brandbite-demo.com",
      name: "Demo Site Admin",
      role: UserRole.SITE_ADMIN,
    },
  });

  const designerAda = await prisma.userAccount.create({
    data: {
      authUserId: "demo-designer-ada",
      email: "ada.designer@demo.com",
      name: "Ada Designer",
      role: UserRole.DESIGNER,
    },
  });

  const designerLiam = await prisma.userAccount.create({
    data: {
      authUserId: "demo-designer-liam",
      email: "liam.designer@demo.com",
      name: "Liam Designer",
      role: UserRole.DESIGNER,
    },
  });

  const customerOwner = await prisma.userAccount.create({
    data: {
      authUserId: "demo-customer-owner",
      email: "owner@acme-demo.com",
      name: "Acme Owner",
      role: UserRole.CUSTOMER,
    },
  });

  const customerPM = await prisma.userAccount.create({
    data: {
      authUserId: "demo-customer-pm",
      email: "pm@acme-demo.com",
      name: "Acme PM",
      role: UserRole.CUSTOMER,
    },
  });

  const customerBilling = await prisma.userAccount.create({
    data: {
      authUserId: "demo-customer-billing",
      email: "billing@acme-demo.com",
      name: "Acme Billing",
      role: UserRole.CUSTOMER,
    },
  });

  console.log("✅ Users created.");

  // ---------------------------------------------------------------------------
  // 2) PLANS
  // ---------------------------------------------------------------------------

  const basicPlan = await prisma.plan.create({
    data: {
      name: "Basic",
      monthlyTokens: 100,
      priceCents: 4900,
      isActive: true,
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      name: "Pro",
      monthlyTokens: 200,
      priceCents: 8900,
      isActive: true,
    },
  });

  console.log("✅ Plans created.");

  // ---------------------------------------------------------------------------
  // 3) COMPANY + MEMBERS
  // ---------------------------------------------------------------------------

  const company = await prisma.company.create({
    data: {
      name: "Acme Studio",
      slug: "acme-studio",
      planId: proPlan.id,
      tokenBalance: 120, // demo amaçlı başlangıç bakiye
      autoAssignDefaultEnabled: true, // Demo company: auto-assign ON by default
    },
  });

  const companyOwnerMember = await prisma.companyMember.create({
    data: {
      companyId: company.id,
      userId: customerOwner.id,
      roleInCompany: CompanyRole.OWNER,
    },
  });

  const companyPmMember = await prisma.companyMember.create({
    data: {
      companyId: company.id,
      userId: customerPM.id,
      roleInCompany: CompanyRole.PM,
    },
  });

  const companyBillingMember = await prisma.companyMember.create({
    data: {
      companyId: company.id,
      userId: customerBilling.id,
      roleInCompany: CompanyRole.BILLING,
    },
  });

  console.log("✅ Company & members created.");

  // 3b) SECOND DEMO COMPANY (auto-assign OFF by default)
  // ---------------------------------------------------------------------------

  const company2 = await prisma.company.create({
    data: {
      name: "Acme Studio (Manual Assign)",
      slug: "acme-studio-manual",
      planId: proPlan.id,
      tokenBalance: 80, // biraz daha düşük demo bakiye
      autoAssignDefaultEnabled: false, // burada auto-assign kapalı
    },
  });

  // Aynı demo customer kullanıcılarını ikinci şirkete de üye yapıyoruz
  const company2OwnerMember = await prisma.companyMember.create({
    data: {
      companyId: company2.id,
      userId: customerOwner.id,
      roleInCompany: CompanyRole.OWNER,
    },
  });

  const company2PmMember = await prisma.companyMember.create({
    data: {
      companyId: company2.id,
      userId: customerPM.id,
      roleInCompany: CompanyRole.PM,
    },
  });

  const company2BillingMember = await prisma.companyMember.create({
    data: {
      companyId: company2.id,
      userId: customerBilling.id,
      roleInCompany: CompanyRole.BILLING,
    },
  });

  console.log("✅ Second demo company (manual assign) created.");

  // ---------------------------------------------------------------------------
  // 4) PROJECTS + PROJECT MEMBERS
  // ---------------------------------------------------------------------------

  const websiteProject = await prisma.project.create({
    data: {
      companyId: company.id,
      name: "Website revamp",
      code: "ACME-WEB",
    },
  });

  const onboardingProject = await prisma.project.create({
    data: {
      companyId: company.id,
      name: "Onboarding visuals",
      code: "ACME-ONB",
    },
  });

  // Project-level üyelikler
  await prisma.projectMember.createMany({
    data: [
      // Owner her iki projede OWNER
      {
        projectId: websiteProject.id,
        userId: customerOwner.id,
        role: ProjectRole.OWNER,
      },
      {
        projectId: onboardingProject.id,
        userId: customerOwner.id,
        role: ProjectRole.OWNER,
      },

      // PM sadece Website revamp projesinde PM
      {
        projectId: websiteProject.id,
        userId: customerPM.id,
        role: ProjectRole.PM,
      },

      // Designer'lar contributor olarak projelere bağlanmış
      {
        projectId: websiteProject.id,
        userId: designerAda.id,
        role: ProjectRole.CONTRIBUTOR,
      },
      {
        projectId: onboardingProject.id,
        userId: designerLiam.id,
        role: ProjectRole.CONTRIBUTOR,
      },
    ],
  });

  console.log("✅ Projects & project members created.");

  // ---------------------------------------------------------------------------
  // 5) JOB TYPES
  // ---------------------------------------------------------------------------

  const jobLandingHero = await prisma.jobType.create({
    data: {
      name: "Landing hero redesign",
      description:
        "Hero section redesign for main marketing page.",
      tokenCost: 8,
      designerPayoutTokens: 5,
    },
  });

  const jobPricingVisuals = await prisma.jobType.create({
    data: {
      name: "Pricing page visuals",
      description: "Visual design for SaaS pricing page.",
      tokenCost: 5,
      designerPayoutTokens: 3,
    },
  });

  const jobOnboarding = await prisma.jobType.create({
    data: {
      name: "Onboarding illustration set",
      description: "Set of illustrations for onboarding flow.",
      tokenCost: 10,
      designerPayoutTokens: 7,
    },
  });

  console.log("✅ JobTypes created.");

  // ---------------------------------------------------------------------------
  // 6) TICKETS
  // ---------------------------------------------------------------------------

  const ticket1 = await prisma.ticket.create({
    data: {
      title: "Landing hero redesign",
      description:
        "Update hero section to match new brand colours and layout.",
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      companyId: company.id,
      projectId: websiteProject.id,
      createdById: customerPM.id,
      designerId: designerAda.id,
      jobTypeId: jobLandingHero.id,
      companyTicketNumber: 101,
    },
  });

  const ticket2 = await prisma.ticket.create({
    data: {
      title: "Pricing page illustration",
      description:
        "Create a hero illustration for the pricing page header.",
      status: TicketStatus.TODO,
      priority: TicketPriority.MEDIUM,
      companyId: company.id,
      projectId: websiteProject.id,
      createdById: customerOwner.id,
      designerId: designerLiam.id,
      jobTypeId: jobPricingVisuals.id,
      companyTicketNumber: 102,
    },
  });

  const ticket3 = await prisma.ticket.create({
    data: {
      title: "Onboarding flow visuals",
      description:
        "Design illustrations for each step in the onboarding flow.",
      status: TicketStatus.IN_REVIEW,
      priority: TicketPriority.HIGH,
      companyId: company.id,
      projectId: onboardingProject.id,
      createdById: customerOwner.id,
      designerId: designerLiam.id,
      jobTypeId: jobOnboarding.id,
      companyTicketNumber: 103,
    },
  });

  const ticket4 = await prisma.ticket.create({
    data: {
      title: "Blog cover illustration",
      description:
        "Cover illustration for upcoming product blog post.",
      status: TicketStatus.TODO,
      priority: TicketPriority.LOW,
      companyId: company.id,
      projectId: onboardingProject.id,
      createdById: customerPM.id,
      designerId: designerAda.id,
      jobTypeId: jobOnboarding.id,
      companyTicketNumber: 104,
    },
  });

  console.log("✅ Tickets created.");

  // ---------------------------------------------------------------------------
  // 7) TOKEN LEDGER + WITHDRAWALS (basit demo)
  // ---------------------------------------------------------------------------

  // Company token hareketleri (örnek)
  await prisma.tokenLedger.createMany({
    data: [
      {
        companyId: company.id,
        ticketId: ticket1.id,
        direction: LedgerDirection.DEBIT,
        amount: jobLandingHero.tokenCost,
        reason: "JOB_STARTED",
        notes: "Landing hero redesign started",
        metadata: {
          jobTypeId: jobLandingHero.id,
        },
        balanceBefore: 130,
        balanceAfter: 130 - jobLandingHero.tokenCost,
      },
      {
        companyId: company.id,
        ticketId: ticket3.id,
        direction: LedgerDirection.DEBIT,
        amount: jobOnboarding.tokenCost,
        reason: "JOB_STARTED",
        notes: "Onboarding flow visuals started",
        metadata: {
          jobTypeId: jobOnboarding.id,
        },
        balanceBefore: 122,
        balanceAfter: 122 - jobOnboarding.tokenCost,
      },
    ],
  });

  // Designer token ledger + withdrawals
  await prisma.tokenLedger.createMany({
    data: [
      {
        userId: designerAda.id,
        ticketId: ticket1.id,
        direction: LedgerDirection.CREDIT,
        amount: jobLandingHero.designerPayoutTokens,
        reason: "JOB_COMPLETED",
        notes: "Payout for landing hero redesign",
        metadata: {
          ticketId: ticket1.id,
        },
      },
      {
        userId: designerLiam.id,
        ticketId: ticket3.id,
        direction: LedgerDirection.CREDIT,
        amount: jobOnboarding.designerPayoutTokens,
        reason: "JOB_IN_REVIEW",
        notes:
          "Partial payout for onboarding visuals (in review).",
        metadata: {
          ticketId: ticket3.id,
        },
      },
    ],
  });

  const withdrawalAda = await prisma.withdrawal.create({
    data: {
      designerId: designerAda.id,
      amountTokens: 10,
      status: WithdrawalStatus.APPROVED,
      notes: "First payout for demo",
      metadata: {
        demo: true,
      },
      approvedAt: new Date(),
      paidAt: null,
    },
  });

  const withdrawalLiam = await prisma.withdrawal.create({
    data: {
      designerId: designerLiam.id,
      amountTokens: 5,
      status: WithdrawalStatus.PENDING,
      notes: "Pending payout for onboarding visuals",
      metadata: {
        demo: true,
      },
    },
  });

  console.log("✅ Token ledger & withdrawals created.");
  console.log("🌱 Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
