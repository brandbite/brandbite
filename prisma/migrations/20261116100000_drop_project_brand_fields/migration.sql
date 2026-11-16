-- The older per-project brand fields (colors, fonts, voice, logo link) gave
-- way to the brand guide. Before they go, whatever a customer typed there is
-- carried into the company's default brand, wherever the guide is still empty.
-- Same reading rules the app used: the oldest project that has a value wins.
-- The logo link has no place in the guide (logos are uploaded files) and goes.

-- 1. A company with older values but no brand guide yet gets one.
INSERT INTO "Brand" ("id", "companyId", "name", "isDefault", "updatedAt")
SELECT 'brand_' || md5(c."id" || clock_timestamp()::text),
       c."id",
       left(c."name", 80),
       true,
       CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (
        SELECT 1 FROM "Brand" b WHERE b."companyId" = c."id" AND b."isDefault"
      )
  AND EXISTS (
        SELECT 1 FROM "Project" p
        WHERE p."companyId" = c."id"
          AND (btrim(coalesce(p."brandColors", ''), E' \t\r\n') <> ''
            OR btrim(coalesce(p."brandFonts", ''), E' \t\r\n') <> ''
            OR btrim(coalesce(p."brandVoice", ''), E' \t\r\n') <> '')
      );

-- 2. Colors: "#ff6600, #1E293B" -> [{ "id": "color-0", "hex": "#ff6600" }, ...]
WITH source AS (
  SELECT DISTINCT ON (p."companyId") p."companyId", p."brandColors" AS raw
  FROM "Project" p
  WHERE btrim(coalesce(p."brandColors", ''), E' \t\r\n') <> ''
  ORDER BY p."companyId", p."createdAt" ASC
),
parts AS (
  SELECT s."companyId", t.ord, lower(regexp_replace(t.part, '^#', '')) AS body
  FROM source s,
       regexp_split_to_table(s.raw, '[,;\s]+') WITH ORDINALITY AS t(part, ord)
  WHERE t.part ~ '^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'
),
hexes AS (
  SELECT "companyId",
         ord,
         '#' || CASE WHEN length(body) = 3
                     THEN regexp_replace(body, '(.)', '\1\1', 'g')
                     ELSE body END AS hex
  FROM parts
),
firsts AS (
  SELECT "companyId", hex, min(ord) AS ord FROM hexes GROUP BY "companyId", hex
),
numbered AS (
  SELECT "companyId", hex,
         row_number() OVER (PARTITION BY "companyId" ORDER BY ord) - 1 AS n
  FROM firsts
),
packed AS (
  SELECT "companyId",
         jsonb_agg(jsonb_build_object('id', 'color-' || n, 'hex', hex) ORDER BY n) AS colors
  FROM numbered
  WHERE n < 24
  GROUP BY "companyId"
)
UPDATE "Brand" b
SET "colors" = packed.colors
FROM packed
WHERE b."companyId" = packed."companyId"
  AND b."isDefault"
  AND b."colors" = '[]'::jsonb;

-- 3. Fonts: "Inter, Source Serif 4" -> [{ "id": "font-0", "name": "Inter" }, ...]
WITH source AS (
  SELECT DISTINCT ON (p."companyId") p."companyId", p."brandFonts" AS raw
  FROM "Project" p
  WHERE btrim(coalesce(p."brandFonts", ''), E' \t\r\n') <> ''
  ORDER BY p."companyId", p."createdAt" ASC
),
parts AS (
  SELECT s."companyId", t.ord, left(btrim(t.part, E' \t\r\n'), 80) AS name
  FROM source s,
       regexp_split_to_table(s.raw, '[,;\n]+') WITH ORDINALITY AS t(part, ord)
),
firsts AS (
  SELECT "companyId", name, min(ord) AS ord
  FROM parts
  WHERE name <> ''
  GROUP BY "companyId", name
),
numbered AS (
  SELECT "companyId", name,
         row_number() OVER (PARTITION BY "companyId" ORDER BY ord) - 1 AS n
  FROM firsts
),
packed AS (
  SELECT "companyId",
         jsonb_agg(jsonb_build_object('id', 'font-' || n, 'name', name) ORDER BY n) AS fonts
  FROM numbered
  WHERE n < 12
  GROUP BY "companyId"
)
UPDATE "Brand" b
SET "fonts" = packed.fonts
FROM packed
WHERE b."companyId" = packed."companyId"
  AND b."isDefault"
  AND b."fonts" = '[]'::jsonb;

-- 4. Voice notes, as typed.
WITH source AS (
  SELECT DISTINCT ON (p."companyId") p."companyId",
         left(btrim(p."brandVoice", E' \t\r\n'), 2000) AS voice
  FROM "Project" p
  WHERE btrim(coalesce(p."brandVoice", ''), E' \t\r\n') <> ''
  ORDER BY p."companyId", p."createdAt" ASC
)
UPDATE "Brand" b
SET "voiceNotes" = source.voice
FROM source
WHERE b."companyId" = source."companyId"
  AND b."isDefault"
  AND btrim(coalesce(b."voiceNotes", ''), E' \t\r\n') = '';

-- 5. The older fields go.
ALTER TABLE "Project"
  DROP COLUMN "brandLogoUrl",
  DROP COLUMN "brandColors",
  DROP COLUMN "brandFonts",
  DROP COLUMN "brandVoice";
