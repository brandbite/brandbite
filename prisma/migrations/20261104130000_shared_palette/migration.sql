-- Color Studio: read-only snapshots behind public palette links. New table only.
CREATE TABLE "SharedPalette" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "colors"    JSONB        NOT NULL,
    "roles"     JSONB        NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedPalette_pkey" PRIMARY KEY ("id")
);
