-- WordPress plugin licences (Brandbite Image Optimizer and anything after it).
--
-- Self-hosted plugin installs are not users of this app: no account, no
-- session, often no Company. They authenticate to /api/plugins/* with a key
-- and nothing else, which is what these three tables hold.
--
-- PluginLicenceSite.site is stored normalised (host + path, no scheme, no
-- "www.", no trailing slash) by lib/plugin-licence.ts. The compound unique on
-- (licenceId, site) is what the activate route upserts against, so a site
-- re-activating never consumes a second seat.

-- CreateTable
CREATE TABLE "PluginLicence" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "email" TEXT,
    "note" TEXT,
    "siteLimit" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginLicence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginLicenceSite" (
    "id" TEXT NOT NULL,
    "licenceId" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluginLicenceSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginRelease" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "packageKey" TEXT NOT NULL,
    "requiresWp" TEXT NOT NULL DEFAULT '5.8',
    "requiresPhp" TEXT NOT NULL DEFAULT '7.2',
    "testedWp" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "changelog" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PluginLicence_key_key" ON "PluginLicence"("key");

-- CreateIndex
CREATE INDEX "PluginLicence_product_idx" ON "PluginLicence"("product");

-- CreateIndex
CREATE INDEX "PluginLicence_email_idx" ON "PluginLicence"("email");

-- CreateIndex
CREATE INDEX "PluginLicenceSite_site_idx" ON "PluginLicenceSite"("site");

-- CreateIndex
CREATE UNIQUE INDEX "PluginLicenceSite_licenceId_site_key" ON "PluginLicenceSite"("licenceId", "site");

-- CreateIndex
CREATE INDEX "PluginRelease_product_releasedAt_idx" ON "PluginRelease"("product", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PluginRelease_product_version_key" ON "PluginRelease"("product", "version");

-- AddForeignKey
ALTER TABLE "PluginLicenceSite" ADD CONSTRAINT "PluginLicenceSite_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "PluginLicence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
