-- CreateEnum: lifecycle status for a public talent application. SUBMITTED is
-- the only status written by the public form; IN_REVIEW / ACCEPTED / DECLINED
-- become reachable when the SITE_OWNER admin queue lands in PR2.
CREATE TYPE "TalentApplicationStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'DECLINED');

-- CreateTable: anonymous talent application captured by the public form at
-- /talent. Multi-value fields (categoryIds, socialLinks, workedWith, tools)
-- are JSONB arrays — admin list filters never query against them, and the
-- cardinality is small enough that join tables would be over-engineered.
CREATE TABLE "TalentApplication" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "portfolioUrl" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "socialLinks" JSONB NOT NULL DEFAULT '[]',
    "categoryIds" JSONB NOT NULL DEFAULT '[]',
    "totalYears" TEXT NOT NULL,
    "hasRemoteExp" BOOLEAN NOT NULL,
    "yearsRemote" TEXT,
    "workedWith" JSONB NOT NULL DEFAULT '[]',
    "workload" TEXT NOT NULL,
    "preferredTasksPerWeek" TEXT,
    "turnaroundOk" BOOLEAN NOT NULL,
    "turnaroundComment" TEXT NOT NULL DEFAULT '',
    "tools" JSONB NOT NULL DEFAULT '[]',
    "toolsOther" TEXT,
    "testTaskOk" BOOLEAN NOT NULL,
    "communicationConfirmed" BOOLEAN NOT NULL,
    "status" "TalentApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: admin queue default sort (newest unsubmitted-status first).
CREATE INDEX "TalentApplication_status_createdAt_idx" ON "TalentApplication"("status", "createdAt" DESC);

-- CreateIndex: PR2 admin "show prior submissions from this email" lookup.
-- Email is intentionally NOT @unique — see model comment in schema.prisma.
CREATE INDEX "TalentApplication_email_idx" ON "TalentApplication"("email");
