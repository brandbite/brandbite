-- Adds an optional, unique idempotency key to AiGeneration so that a client
-- retry of an AI call (same UUID in the Idempotency-Key header) returns the
-- existing row and does not debit tokens a second time.

-- AlterTable
ALTER TABLE "AiGeneration" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AiGeneration_idempotencyKey_key" ON "AiGeneration"("idempotencyKey");
