-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SITE_OWNER', 'SITE_ADMIN', 'DESIGNER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('OWNER', 'PM', 'BILLING', 'MEMBER');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'PM', 'CONTRIBUTOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "AutoAssignMode" AS ENUM ('INHERIT', 'ON', 'OFF');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REVISION_SUBMITTED', 'FEEDBACK_SUBMITTED', 'TICKET_COMPLETED', 'TICKET_ASSIGNED', 'TICKET_STATUS_CHANGED', 'PIN_RESOLVED');

-- CreateEnum
CREATE TYPE "CmsStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "TicketCreativeMode" AS ENUM ('DESIGNER', 'AI');

-- CreateEnum
CREATE TYPE "AiGenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiToolType" AS ENUM ('IMAGE_GENERATION', 'BACKGROUND_REMOVAL', 'TEXT_GENERATION', 'DESIGN_SUGGESTION', 'BRIEF_PARSING', 'UPSCALE_IMAGE');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('BRIEF_INPUT', 'OUTPUT_IMAGE');

-- CreateEnum
CREATE TYPE "PinStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TagColor" AS ENUM ('GRAY', 'BLUE', 'GREEN', 'ORANGE', 'RED', 'PURPLE', 'PINK', 'YELLOW');

-- CreateEnum
CREATE TYPE "MoodboardItemType" AS ENUM ('NOTE', 'IMAGE', 'COLOR', 'LINK', 'FILE', 'TODO', 'EMBED', 'DRAWING');

