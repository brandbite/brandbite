-- Per-job-type AI prompt template. Optional — when set, spliced into the
-- image-generation prompt so each job type produces tuned output
-- (e.g. "For logos: emphasize simplicity, recognizable at small sizes").
ALTER TABLE "JobType" ADD COLUMN "aiPromptTemplate" TEXT;
