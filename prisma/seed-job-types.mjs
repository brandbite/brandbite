// -----------------------------------------------------------------------------
// @file: prisma/seed-job-types.mjs
// @purpose: Seed all Brandbite services as job types with token costs and
//           designer payouts. Idempotent — safe to run multiple times.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-02-19
// -----------------------------------------------------------------------------
//
// Pricing model:
//   1 token ≈ 1 estimated hour ≈ $35
//   Designer payout = 60% of token cost (rounded to nearest integer)
//   Brandbite margin = 40%
//
// Usage:
//   npx tsx prisma/seed-job-types.mjs
// -----------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Service definitions — grouped by category
// ---------------------------------------------------------------------------

const SERVICES = [
  // ── Brand Strategy & Creative Direction ──────────────────────────────────
  { name: "Brand Strategy Deck – Simple", desc: "Brand Strategy & Creative Direction — archetype overview, light tone of voice, 1 persona, short competitor scan, 10–15 page deck", tokens: 18, payout: 11 },
  { name: "Brand Strategy Deck – Detailed", desc: "Brand Strategy & Creative Direction — full archetype system, full tone of voice guide, 2–3 detailed personas, extended competitor audit, opportunity mapping, 25–30 page deck", tokens: 30, payout: 18 },
  { name: "Brand Archetype Development", desc: "Brand Strategy & Creative Direction", tokens: 5, payout: 3 },
  { name: "Tone of Voice Framework", desc: "Brand Strategy & Creative Direction", tokens: 5, payout: 3 },
  { name: "Target Audience & Personas", desc: "Brand Strategy & Creative Direction", tokens: 10, payout: 6 },
  { name: "Competitor & Category Analysis", desc: "Brand Strategy & Creative Direction", tokens: 12, payout: 7 },
  { name: "Moodboards", desc: "Brand Strategy & Creative Direction", tokens: 5, payout: 3 },

  // ── Copywriting & Creative Writing ───────────────────────────────────────
  { name: "Slogan Development", desc: "Copywriting & Creative Writing", tokens: 5, payout: 3 },
  { name: "Press Release Writing", desc: "Copywriting & Creative Writing", tokens: 5, payout: 3 },
  { name: "Thought Leadership Article (350-400 words)", desc: "Copywriting & Creative Writing", tokens: 9, payout: 5 },
  { name: "Research-Based Article (350-400 words)", desc: "Copywriting & Creative Writing", tokens: 14, payout: 8 },
  { name: "Storytelling / Brand Narrative", desc: "Copywriting & Creative Writing", tokens: 6, payout: 4 },
  { name: "Website Copy (per page)", desc: "Copywriting & Creative Writing", tokens: 4, payout: 2 },
  { name: "Landing Page Copy", desc: "Copywriting & Creative Writing", tokens: 7, payout: 4 },
  { name: "Email Copy (per email)", desc: "Copywriting & Creative Writing", tokens: 3, payout: 2 },
  { name: "Ad Copy Set (FB/Google)", desc: "Copywriting & Creative Writing", tokens: 2, payout: 1 },
  { name: "Video Script", desc: "Copywriting & Creative Writing", tokens: 8, payout: 5 },

  // ── Visual Design & Brand Identity ───────────────────────────────────────
  { name: "Logo Design", desc: "Visual Design & Brand Identity", tokens: 16, payout: 10 },
  { name: "Brand ID Guide (20-30 pages)", desc: "Visual Design & Brand Identity", tokens: 30, payout: 18 },
  { name: "Business Card", desc: "Visual Design & Brand Identity", tokens: 2, payout: 1 },
  { name: "Brochure (6-8 pages)", desc: "Visual Design & Brand Identity", tokens: 12, payout: 7 },
  { name: "Presentation Deck (with copywriting, up to 20 slides)", desc: "Visual Design & Brand Identity", tokens: 28, payout: 17 },
  { name: "Presentation Deck (without copywriting, up to 20 slides)", desc: "Visual Design & Brand Identity", tokens: 18, payout: 11 },
  { name: "Upgrading existing presentation (up to 20 slides)", desc: "Visual Design & Brand Identity", tokens: 12, payout: 7 },
  { name: "Adding animation to existing presentation (up to 20 slides)", desc: "Visual Design & Brand Identity", tokens: 10, payout: 6 },
  { name: "Pitchdeck (without copywriting)", desc: "Visual Design & Brand Identity", tokens: 18, payout: 11 },
  { name: "Catalogue (20-40 pages)", desc: "Visual Design & Brand Identity", tokens: 24, payout: 14 },
  { name: "Packaging / Label – Single", desc: "Visual Design & Brand Identity", tokens: 5, payout: 3 },
  { name: "Packaging System", desc: "Visual Design & Brand Identity", tokens: 15, payout: 9 },
  { name: "Social Media Template Set", desc: "Visual Design & Brand Identity", tokens: 8, payout: 5 },
  { name: "Social Media Post (per design)", desc: "Visual Design & Brand Identity", tokens: 2, payout: 1 },
  { name: "Static Banner Set (6 sizes)", desc: "Visual Design & Brand Identity", tokens: 5, payout: 3 },
  { name: "HTML5 Banner Set", desc: "Visual Design & Brand Identity", tokens: 10, payout: 6 },
  { name: "Poster", desc: "Visual Design & Brand Identity", tokens: 8, payout: 5 },
  { name: "Roll-up Banner, photo backdrop etc.", desc: "Visual Design & Brand Identity", tokens: 4, payout: 2 },

  // ── Digital Content & Marketing ──────────────────────────────────────────
  { name: "Social Media Strategy", desc: "Digital Content & Marketing", tokens: 12, payout: 7 },
  { name: "Single Social Media Copywriting (Standard Post)", desc: "Digital Content & Marketing", tokens: 1, payout: 1 },
  { name: "Single Social Media Copywriting (LinkedIn – research-based)", desc: "Digital Content & Marketing", tokens: 2, payout: 1 },
  { name: "Static Post Design (single image)", desc: "Digital Content & Marketing", tokens: 2, payout: 1 },
  { name: "Carousel Post Design (up to 10 visuals)", desc: "Digital Content & Marketing", tokens: 8, payout: 5 },
  { name: "Carousel Post Design (up to 20 visuals)", desc: "Digital Content & Marketing", tokens: 12, payout: 7 },
  { name: "Motion Graphic Reel (up to 30 sec)", desc: "Digital Content & Marketing", tokens: 18, payout: 11 },
  { name: "SEO Blog Article (350-400 words)", desc: "Digital Content & Marketing", tokens: 9, payout: 5 },
  { name: "Influencer Campaign Concepting", desc: "Digital Content & Marketing", tokens: 10, payout: 6 },
  { name: "Landing Page Copywriting", desc: "Digital Content & Marketing", tokens: 7, payout: 4 },

  // ── Video & Motion Production ────────────────────────────────────────────
  { name: "Short-Form Motion Video (10-30 sec)", desc: "Video & Motion Production", tokens: 18, payout: 11 },
  { name: "Motion Explainer (30-45 sec)", desc: "Video & Motion Production", tokens: 24, payout: 14 },
  { name: "AI Video Production (including script writing)", desc: "Video & Motion Production", tokens: 18, payout: 11 },
  { name: "AI Video Production (without script)", desc: "Video & Motion Production", tokens: 12, payout: 7 },
];