-- CreateEnum
CREATE TYPE "DocAudience" AS ENUM ('CREATIVE', 'CUSTOMER', 'GENERAL');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "UserAccount" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "designerRevisionNotesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "pausedAt" TIMESTAMP(3),
    "pauseExpiresAt" TIMESTAMP(3),
    "pauseType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT,
    "planId" TEXT,
    "autoAssignDefaultEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "billingStatus" "BillingStatus",
    "tokenBalance" INTEGER NOT NULL DEFAULT 0,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleInCompany" "CompanyRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInvite" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "roleInCompany" "CompanyRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "monthlyTokens" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "maxConcurrentInProgressTickets" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "autoAssignMode" "AutoAssignMode" NOT NULL DEFAULT 'INHERIT',
    "brandLogoUrl" TEXT,
    "brandColors" TEXT,
    "brandFonts" TEXT,
    "brandVoice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'CONTRIBUTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTypeCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTypeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "categoryId" TEXT,
    "description" TEXT,
    "tokenCost" INTEGER NOT NULL,
    "designerPayoutTokens" INTEGER NOT NULL,
    "estimatedHours" INTEGER,
    "hasQuantity" BOOLEAN NOT NULL DEFAULT false,
    "quantityLabel" TEXT,
    "defaultQuantity" INTEGER NOT NULL DEFAULT 1,
    "aiPromptTemplate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignerSkill" (
    "id" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "jobTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignerSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutputSizePreset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "jobTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'px',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutputSizePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketOutputSpec" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketOutputSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "creativeMode" "TicketCreativeMode" NOT NULL DEFAULT 'DESIGNER',
    "dueDate" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdById" TEXT NOT NULL,
    "designerId" TEXT,
    "jobTypeId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "tokenCostOverride" INTEGER,
    "designerPayoutOverride" INTEGER,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "companyTicketNumber" INTEGER,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTimeEntry" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeRating" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "ratedByUserId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" "TagColor" NOT NULL DEFAULT 'GRAY',
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTagAssignment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketRevision" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "submittedByDesignerId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "designerMessage" TEXT,
    "feedbackByCustomerId" TEXT,
    "feedbackAt" TIMESTAMP(3),
    "feedbackMessage" TEXT,
    "aiGenerationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "revisionId" TEXT,
    "kind" "AssetKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPin" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT,
    "status" "PinStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPinComment" (
    "id" TEXT NOT NULL,
    "pinId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetPinComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenLedger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "ticketId" TEXT,
    "userId" TEXT,
    "direction" "LedgerDirection" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "balanceBefore" INTEGER,
    "balanceAfter" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "amountTokens" INTEGER NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ticketId" TEXT,
    "actorId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PayoutRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minCompletedTickets" INTEGER NOT NULL,
    "timeWindowDays" INTEGER NOT NULL,
    "payoutPercent" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAssignmentLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "designerId" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAssignmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowcaseWork" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subtitle" TEXT,
    "clientName" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "thumbnailStorageKey" TEXT,
    "thumbnailUrl" TEXT,
    "heroStorageKey" TEXT,
    "heroUrl" TEXT,
    "galleryImages" JSONB,
    "description" TEXT,
    "status" "CmsStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowcaseWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "authorName" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "thumbnailStorageKey" TEXT,
    "thumbnailUrl" TEXT,
    "heroStorageKey" TEXT,
    "heroUrl" TEXT,
    "body" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "status" "CmsStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPage" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "heroStorageKey" TEXT,
    "heroUrl" TEXT,
    "body" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "authorName" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "thumbnailStorageKey" TEXT,
    "thumbnailUrl" TEXT,
    "heroStorageKey" TEXT,
    "heroUrl" TEXT,
    "body" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "status" "CmsStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocCategory" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "audience" "DocAudience" NOT NULL DEFAULT 'GENERAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT,
    "categoryId" TEXT NOT NULL,
    "authorName" TEXT,
    "status" "CmsStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGeneration" (
    "id" TEXT NOT NULL,
    "toolType" "AiToolType" NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ticketId" TEXT,
    "prompt" TEXT NOT NULL,
    "inputParams" JSONB,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AiGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT,
    "outputText" TEXT,
    "outputImageUrl" TEXT,
    "outputParams" JSONB,
    "tokenCost" INTEGER NOT NULL DEFAULT 0,
    "providerCost" JSONB,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiToolConfig" (
    "id" TEXT NOT NULL,
    "toolType" "AiToolType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tokenCost" INTEGER NOT NULL DEFAULT 1,
    "rateLimit" INTEGER NOT NULL DEFAULT 20,
    "config" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiToolConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moodboard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "ticketId" TEXT,
    "createdById" TEXT NOT NULL,
    "connections" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Moodboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoodboardItem" (
    "id" TEXT NOT NULL,
    "moodboardId" TEXT NOT NULL,
    "type" "MoodboardItemType" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "colSpan" INTEGER NOT NULL DEFAULT 1,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 280,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoodboardItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "preferredTimes" JSONB,
    "timezone" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "videoLink" TEXT,
    "adminNotes" TEXT,
    "googleEventId" TEXT,
    "tokenCost" INTEGER NOT NULL,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationSettings" (
    "id" TEXT NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tokenCost" INTEGER NOT NULL DEFAULT 50,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "contactEmail" TEXT,
    "calendarIcsUrl" TEXT,
    "workingDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "workingHourStart" INTEGER NOT NULL DEFAULT 9,
    "workingHourEnd" INTEGER NOT NULL DEFAULT 17,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "maxBookingDays" INTEGER NOT NULL DEFAULT 30,
    "companyTimezone" TEXT,
    "adminNotes" TEXT,
    "googleAccountEmail" TEXT,
    "googleCalendarId" TEXT DEFAULT 'primary',
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "googleTokenExpiresAt" TIMESTAMP(3),
    "googleConnectedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ConsultationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_authUserId_key" ON "UserAccount"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Company_stripeCustomerId_key" ON "Company"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_stripeSubscriptionId_key" ON "Company"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_companyId_userId_key" ON "CompanyMember"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInvite_token_key" ON "CompanyInvite"("token");

-- CreateIndex
CREATE INDEX "CompanyInvite_companyId_idx" ON "CompanyInvite"("companyId");

-- CreateIndex
CREATE INDEX "CompanyInvite_email_idx" ON "CompanyInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_stripeProductId_key" ON "Plan"("stripeProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_stripePriceId_key" ON "Plan"("stripePriceId");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_companyId_code_key" ON "Project"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "JobTypeCategory_name_key" ON "JobTypeCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "JobTypeCategory_slug_key" ON "JobTypeCategory"("slug");

-- CreateIndex
CREATE INDEX "JobType_categoryId_idx" ON "JobType"("categoryId");

-- CreateIndex
CREATE INDEX "DesignerSkill_designerId_idx" ON "DesignerSkill"("designerId");

-- CreateIndex
CREATE INDEX "DesignerSkill_jobTypeId_idx" ON "DesignerSkill"("jobTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignerSkill_designerId_jobTypeId_key" ON "DesignerSkill"("designerId", "jobTypeId");

-- CreateIndex
CREATE INDEX "OutputSizePreset_jobTypeId_isActive_sortOrder_idx" ON "OutputSizePreset"("jobTypeId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OutputSizePreset_companyId_jobTypeId_key_key" ON "OutputSizePreset"("companyId", "jobTypeId", "key");

-- CreateIndex
CREATE INDEX "TicketOutputSpec_ticketId_idx" ON "TicketOutputSpec"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketOutputSpec_ticketId_presetId_key" ON "TicketOutputSpec"("ticketId", "presetId");

-- CreateIndex
CREATE INDEX "Ticket_designerId_status_updatedAt_idx" ON "Ticket"("designerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "TicketTimeEntry_ticketId_startedAt_idx" ON "TicketTimeEntry"("ticketId", "startedAt");

-- CreateIndex
CREATE INDEX "TicketTimeEntry_creativeId_endedAt_idx" ON "TicketTimeEntry"("creativeId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeRating_ticketId_key" ON "CreativeRating"("ticketId");

-- CreateIndex
CREATE INDEX "CreativeRating_creativeId_createdAt_idx" ON "CreativeRating"("creativeId", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeRating_companyId_createdAt_idx" ON "CreativeRating"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketTag_companyId_idx" ON "TicketTag"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTag_companyId_name_key" ON "TicketTag"("companyId", "name");

-- CreateIndex
CREATE INDEX "TicketTagAssignment_ticketId_idx" ON "TicketTagAssignment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketTagAssignment_tagId_idx" ON "TicketTagAssignment"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTagAssignment_ticketId_tagId_key" ON "TicketTagAssignment"("ticketId", "tagId");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketComment_authorId_idx" ON "TicketComment"("authorId");

-- CreateIndex
CREATE INDEX "TicketRevision_ticketId_version_idx" ON "TicketRevision"("ticketId", "version");

-- CreateIndex
CREATE INDEX "TicketRevision_submittedByDesignerId_submittedAt_idx" ON "TicketRevision"("submittedByDesignerId", "submittedAt");

-- CreateIndex
CREATE INDEX "TicketRevision_feedbackByCustomerId_feedbackAt_idx" ON "TicketRevision"("feedbackByCustomerId", "feedbackAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketRevision_ticketId_version_key" ON "TicketRevision"("ticketId", "version");

-- CreateIndex
CREATE INDEX "Asset_ticketId_kind_createdAt_idx" ON "Asset"("ticketId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "Asset_revisionId_idx" ON "Asset"("revisionId");

-- CreateIndex
CREATE INDEX "Asset_createdById_createdAt_idx" ON "Asset"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "AssetPin_assetId_status_idx" ON "AssetPin"("assetId", "status");

-- CreateIndex
CREATE INDEX "AssetPin_createdById_createdAt_idx" ON "AssetPin"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssetPin_assetId_order_key" ON "AssetPin"("assetId", "order");

-- CreateIndex
CREATE INDEX "AssetPinComment_pinId_createdAt_idx" ON "AssetPinComment"("pinId", "createdAt");

-- CreateIndex
CREATE INDEX "AssetPinComment_authorId_createdAt_idx" ON "AssetPinComment"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenLedger_companyId_createdAt_idx" ON "TokenLedger"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenLedger_userId_createdAt_idx" ON "TokenLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenLedger_ticketId_createdAt_idx" ON "TokenLedger"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Withdrawal_designerId_createdAt_idx" ON "Withdrawal"("designerId", "createdAt");

-- CreateIndex
CREATE INDEX "Withdrawal_status_createdAt_idx" ON "Withdrawal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_type_key" ON "NotificationPreference"("userId", "type");

-- CreateIndex
CREATE INDEX "PayoutRule_isActive_payoutPercent_idx" ON "PayoutRule"("isActive", "payoutPercent");

-- CreateIndex
CREATE INDEX "TicketAssignmentLog_ticketId_createdAt_idx" ON "TicketAssignmentLog"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketAssignmentLog_designerId_createdAt_idx" ON "TicketAssignmentLog"("designerId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketAssignmentLog_reason_createdAt_idx" ON "TicketAssignmentLog"("reason", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShowcaseWork_slug_key" ON "ShowcaseWork"("slug");

-- CreateIndex
CREATE INDEX "ShowcaseWork_status_sortOrder_idx" ON "ShowcaseWork"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPage_pageKey_key" ON "CmsPage"("pageKey");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_slug_key" ON "NewsArticle"("slug");

-- CreateIndex
CREATE INDEX "NewsArticle_status_publishedAt_idx" ON "NewsArticle"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocCategory_slug_key" ON "DocCategory"("slug");

-- CreateIndex
CREATE INDEX "DocCategory_audience_sortOrder_idx" ON "DocCategory"("audience", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DocArticle_slug_key" ON "DocArticle"("slug");

-- CreateIndex
CREATE INDEX "DocArticle_categoryId_status_sortOrder_idx" ON "DocArticle"("categoryId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "DocArticle_status_publishedAt_idx" ON "DocArticle"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiGeneration_idempotencyKey_key" ON "AiGeneration"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AiGeneration_userId_createdAt_idx" ON "AiGeneration"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiGeneration_companyId_createdAt_idx" ON "AiGeneration"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AiGeneration_ticketId_createdAt_idx" ON "AiGeneration"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "AiGeneration_toolType_status_idx" ON "AiGeneration"("toolType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiToolConfig_toolType_key" ON "AiToolConfig"("toolType");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "Moodboard_companyId_createdAt_idx" ON "Moodboard"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Moodboard_projectId_idx" ON "Moodboard"("projectId");

-- CreateIndex
CREATE INDEX "Moodboard_ticketId_idx" ON "Moodboard"("ticketId");

-- CreateIndex
CREATE INDEX "MoodboardItem_moodboardId_position_idx" ON "MoodboardItem"("moodboardId", "position");

-- CreateIndex
CREATE INDEX "Consultation_companyId_createdAt_idx" ON "Consultation"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Consultation_status_createdAt_idx" ON "Consultation"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationSettings_singleton_key" ON "ConsultationSettings"("singleton");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvite" ADD CONSTRAINT "CompanyInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvite" ADD CONSTRAINT "CompanyInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobType" ADD CONSTRAINT "JobType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "JobTypeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignerSkill" ADD CONSTRAINT "DesignerSkill_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignerSkill" ADD CONSTRAINT "DesignerSkill_jobTypeId_fkey" FOREIGN KEY ("jobTypeId") REFERENCES "JobType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutputSizePreset" ADD CONSTRAINT "OutputSizePreset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutputSizePreset" ADD CONSTRAINT "OutputSizePreset_jobTypeId_fkey" FOREIGN KEY ("jobTypeId") REFERENCES "JobType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOutputSpec" ADD CONSTRAINT "TicketOutputSpec_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOutputSpec" ADD CONSTRAINT "TicketOutputSpec_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "OutputSizePreset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_jobTypeId_fkey" FOREIGN KEY ("jobTypeId") REFERENCES "JobType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTimeEntry" ADD CONSTRAINT "TicketTimeEntry_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTimeEntry" ADD CONSTRAINT "TicketTimeEntry_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeRating" ADD CONSTRAINT "CreativeRating_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeRating" ADD CONSTRAINT "CreativeRating_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeRating" ADD CONSTRAINT "CreativeRating_ratedByUserId_fkey" FOREIGN KEY ("ratedByUserId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeRating" ADD CONSTRAINT "CreativeRating_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTag" ADD CONSTRAINT "TicketTag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTagAssignment" ADD CONSTRAINT "TicketTagAssignment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTagAssignment" ADD CONSTRAINT "TicketTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "TicketTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRevision" ADD CONSTRAINT "TicketRevision_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRevision" ADD CONSTRAINT "TicketRevision_submittedByDesignerId_fkey" FOREIGN KEY ("submittedByDesignerId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRevision" ADD CONSTRAINT "TicketRevision_feedbackByCustomerId_fkey" FOREIGN KEY ("feedbackByCustomerId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRevision" ADD CONSTRAINT "TicketRevision_aiGenerationId_fkey" FOREIGN KEY ("aiGenerationId") REFERENCES "AiGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "TicketRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPin" ADD CONSTRAINT "AssetPin_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPin" ADD CONSTRAINT "AssetPin_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPin" ADD CONSTRAINT "AssetPin_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPinComment" ADD CONSTRAINT "AssetPinComment_pinId_fkey" FOREIGN KEY ("pinId") REFERENCES "AssetPin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPinComment" ADD CONSTRAINT "AssetPinComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenLedger" ADD CONSTRAINT "TokenLedger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenLedger" ADD CONSTRAINT "TokenLedger_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenLedger" ADD CONSTRAINT "TokenLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignmentLog" ADD CONSTRAINT "TicketAssignmentLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignmentLog" ADD CONSTRAINT "TicketAssignmentLog_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocArticle" ADD CONSTRAINT "DocArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moodboard" ADD CONSTRAINT "Moodboard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moodboard" ADD CONSTRAINT "Moodboard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moodboard" ADD CONSTRAINT "Moodboard_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moodboard" ADD CONSTRAINT "Moodboard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodboardItem" ADD CONSTRAINT "MoodboardItem_moodboardId_fkey" FOREIGN KEY ("moodboardId") REFERENCES "Moodboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodboardItem" ADD CONSTRAINT "MoodboardItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSettings" ADD CONSTRAINT "ConsultationSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

