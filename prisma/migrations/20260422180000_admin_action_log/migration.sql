-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM (
    'WITHDRAWAL_APPROVE',
    'WITHDRAWAL_MARK_PAID',
    'WITHDRAWAL_REJECT',
    'PLAN_CREATE',
    'PLAN_EDIT',
    'PLAN_DELETE',
    'PLAN_ASSIGN',
    'COMPANY_TOKEN_GRANT',
    'PAYOUT_RULE_EDIT',
    'TICKET_FINANCIAL_OVERRIDE',
    'USER_PROMOTE_TO_ADMIN',
    'USER_HARD_DELETE',
    'AI_PRICING_EDIT',
    'CONSULTATION_PRICING_EDIT',
    'GOOGLE_OAUTH_CONFIG_EDIT'
);

-- CreateEnum
CREATE TYPE "AdminActionOutcome" AS ENUM (
    'SUCCESS',
    'BLOCKED',
    'ERROR'
);

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "action" "AdminActionType" NOT NULL,
    "metadata" JSONB,
    "targetType" TEXT,
    "targetId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "outcome" "AdminActionOutcome" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminActionLog_actorId_createdAt_idx" ON "AdminActionLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActionLog_action_createdAt_idx" ON "AdminActionLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActionLog_targetType_targetId_createdAt_idx" ON "AdminActionLog"("targetType", "targetId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminActionLog" ADD CONSTRAINT "AdminActionLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
