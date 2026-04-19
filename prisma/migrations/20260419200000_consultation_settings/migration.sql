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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ConsultationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationSettings_singleton_key" ON "ConsultationSettings"("singleton");

-- AddForeignKey
ALTER TABLE "ConsultationSettings" ADD CONSTRAINT "ConsultationSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the singleton row with defaults (id uses random UUID-ish text)
INSERT INTO "ConsultationSettings" ("id", "singleton", "updatedAt")
VALUES (
    'cns_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20),
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;