// Demo job types to deactivate
const DEMO_JOB_TYPES = [
  "Landing hero redesign",
  "Pricing page visuals",
  "Onboarding illustration set",
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🚀 Seeding Brandbite services as job types...\n");

  // Step 1: Deactivate demo job types
  for (const name of DEMO_JOB_TYPES) {
    const existing = await prisma.jobType.findFirst({ where: { name } });
    if (existing) {
      await prisma.jobType.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
      console.log(`  ⏸  Deactivated demo job type: "${name}"`);
    }
  }

  console.log("");

  // Step 2: Create or update real services
  let created = 0;
  let updated = 0;

  for (const svc of SERVICES) {
    const existing = await prisma.jobType.findFirst({
      where: { name: svc.name },
    });

    if (existing) {
      await prisma.jobType.update({
        where: { id: existing.id },
        data: {
          description: svc.desc,
          tokenCost: svc.tokens,
          designerPayoutTokens: svc.payout,
          isActive: true,
        },
      });
      updated++;
      console.log(`  ✏️  Updated: "${svc.name}" (${svc.tokens} tokens, ${svc.payout} payout)`);
    } else {
      await prisma.jobType.create({
        data: {
          name: svc.name,
          description: svc.desc,
          tokenCost: svc.tokens,
          designerPayoutTokens: svc.payout,
          isActive: true,
        },
      });
      created++;
      console.log(`  ✅ Created: "${svc.name}" (${svc.tokens} tokens, ${svc.payout} payout)`);
    }
  }

  console.log(`\n🎉 Done! Created ${created}, updated ${updated} job types (${SERVICES.length} total).`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
