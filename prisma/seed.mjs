// -----------------------------------------------------------------------------
// @file: prisma/seed.mjs
// @purpose: Seed script for Brandbite demo data (companies, projects, tickets, tokens)
// @version: v1.3.0
// @status: active
// @lastUpdate: 2025-11-21
// -----------------------------------------------------------------------------

import crypto from "crypto";
import {
  PrismaClient,
  UserRole,
  CompanyRole,
  ProjectRole,
  TicketStatus,
  TicketPriority,
  LedgerDirection,
  WithdrawalStatus,
  HelpTargetRole,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Brandbite demo data...");

  // ---------------------------------------------------------------------------
  // 0) TEMİZLİK
  // ---------------------------------------------------------------------------
  // Not: Bu kısım dev DB için. Tüm kayıtlari siliyor.
  // Production’da kullanılmamalı.

  // Help center
  await prisma.helpArticle.deleteMany({});
  await prisma.helpCategory.deleteMany({});

  // Ticket ile ilişkili child tablolari önce temizle (deepest children first)
  await prisma.assetPinComment.deleteMany({});
  await prisma.assetPin.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.ticketRevision.deleteMany({});
  await prisma.ticketOutputSpec.deleteMany({});
  await prisma.ticketAssignmentLog.deleteMany({});
  await prisma.ticketComment.deleteMany({});
  await prisma.notificationPreference.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.tokenLedger.deleteMany({});
  await prisma.withdrawal.deleteMany({});
  await prisma.ticketTagAssignment.deleteMany({});
  await prisma.ticketTag.deleteMany({});

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

  // New customer with NO company — for onboarding wizard testing
  const customerNew = await prisma.userAccount.create({
    data: {
      authUserId: "demo-customer-new",
      email: "new@customer-demo.com",
      name: "New Customer",
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
      maxConcurrentInProgressTickets: 1,
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      name: "Pro",
      monthlyTokens: 200,
      priceCents: 8900,
      isActive: true,
      maxConcurrentInProgressTickets: 1,
    },
  });

  const fullPlan = await prisma.plan.create({
    data: {
      name: "Full",
      monthlyTokens: 400,
      priceCents: 14900,
      isActive: true,
      maxConcurrentInProgressTickets: 2,
    },
  });

  console.log("✅ Plans created.");

  // ---------------------------------------------------------------------------
  // 3) COMPANY + MEMBERS
  // ---------------------------------------------------------------------------

  // Company 1: Full plan (2 concurrent IN_PROGRESS)
  const company = await prisma.company.create({
    data: {
      name: "Acme Studio",
      slug: "acme-studio",
      planId: fullPlan.id,
      website: "https://acme-studio.com",
      tokenBalance: 120, // demo amaçlı başlangıç bakiye
      autoAssignDefaultEnabled: true, // Demo company: auto-assign ON by default
      onboardingCompletedAt: new Date(), // Pre-seeded company — onboarding already done
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

  // 3b) SECOND DEMO COMPANY (auto-assign OFF by default, Basic plan)
  // ---------------------------------------------------------------------------

  const company2 = await prisma.company.create({
    data: {
      name: "Acme Studio (Manual Assign)",
      slug: "acme-studio-manual",
      planId: basicPlan.id,
      website: "https://acme-manual.com",
      tokenBalance: 80, // biraz daha düşük demo bakiye
      autoAssignDefaultEnabled: false, // burada auto-assign kapalı
      onboardingCompletedAt: new Date(), // Pre-seeded company — onboarding already done
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
      id: crypto.randomUUID(),
      companyId: company.id,
      name: "Website revamp",
      code: "ACME-WEB",
    },
  });

  const onboardingProject = await prisma.project.create({
    data: {
      id: crypto.randomUUID(),
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
  // 5b) TAGS (company-scoped labels for tickets)
  // ---------------------------------------------------------------------------

  const tagBranding = await prisma.ticketTag.create({
    data: { name: "Branding", color: "ORANGE", companyId: company.id },
  });
  const tagSocialMedia = await prisma.ticketTag.create({
    data: { name: "Social media", color: "BLUE", companyId: company.id },
  });
  const tagUrgent = await prisma.ticketTag.create({
    data: { name: "Urgent", color: "RED", companyId: company.id },
  });
  const tagWebsite = await prisma.ticketTag.create({
    data: { name: "Website", color: "GREEN", companyId: company.id },
  });
  const tagPrint = await prisma.ticketTag.create({
    data: { name: "Print", color: "PURPLE", companyId: company.id },
  });

  console.log("✅ Tags created.");

  // ---------------------------------------------------------------------------
  // 6) TICKETS
  // ---------------------------------------------------------------------------

  // Helper: date N days from now (positive = future, negative = past)
  const daysFromNow = (n) => new Date(Date.now() + n * 86400000);

  const ticket1 = await prisma.ticket.create({
    data: {
      title: "Landing hero redesign",
      description:
        "Update hero section to match new brand colours and layout.",
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      dueDate: daysFromNow(5),
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
      dueDate: daysFromNow(-3),
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
      dueDate: daysFromNow(12),
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
      dueDate: daysFromNow(25),
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
  // 6b) TAG ASSIGNMENTS
  // ---------------------------------------------------------------------------

  await prisma.ticketTagAssignment.createMany({
    data: [
      { ticketId: ticket1.id, tagId: tagWebsite.id },
      { ticketId: ticket1.id, tagId: tagBranding.id },
      { ticketId: ticket2.id, tagId: tagWebsite.id },
      { ticketId: ticket3.id, tagId: tagBranding.id },
      { ticketId: ticket3.id, tagId: tagUrgent.id },
      { ticketId: ticket4.id, tagId: tagSocialMedia.id },
    ],
  });

  console.log("✅ Tag assignments created.");

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

  // ---------------------------------------------------------------------------
  // 8) HELP CENTER — Categories & Articles
  // ---------------------------------------------------------------------------

  const helpCatGettingStarted = await prisma.helpCategory.create({
    data: {
      name: "Getting Started",
      slug: "getting-started",
      description: "Everything you need to get up and running with BrandBite.",
      icon: "\u{1F680}",
      sortOrder: 0,
      targetRole: HelpTargetRole.ALL,
    },
  });

  const helpCatHowItWorks = await prisma.helpCategory.create({
    data: {
      name: "How It Works",
      slug: "how-it-works",
      description: "Understand the design request lifecycle and revision process.",
      icon: "\u{1F4A1}",
      sortOrder: 1,
      targetRole: HelpTargetRole.ALL,
    },
  });

  const helpCatTokensBilling = await prisma.helpCategory.create({
    data: {
      name: "Tokens & Billing",
      slug: "tokens-billing",
      description: "Learn about token plans, billing, and subscription management.",
      icon: "\u{1F4B3}",
      sortOrder: 2,
      targetRole: HelpTargetRole.CUSTOMER,
    },
  });

  const helpCatPayouts = await prisma.helpCategory.create({
    data: {
      name: "Payouts & Earnings",
      slug: "payouts-earnings",
      description: "Track your earnings, request withdrawals, and understand payout tiers.",
      icon: "\u{1F4B0}",
      sortOrder: 3,
      targetRole: HelpTargetRole.DESIGNER,
    },
  });

  const helpCatAccount = await prisma.helpCategory.create({
    data: {
      name: "Account & Settings",
      slug: "account-settings",
      description: "Manage your profile, team members, and notification preferences.",
      icon: "\u{2699}\u{FE0F}",
      sortOrder: 4,
      targetRole: HelpTargetRole.ALL,
    },
  });

  const helpCatFaq = await prisma.helpCategory.create({
    data: {
      name: "FAQ & Troubleshooting",
      slug: "faq-troubleshooting",
      description: "Answers to common questions and solutions to known issues.",
      icon: "\u{2753}",
      sortOrder: 5,
      targetRole: HelpTargetRole.ALL,
    },
  });

  // --- Articles ---

  await prisma.helpArticle.createMany({
    data: [
      // Getting Started
      {
        title: "Creating your first design request",
        slug: "creating-your-first-design-request",
        excerpt: "A step-by-step guide to submitting your first ticket on BrandBite.",
        content:
          "<h2>Submit your first request</h2><p>Navigate to <strong>Tickets &rarr; New Request</strong> from your dashboard. Fill in the title, description, and select a job type from the catalog.</p><h3>Attaching files</h3><p>You can upload reference images, brand guidelines, or any supporting files to help the designer understand your vision.</p><h3>Setting priority and due date</h3><p>Choose a priority level and an optional due date. Higher priority tickets are picked up sooner by designers.</p>",
        categoryId: helpCatGettingStarted.id,
        targetRole: HelpTargetRole.CUSTOMER,
        sortOrder: 0,
      },
      {
        title: "Understanding your dashboard",
        slug: "understanding-your-dashboard",
        excerpt: "An overview of what you see when you first log in.",
        content:
          "<h2>Dashboard overview</h2><p>Your dashboard shows a summary of active tickets, token balance, and recent activity. Use the navigation bar at the top to switch between sections.</p><h3>Key sections</h3><ul><li><strong>Overview</strong> \u2014 Quick stats and recent tickets</li><li><strong>Board</strong> \u2014 Kanban view of all your tickets</li><li><strong>Tickets</strong> \u2014 Full list with filtering and search</li><li><strong>Tokens</strong> \u2014 Your token balance and transaction history</li></ul>",
        categoryId: helpCatGettingStarted.id,
        targetRole: HelpTargetRole.ALL,
        sortOrder: 1,
      },
      {
        title: "Navigating the board view",
        slug: "navigating-the-board-view",
        excerpt: "Learn how to use the Kanban board to track your design requests.",
        content:
          "<h2>The Kanban board</h2><p>The board organizes tickets into columns: <strong>To Do</strong>, <strong>In Progress</strong>, <strong>In Review</strong>, and <strong>Done</strong>. Drag tickets between columns or click on a ticket to view its details.</p><p>Use the project filter and tag filter at the top to narrow down what you see.</p>",
        categoryId: helpCatGettingStarted.id,
        targetRole: HelpTargetRole.ALL,
        sortOrder: 2,
      },

      // How It Works
      {
        title: "The design request lifecycle",
        slug: "the-design-request-lifecycle",
        excerpt: "Follow a ticket from creation to completion.",
        content:
          "<h2>Lifecycle stages</h2><p>Every design request goes through these stages:</p><ol><li><strong>To Do</strong> \u2014 The request has been created and is waiting for a designer.</li><li><strong>In Progress</strong> \u2014 A designer is actively working on it.</li><li><strong>In Review</strong> \u2014 The designer has submitted a revision for your feedback.</li><li><strong>Done</strong> \u2014 The request is complete and deliverables are ready to download.</li></ol><h3>What happens at each stage</h3><p>Tokens are deducted when a ticket moves to In Progress. The designer earns their payout when the ticket is marked Done.</p>",
        categoryId: helpCatHowItWorks.id,
        targetRole: HelpTargetRole.ALL,
        sortOrder: 0,
      },
      {
        title: "Working with revisions and feedback",
        slug: "working-with-revisions-and-feedback",
        excerpt: "How to review designs and provide pin-based feedback.",
        content:
          "<h2>Revision workflow</h2><p>When a designer submits a revision, you will see the uploaded deliverables on the ticket detail page.</p><h3>Pin feedback</h3><p>Click anywhere on a design image to drop a <strong>pin</strong>. Add a comment describing the change you need. The designer will see all your pins and can mark them as resolved as they work through the feedback.</p><h3>Approving a revision</h3><p>Once you are happy with the result, move the ticket to <strong>Done</strong> from the board or the ticket detail page.</p>",
        categoryId: helpCatHowItWorks.id,
        targetRole: HelpTargetRole.ALL,
        sortOrder: 1,
      },

      // Tokens & Billing (CUSTOMER)
      {
        title: "How tokens work",
        slug: "how-tokens-work",
        excerpt: "Understand the token-based pricing model.",
        content:
          "<h2>Token economy</h2><p>BrandBite uses a token-based system. Each subscription plan comes with a monthly token allowance. Different job types cost different amounts of tokens.</p><h3>Token deduction</h3><p>Tokens are deducted from your company balance when a ticket starts. The cost depends on the job type and quantity selected.</p><h3>Checking your balance</h3><p>Visit the <strong>Tokens</strong> page to see your current balance and full transaction history.</p>",
        categoryId: helpCatTokensBilling.id,
        targetRole: HelpTargetRole.CUSTOMER,
        sortOrder: 0,
      },
      {
        title: "Managing your subscription plan",
        slug: "managing-your-subscription-plan",
        excerpt: "Upgrade, downgrade, or cancel your plan.",
        content:
          "<h2>Subscription plans</h2><p>BrandBite offers three plans: <strong>Basic</strong>, <strong>Pro</strong>, and <strong>Full</strong>. Each plan includes a different number of monthly tokens and concurrent ticket slots.</p><h3>Changing your plan</h3><p>Contact your account manager or visit <strong>Settings &rarr; Plan</strong> to request a plan change. Changes take effect at the next billing cycle.</p>",
        categoryId: helpCatTokensBilling.id,
        targetRole: HelpTargetRole.CUSTOMER,
        sortOrder: 1,
      },

      // Payouts & Earnings (DESIGNER)
      {
        title: "How designer payouts work",
        slug: "how-designer-payouts-work",
        excerpt: "Learn how you earn tokens and get paid.",
        content:
          "<h2>Earning tokens</h2><p>You earn tokens each time a ticket you worked on is completed. The payout amount is set by the job type and is visible on the ticket detail page.</p><h3>Payout tiers</h3><p>BrandBite has a gamification system with milestone tiers. As you complete more tickets, you can unlock higher payout multipliers.</p>",
        categoryId: helpCatPayouts.id,
        targetRole: HelpTargetRole.DESIGNER,
        sortOrder: 0,
      },
      {
        title: "Requesting a withdrawal",
        slug: "requesting-a-withdrawal",
        excerpt: "How to withdraw your earned tokens.",
        content:
          "<h2>Withdrawals</h2><p>Visit the <strong>Withdrawals</strong> page from your navigation. Enter the number of tokens you want to withdraw and submit the request.</p><h3>Approval process</h3><p>An admin will review your withdrawal request. Once approved, the payout will be processed. You can track the status of your requests on the Withdrawals page.</p>",
        categoryId: helpCatPayouts.id,
        targetRole: HelpTargetRole.DESIGNER,
        sortOrder: 1,
      },

      // Account & Settings
      {
        title: "Updating your profile",
        slug: "updating-your-profile",
        excerpt: "Change your name, email, and other account details.",
        content:
          "<h2>Profile settings</h2><p>Go to <strong>Settings</strong> from the navigation bar. Here you can update your display name and manage notification preferences.</p>",
        categoryId: helpCatAccount.id,
        targetRole: HelpTargetRole.ALL,
        sortOrder: 0,
      },
      {
        title: "Managing team members",
        slug: "managing-team-members",
        excerpt: "Invite, remove, and manage roles for your team.",
        content:
          "<h2>Team management</h2><p>Company owners and PMs can invite new team members from the <strong>Members</strong> page. Each member can be assigned a role: Owner, PM, Billing, or Member.</p><h3>Inviting a member</h3><p>Click <strong>Invite Member</strong>, enter their email and select a role. They will receive an invitation link.</p><h3>Changing roles</h3><p>Click on a member to change their role. Only Owners can promote other members to Owner or PM.</p>",
        categoryId: helpCatAccount.id,
        targetRole: HelpTargetRole.CUSTOMER,
        sortOrder: 1,
      },

      // FAQ & Troubleshooting
      {
        title: "What file formats do you deliver?",
        slug: "what-file-formats-do-you-deliver",
        excerpt: "Supported output formats for design deliverables.",
        content:
          "<h2>Supported formats</h2><p>Designers deliver files in the formats most appropriate for the job type. Common formats include:</p><ul><li><strong>PNG</strong> \u2014 High-quality images with transparency</li><li><strong>JPG</strong> \u2014 Compressed images for web use</li><li><strong>SVG</strong> \u2014 Scalable vector graphics</li><li><strong>PDF</strong> \u2014 Print-ready documents</li></ul><p>If you need a specific format, mention it in the ticket description.</p>",
        categoryId: helpCatFaq.id,
        targetRole: HelpTargetRole.ALL,
        sortOrder: 0,
      },
      {
        title: "How do I contact support?",
        slug: "how-do-i-contact-support",
        excerpt: "Get in touch with the BrandBite team.",
        content:
          "<h2>Contact us</h2><p>If you cannot find an answer in the help center, reach out to us:</p><ul><li><strong>Email</strong> \u2014 support@brandbite.com</li><li><strong>In-app</strong> \u2014 Use the ticket comments to communicate with your designer or admin</li></ul><p>We aim to respond within 24 hours on business days.</p>",
        categoryId: helpCatFaq.id,
        targetRole: HelpTargetRole.ALL,
        sortOrder: 1,
      },
      {
        title: "My ticket is stuck in To Do",
        slug: "my-ticket-is-stuck-in-to-do",
        excerpt: "What to do if your request is not being picked up.",
        content:
          "<h2>Why is my ticket waiting?</h2><p>Tickets stay in <strong>To Do</strong> until a designer with matching skills is available. This can happen if:</p><ul><li>All designers are at capacity with other tickets</li><li>The job type requires specialized skills</li><li>Your plan has reached the concurrent ticket limit</li></ul><h3>What you can do</h3><p>Check your plan details to ensure you have not reached the maximum concurrent tickets. If the issue persists, contact support for assistance.</p>",
        categoryId: helpCatFaq.id,
        targetRole: HelpTargetRole.CUSTOMER,
        sortOrder: 2,
      },
    ],
  });

  console.log("✅ Help center categories & articles created.");
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
