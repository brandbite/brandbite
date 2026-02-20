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
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Brandbite demo data...");

  // ---------------------------------------------------------------------------
  // 0) TEMİZLİK
  // ---------------------------------------------------------------------------
  // Not: Bu kısım dev DB için. Tüm kayıtlari siliyor.
  // Production’da kullanılmamalı.

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
  await prisma.designerSkill.deleteMany({});

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
      tokenBalance: 200, // demo amaçlı başlangıç bakiye
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
  // 5) JOB TYPES — Full service catalog from brandbite services spreadsheet
  // Token formula: tokenCost = estimatedHours, designerPayout ≈ 65% (rounded)
  // ---------------------------------------------------------------------------

  const JOB_TYPE_DATA = [
    // ── Brand Strategy & Creative Direction ──
    { name: "Brand Strategy Deck – Simple", category: "Brand Strategy & Creative Direction", description: "Archetype overview, light tone of voice, 1 persona, short competitor scan, 10-15 page deck", estimatedHours: 18, tokenCost: 18, designerPayoutTokens: 12 },
    { name: "Brand Strategy Deck – Detailed", category: "Brand Strategy & Creative Direction", description: "Full archetype system, full tone of voice guide, 2-3 detailed personas, extended competitor audit, opportunity mapping, 25-30 page deck", estimatedHours: 30, tokenCost: 30, designerPayoutTokens: 20 },
    { name: "Brand Archetype Development", category: "Brand Strategy & Creative Direction", description: "Define brand archetype and personality framework", estimatedHours: 5, tokenCost: 5, designerPayoutTokens: 3 },
    { name: "Tone of Voice Framework", category: "Brand Strategy & Creative Direction", description: "Comprehensive tone of voice guidelines", estimatedHours: 5, tokenCost: 5, designerPayoutTokens: 3 },
    { name: "Target Audience & Personas", category: "Brand Strategy & Creative Direction", description: "Audience research and persona development", estimatedHours: 10, tokenCost: 10, designerPayoutTokens: 7 },
    { name: "Competitor & Category Analysis", category: "Brand Strategy & Creative Direction", description: "In-depth competitive landscape analysis", estimatedHours: 12, tokenCost: 12, designerPayoutTokens: 8 },
    { name: "Moodboards", category: "Brand Strategy & Creative Direction", description: "Visual direction and mood exploration boards", estimatedHours: 5, tokenCost: 5, designerPayoutTokens: 3 },

    // ── Copywriting & Creative Writing ──
    { name: "Slogan Development", category: "Copywriting & Creative Writing", description: "Brand slogan creation and refinement", estimatedHours: 5, tokenCost: 5, designerPayoutTokens: 3 },
    { name: "Press Release Writing", category: "Copywriting & Creative Writing", description: "Professional press release drafting", estimatedHours: 5, tokenCost: 5, designerPayoutTokens: 3 },
    { name: "Thought Leadership Article", category: "Copywriting & Creative Writing", description: "350-400 words thought leadership content", estimatedHours: 9, tokenCost: 9, designerPayoutTokens: 6 },
    { name: "Research-Based Article", category: "Copywriting & Creative Writing", description: "350-400 words research-backed article", estimatedHours: 14, tokenCost: 14, designerPayoutTokens: 9 },
    { name: "Storytelling / Brand Narrative", category: "Copywriting & Creative Writing", description: "Brand story and narrative development", estimatedHours: 6, tokenCost: 6, designerPayoutTokens: 4 },
    { name: "Website Copy", category: "Copywriting & Creative Writing", description: "Website copy per page", estimatedHours: 4, tokenCost: 4, designerPayoutTokens: 3, hasQuantity: true, quantityLabel: "Number of pages", defaultQuantity: 1 },
    { name: "Landing Page Copy", category: "Copywriting & Creative Writing", description: "Conversion-focused landing page copy", estimatedHours: 7, tokenCost: 7, designerPayoutTokens: 5 },
    { name: "Email Copy", category: "Copywriting & Creative Writing", description: "Email copywriting per email", estimatedHours: 3, tokenCost: 3, designerPayoutTokens: 2, hasQuantity: true, quantityLabel: "Number of emails", defaultQuantity: 1 },
    { name: "Ad Copy Set (FB/Google)", category: "Copywriting & Creative Writing", description: "Facebook or Google ad copy set", estimatedHours: 2, tokenCost: 2, designerPayoutTokens: 1 },
    { name: "Video Script", category: "Copywriting & Creative Writing", description: "Script writing for video content", estimatedHours: 8, tokenCost: 8, designerPayoutTokens: 5 },

    // ── Visual Design & Brand Identity ──
    { name: "Logo Design", category: "Visual Design & Brand Identity", description: "Full logo design process", estimatedHours: 16, tokenCost: 16, designerPayoutTokens: 10 },
    { name: "Brand ID Guide", category: "Visual Design & Brand Identity", description: "Comprehensive brand identity guide, 20-30 pages", estimatedHours: 30, tokenCost: 30, designerPayoutTokens: 20 },
    { name: "Business Card", category: "Visual Design & Brand Identity", description: "Business card design", estimatedHours: 2, tokenCost: 2, designerPayoutTokens: 1 },
    { name: "Brochure", category: "Visual Design & Brand Identity", description: "Brochure design, 6-8 pages", estimatedHours: 12, tokenCost: 12, designerPayoutTokens: 8 },
    { name: "Presentation Deck (With Copywriting)", category: "Visual Design & Brand Identity", description: "Presentation deck with copywriting, no animation, up to 20 slides", estimatedHours: 28, tokenCost: 28, designerPayoutTokens: 18 },
    { name: "Presentation Deck (Without Copywriting)", category: "Visual Design & Brand Identity", description: "Presentation deck without copywriting, no animation, up to 20 slides", estimatedHours: 18, tokenCost: 18, designerPayoutTokens: 12 },
    { name: "Upgrading Existing Presentation", category: "Visual Design & Brand Identity", description: "Refresh existing presentation, no animation, up to 20 slides", estimatedHours: 12, tokenCost: 12, designerPayoutTokens: 8 },
    { name: "Adding Animation to Presentation", category: "Visual Design & Brand Identity", description: "Add animation to existing presentation, up to 20 slides", estimatedHours: 10, tokenCost: 10, designerPayoutTokens: 7 },
    { name: "Pitchdeck (Without Copywriting)", category: "Visual Design & Brand Identity", description: "Pitch deck design without copy", estimatedHours: 18, tokenCost: 18, designerPayoutTokens: 12 },
    { name: "Catalogue", category: "Visual Design & Brand Identity", description: "Product catalogue design, 20-40 pages", estimatedHours: 24, tokenCost: 24, designerPayoutTokens: 16 },
    { name: "Packaging / Label – Single", category: "Visual Design & Brand Identity", description: "Single packaging or label design", estimatedHours: 5, tokenCost: 5, designerPayoutTokens: 3, hasQuantity: true, quantityLabel: "Number of items", defaultQuantity: 1 },
    { name: "Packaging System", category: "Visual Design & Brand Identity", description: "Complete packaging system design", estimatedHours: 15, tokenCost: 15, designerPayoutTokens: 10 },
    { name: "Social Media Template Set", category: "Visual Design & Brand Identity", description: "Reusable social media template system", estimatedHours: 8, tokenCost: 8, designerPayoutTokens: 5 },
    { name: "Social Media Post", category: "Visual Design & Brand Identity", description: "Single social media post design", estimatedHours: 2, tokenCost: 2, designerPayoutTokens: 1, hasQuantity: true, quantityLabel: "Number of designs", defaultQuantity: 1 },
    { name: "Static Banner Set", category: "Visual Design & Brand Identity", description: "Static display banner set", estimatedHours: 5, tokenCost: 5, designerPayoutTokens: 3, hasQuantity: true, quantityLabel: "Number of sizes", defaultQuantity: 6 },
    { name: "HTML5 Banner Set", category: "Visual Design & Brand Identity", description: "Animated HTML5 display banner set", estimatedHours: 10, tokenCost: 10, designerPayoutTokens: 7 },
    { name: "Poster", category: "Visual Design & Brand Identity", description: "Poster design", estimatedHours: 8, tokenCost: 8, designerPayoutTokens: 5 },
    { name: "Roll-up Banner / Photo Backdrop", category: "Visual Design & Brand Identity", description: "Roll-up banner, photo backdrop or similar large format", estimatedHours: 4, tokenCost: 4, designerPayoutTokens: 3 },

    // ── Digital Content & Marketing ──
    { name: "Social Media Strategy", category: "Digital Content & Marketing", description: "Social media strategy and planning", estimatedHours: 12, tokenCost: 12, designerPayoutTokens: 8 },
    { name: "Single Social Media Copywriting (Standard)", category: "Digital Content & Marketing", description: "Standard social media post copy", estimatedHours: 1, tokenCost: 1, designerPayoutTokens: 1, hasQuantity: true, quantityLabel: "Number of posts", defaultQuantity: 1 },
    { name: "Single Social Media Copywriting (LinkedIn)", category: "Digital Content & Marketing", description: "LinkedIn research-based post copy", estimatedHours: 2, tokenCost: 2, designerPayoutTokens: 1 },
    { name: "Static Post Design", category: "Digital Content & Marketing", description: "Single static image post design", estimatedHours: 2, tokenCost: 2, designerPayoutTokens: 1, hasQuantity: true, quantityLabel: "Number of designs", defaultQuantity: 1 },
    { name: "Carousel Post Design (up to 10 visuals)", category: "Digital Content & Marketing", description: "Carousel post with up to 10 visual slides", estimatedHours: 8, tokenCost: 8, designerPayoutTokens: 5 },
    { name: "Carousel Post Design (up to 20 visuals)", category: "Digital Content & Marketing", description: "Carousel post with up to 20 visual slides", estimatedHours: 12, tokenCost: 12, designerPayoutTokens: 8 },
    { name: "Motion Graphic Reel", category: "Digital Content & Marketing", description: "Motion graphic reel, up to 30 seconds", estimatedHours: 18, tokenCost: 18, designerPayoutTokens: 12 },
    { name: "SEO Blog Article", category: "Digital Content & Marketing", description: "SEO-optimized blog article, 350-400 words", estimatedHours: 9, tokenCost: 9, designerPayoutTokens: 6 },
    { name: "Influencer Campaign Concepting", category: "Digital Content & Marketing", description: "Influencer campaign concept and planning", estimatedHours: 10, tokenCost: 10, designerPayoutTokens: 7 },
    { name: "Landing Page Copywriting", category: "Digital Content & Marketing", description: "Conversion-focused landing page copy", estimatedHours: 7, tokenCost: 7, designerPayoutTokens: 5 },

    // ── Video & Motion Production ──
    { name: "Short-Form Motion Video", category: "Video & Motion Production", description: "Short-form motion video, 10-30 seconds", estimatedHours: 18, tokenCost: 18, designerPayoutTokens: 12 },
    { name: "Motion Explainer", category: "Video & Motion Production", description: "Motion explainer video, 30-45 seconds", estimatedHours: 24, tokenCost: 24, designerPayoutTokens: 16 },
    { name: "AI Video Production (Including Script)", category: "Video & Motion Production", description: "AI-assisted video production with script writing", estimatedHours: 18, tokenCost: 18, designerPayoutTokens: 12 },
    { name: "AI Video Production (Without Script)", category: "Video & Motion Production", description: "AI-assisted video production without script", estimatedHours: 12, tokenCost: 12, designerPayoutTokens: 8 },
  ];

  // Bulk-create all job types
  const createdJobTypes = [];
  for (const jt of JOB_TYPE_DATA) {
    const created = await prisma.jobType.create({
      data: {
        name: jt.name,
        category: jt.category,
        description: jt.description,
        estimatedHours: jt.estimatedHours,
        tokenCost: jt.tokenCost,
        designerPayoutTokens: jt.designerPayoutTokens,
        hasQuantity: jt.hasQuantity ?? false,
        quantityLabel: jt.quantityLabel ?? null,
        defaultQuantity: jt.defaultQuantity ?? 1,
      },
    });
    createdJobTypes.push({ ...created, _seedName: jt.name });
  }

  // Helper to find created job type by name
  const findJob = (name) => createdJobTypes.find((j) => j._seedName === name);

  // References for tickets and skills
  const jobLogoDesign = findJob("Logo Design");
  const jobBrandIdGuide = findJob("Brand ID Guide");
  const jobSocialMediaPost = findJob("Social Media Post");
  const jobPresentationDeck = findJob("Presentation Deck (Without Copywriting)");
  const jobBrochure = findJob("Brochure");
  const jobMotionExplainer = findJob("Motion Explainer");
  const jobCarousel10 = findJob("Carousel Post Design (up to 10 visuals)");
  const jobLandingPageCopy = findJob("Landing Page Copy");

  console.log(`✅ ${createdJobTypes.length} JobTypes created.`);

  // ---------------------------------------------------------------------------
  // 5a) DESIGNER SKILLS
  // ---------------------------------------------------------------------------

  // Ada: Visual Design specialist + some copywriting
  // Liam: Digital Content & Motion specialist
  const adaSkillJobs = createdJobTypes.filter((j) =>
    ["Visual Design & Brand Identity", "Brand Strategy & Creative Direction"].includes(j.category)
  );
  const liamSkillJobs = createdJobTypes.filter((j) =>
    ["Digital Content & Marketing", "Video & Motion Production"].includes(j.category)
  );
  // Both overlap on Copywriting
  const copywritingJobs = createdJobTypes.filter((j) =>
    j.category === "Copywriting & Creative Writing"
  );

  await prisma.designerSkill.createMany({
    data: [
      ...adaSkillJobs.map((j) => ({ designerId: designerAda.id, jobTypeId: j.id })),
      ...copywritingJobs.map((j) => ({ designerId: designerAda.id, jobTypeId: j.id })),
      ...liamSkillJobs.map((j) => ({ designerId: designerLiam.id, jobTypeId: j.id })),
      ...copywritingJobs.map((j) => ({ designerId: designerLiam.id, jobTypeId: j.id })),
    ],
  });

  console.log("✅ Designer skills seeded.");

  // ---------------------------------------------------------------------------
  // 5a) DESIGNER SKILLS
  // ---------------------------------------------------------------------------

  await prisma.designerSkill.createMany({
    data: [
      { designerId: designerAda.id, jobTypeId: jobLandingHero.id },
      { designerId: designerAda.id, jobTypeId: jobPricingVisuals.id },
      { designerId: designerLiam.id, jobTypeId: jobPricingVisuals.id },
      { designerId: designerLiam.id, jobTypeId: jobOnboarding.id },
    ],
  });

  console.log("✅ Designer skills seeded.");

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
      title: "Logo redesign for homepage",
      description:
        "Update logo to match new brand identity and color scheme.",
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      dueDate: daysFromNow(5),
      companyId: company.id,
      projectId: websiteProject.id,
      createdById: customerPM.id,
      designerId: designerAda.id,
      jobTypeId: jobLogoDesign.id,
      companyTicketNumber: 101,
    },
  });

  const ticket2 = await prisma.ticket.create({
    data: {
      title: "Social media carousel post",
      description:
        "Create a 10-slide carousel post for product launch.",
      status: TicketStatus.TODO,
      priority: TicketPriority.MEDIUM,
      dueDate: daysFromNow(-3),
      companyId: company.id,
      projectId: websiteProject.id,
      createdById: customerOwner.id,
      designerId: designerLiam.id,
      jobTypeId: jobCarousel10.id,
      companyTicketNumber: 102,
    },
  });

  const ticket3 = await prisma.ticket.create({
    data: {
      title: "Motion explainer for onboarding",
      description:
        "Create a 30-45 second motion explainer video for the onboarding flow.",
      status: TicketStatus.IN_REVIEW,
      priority: TicketPriority.HIGH,
      dueDate: daysFromNow(12),
      companyId: company.id,
      projectId: onboardingProject.id,
      createdById: customerOwner.id,
      designerId: designerLiam.id,
      jobTypeId: jobMotionExplainer.id,
      companyTicketNumber: 103,
    },
  });

  const ticket4 = await prisma.ticket.create({
    data: {
      title: "Product brochure design",
      description:
        "Design a 6-page product brochure for trade show materials.",
      status: TicketStatus.TODO,
      priority: TicketPriority.LOW,
      dueDate: daysFromNow(25),
      companyId: company.id,
      projectId: onboardingProject.id,
      createdById: customerPM.id,
      designerId: designerAda.id,
      jobTypeId: jobBrochure.id,
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
        amount: jobLogoDesign.tokenCost,
        reason: "JOB_STARTED",
        notes: "Logo redesign started",
        metadata: {
          jobTypeId: jobLogoDesign.id,
        },
        balanceBefore: 150,
        balanceAfter: 150 - jobLogoDesign.tokenCost,
      },
      {
        companyId: company.id,
        ticketId: ticket3.id,
        direction: LedgerDirection.DEBIT,
        amount: jobMotionExplainer.tokenCost,
        reason: "JOB_STARTED",
        notes: "Motion explainer started",
        metadata: {
          jobTypeId: jobMotionExplainer.id,
        },
        balanceBefore: 150 - jobLogoDesign.tokenCost,
        balanceAfter: 150 - jobLogoDesign.tokenCost - jobMotionExplainer.tokenCost,
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
        amount: jobLogoDesign.designerPayoutTokens,
        reason: "JOB_COMPLETED",
        notes: "Payout for logo redesign",
        metadata: {
          ticketId: ticket1.id,
        },
      },
      {
        userId: designerLiam.id,
        ticketId: ticket3.id,
        direction: LedgerDirection.CREDIT,
        amount: jobMotionExplainer.designerPayoutTokens,
        reason: "JOB_IN_REVIEW",
        notes:
          "Partial payout for motion explainer (in review).",
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
