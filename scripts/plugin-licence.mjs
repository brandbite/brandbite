// -----------------------------------------------------------------------------
// @file: scripts/plugin-licence.mjs
// @purpose: Issue licence keys and publish releases for the self-hosted
//           WordPress plugins, without opening a database GUI against
//           production and typing into tables by hand.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-09-01
//
//   node scripts/plugin-licence.mjs issue   --email x@y.com --sites 3
//   node scripts/plugin-licence.mjs release --version 1.0.0 --zip path/to.zip
//   node scripts/plugin-licence.mjs list
//   node scripts/plugin-licence.mjs revoke  --key BB-...
//
// Everything is a dry run until you add --yes. The plan is printed first,
// because this writes to the production database and uploads to the bucket
// customers download from, and "I did not realise it would do that" is not a
// thing anyone should discover afterwards.
//
// Reads DATABASE_URL and the R2_* vars from the environment. Point it at
// production with an env file:
//
//   node --env-file=../brandbite-prod.env scripts/plugin-licence.mjs list
// -----------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { randomBytes } from "node:crypto";
import { inflateRawSync } from "node:zlib";

import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

const DEFAULT_PRODUCT = "image-optimizer";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { _: [] };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }

  return args;
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(
      `${name} is not set.\n` +
        `  Point the script at an environment with:\n` +
        `    node --env-file=../brandbite-prod.env scripts/plugin-licence.mjs ...`,
    );
  }
  return value;
}

/** Which database this is about to touch, without printing the credentials. */
function describeDatabase() {
  const url = requireEnv("DATABASE_URL");
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

// ---------------------------------------------------------------------------
// issue — create a licence key
// ---------------------------------------------------------------------------

/**
 * Keys look like BB-1A2B-3C4D-5E6F-7G8H.
 *
 * Sixteen hex characters is 64 bits of randomness, which is far more than
 * enough given the endpoint is rate-limited to 20 guesses a minute per IP.
 * The shape matters more than the entropy: it is going to be read off an
 * invoice and typed into a WordPress field by a human being.
 */
function generateKey() {
  return (
    "BB-" +
    randomBytes(8)
      .toString("hex")
      .toUpperCase()
      .match(/.{1,4}/g)
      .join("-")
  );
}

async function issue(args) {
  const product = args.product ?? DEFAULT_PRODUCT;
  const sites = Number(args.sites ?? 1);
  const email = args.email ?? null;
  const note = args.note ?? null;
  const key = args.key ?? generateKey();

  if (!Number.isInteger(sites) || sites < 1) {
    fail("--sites must be a whole number, 1 or more.");
  }

  let expiresAt = null;
  if (args.expires && args.expires !== true) {
    expiresAt = new Date(`${args.expires}T23:59:59Z`);
    if (Number.isNaN(expiresAt.getTime())) {
      fail("--expires must be a date like 2027-09-01, or left off for a perpetual key.");
    }
  }

  console.log("\n  Issue a licence key");
  console.log("  ────────────────────────────────────────────────");
  console.log(`  database   ${describeDatabase()}`);
  console.log(`  product    ${product}`);
  console.log(`  key        ${key}`);
  console.log(`  sites      ${sites}`);
  console.log(`  email      ${email ?? "(none)"}`);
  console.log(`  note       ${note ?? "(none)"}`);
  console.log(`  expires    ${expiresAt ? expiresAt.toISOString().slice(0, 10) : "never"}`);

  if (!args.yes) {
    console.log("\n  Dry run. Add --yes to actually create it.\n");
    return;
  }

  const existing = await prisma.pluginLicence.findUnique({ where: { key } });
  if (existing) {
    fail(`That key already exists (issued ${existing.createdAt.toISOString().slice(0, 10)}).`);
  }

  await prisma.pluginLicence.create({
    data: { key, product, email, note, siteLimit: sites, expiresAt },
  });

  console.log("\n  Created.\n");
  console.log(`  Give the customer this key:  ${key}`);
  console.log(
    `  Or set it in wp-config.php:  define( 'BRANDBITE_IMAGES_LICENCE_KEY', '${key}' );\n`,
  );
}

// ---------------------------------------------------------------------------
// release — upload the zip and publish a version
// ---------------------------------------------------------------------------

/**
 * The version in the zip's plugin header is the authority.
 *
 * If the database says 1.1.0 and the file inside says 1.0.0, WordPress offers
 * an update that installs and then still reports the old version — an update
 * loop that looks like a broken plugin. Reading it out of the zip and refusing
 * a mismatch is cheaper than diagnosing that later.
 */
function versionInsideZip(zipPath) {
  // The plugin file is deflated inside the archive, so searching the raw bytes
  // for "Version:" finds nothing — an earlier draft did exactly that and the
  // check silently never fired, which is worse than not having it. This walks
  // the central directory properly and inflates the one entry it needs.
  try {
    const buf = readFileSync(zipPath);

    // End of central directory: fixed 22 bytes unless there is a comment, so
    // scan back from the end for its signature.
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd === -1) return null;

    const entryCount = buf.readUInt16LE(eocd + 10);
    let offset = buf.readUInt32LE(eocd + 16);

    for (let n = 0; n < entryCount; n++) {
      if (buf.readUInt32LE(offset) !== 0x02014b50) return null;

      const method = buf.readUInt16LE(offset + 10);
      const compressedSize = buf.readUInt32LE(offset + 20);
      const nameLength = buf.readUInt16LE(offset + 28);
      const extraLength = buf.readUInt16LE(offset + 30);
      const commentLength = buf.readUInt16LE(offset + 32);
      const localOffset = buf.readUInt32LE(offset + 42);
      const name = buf.toString("utf8", offset + 46, offset + 46 + nameLength);

      // The main plugin file: one folder deep, and named after its folder.
      // brandbite-image-optimizer/brandbite-image-optimizer.php
      const parts = name.split("/");
      const isMain = parts.length === 2 && parts[1] === `${parts[0]}.php`;

      if (isMain) {
        // Sizes in the local header can be zeroed when a data descriptor is
        // used, so take them from the central directory and only read the
        // local header for its variable-length fields.
        const localNameLength = buf.readUInt16LE(localOffset + 26);
        const localExtraLength = buf.readUInt16LE(localOffset + 28);
        const start = localOffset + 30 + localNameLength + localExtraLength;
        const raw = buf.subarray(start, start + compressedSize);

        const contents = method === 0 ? raw : inflateRawSync(raw);
        const match = contents.toString("utf8").match(/^\s*\*\s*Version:\s*(\S+)/m);

        return match ? match[1] : null;
      }

      offset += 46 + nameLength + extraLength + commentLength;
    }

    return null;
  } catch {
    return null;
  }
}

async function release(args) {
  const product = args.product ?? DEFAULT_PRODUCT;
  const version = args.version;
  const zip = args.zip;

  if (!version || version === true) fail("--version is required, e.g. --version 1.0.0");
  if (!zip || zip === true) fail("--zip is required, e.g. --zip ../brandbite/plugins/dist/x.zip");

  let bytes;
  try {
    bytes = readFileSync(zip);
  } catch {
    fail(`Cannot read ${zip}`);
  }

  const declared = versionInsideZip(zip);
  if (declared && declared !== version) {
    fail(
      `The zip says version ${declared} but --version is ${version}.\n` +
        `  These must match exactly or WordPress offers an update that never applies.`,
    );
  }

  const key = args.key && args.key !== true ? args.key : `plugins/${basename(zip)}`;
  const publish = args.draft ? false : true;

  console.log("\n  Publish a release");
  console.log("  ────────────────────────────────────────────────");
  console.log(`  database    ${describeDatabase()}`);
  console.log(`  bucket      ${process.env.R2_BUCKET ?? "(R2_BUCKET unset)"}`);
  console.log(`  product     ${product}`);
  console.log(
    `  version     ${version}${declared ? "  (matches the zip)" : "  (zip header unread)"}`,
  );
  console.log(`  file        ${zip}  ${(bytes.length / 1024).toFixed(1)} KB`);
  console.log(`  storage key ${key}`);
  console.log(`  published   ${publish}`);

  if (!args.yes) {
    console.log("\n  Dry run. Add --yes to upload and publish.\n");
    return;
  }

  requireEnv("R2_BUCKET");
  requireEnv("R2_ENDPOINT");
  requireEnv("R2_ACCESS_KEY_ID");
  requireEnv("R2_SECRET_ACCESS_KEY");

  const r2 = new S3Client({
    region: process.env.R2_REGION ?? "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  console.log("\n  Uploading…");
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: "application/zip",
    }),
  );

  // Read it back. An upload that silently went to the wrong bucket or was
  // rejected by a policy is otherwise only discovered by the first customer
  // who tries to update.
  const head = await r2.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
  if (head.ContentLength !== bytes.length) {
    fail(`Uploaded ${bytes.length} bytes but the bucket reports ${head.ContentLength}.`);
  }
  console.log(`  Verified in the bucket: ${head.ContentLength} bytes.`);

  await prisma.pluginRelease.upsert({
    where: { product_version: { product, version } },
    create: {
      product,
      version,
      packageKey: key,
      requiresWp: args.requires ?? "5.8",
      requiresPhp: args["requires-php"] ?? "7.2",
      testedWp: args.tested ?? "",
      description: args.description ?? "",
      changelog: args.changelog ?? "",
      published: publish,
    },
    update: { packageKey: key, published: publish },
  });

  console.log("\n  Published.\n");
  console.log("  Check it is being offered:");
  console.log(
    `    curl -s "https://brandbite.studio/api/plugins/${product}/version?key=&site=https://example.com"\n`,
  );
}

// ---------------------------------------------------------------------------
// list — what exists right now
// ---------------------------------------------------------------------------

async function list() {
  console.log(`\n  ${describeDatabase()}\n`);

  const licences = await prisma.pluginLicence.findMany({
    include: { sites: true },
    orderBy: { createdAt: "desc" },
  });

  console.log("  Licences");
  console.log("  ────────────────────────────────────────────────");
  if (licences.length === 0) {
    console.log("  (none yet)");
  }
  for (const licence of licences) {
    const state = licence.revokedAt
      ? "REVOKED"
      : licence.expiresAt && licence.expiresAt < new Date()
        ? "EXPIRED"
        : "active";
    console.log(
      `  ${licence.key}  ${state}  ${licence.sites.length}/${licence.siteLimit} sites  ${licence.email ?? ""}`,
    );
    for (const site of licence.sites) {
      console.log(
        `      ${site.site}  v${site.version || "?"}  last seen ${site.lastSeenAt.toISOString().slice(0, 10)}`,
      );
    }
    if (licence.note) console.log(`      note: ${licence.note}`);
  }

  const releases = await prisma.pluginRelease.findMany({ orderBy: { releasedAt: "desc" } });

  console.log("\n  Releases");
  console.log("  ────────────────────────────────────────────────");
  if (releases.length === 0) {
    console.log("  (none yet — /version returns 404 until one is published)");
  }
  for (const r of releases) {
    console.log(
      `  ${r.product} ${r.version}  ${r.published ? "published" : "draft"}  ${r.packageKey}`,
    );
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// revoke — stop a key working
// ---------------------------------------------------------------------------

async function revoke(args) {
  const key = args.key;
  if (!key || key === true) fail("--key is required.");

  const licence = await prisma.pluginLicence.findUnique({
    where: { key },
    include: { sites: true },
  });
  if (!licence) fail(`No such key: ${key}`);

  console.log("\n  Revoke a licence key");
  console.log("  ────────────────────────────────────────────────");
  console.log(`  database   ${describeDatabase()}`);
  console.log(`  key        ${licence.key}`);
  console.log(`  email      ${licence.email ?? "(none)"}`);
  console.log(`  in use on  ${licence.sites.length} site(s)`);
  console.log(
    "\n  Those sites keep serving every image they have already converted —\n" +
      "  revoking only stops new conversions. Nothing on them will break.",
  );

  if (!args.yes) {
    console.log("\n  Dry run. Add --yes to revoke.\n");
    return;
  }

  await prisma.pluginLicence.update({
    where: { key },
    data: { revokedAt: new Date() },
  });

  console.log("\n  Revoked. Sites stop converting on their next check, within a day.\n");
}

// ---------------------------------------------------------------------------

const USAGE = `
  Brandbite plugin licences

    node scripts/plugin-licence.mjs list
    node scripts/plugin-licence.mjs issue   --email a@b.com --sites 3 [--expires 2027-09-01] [--note "..."] --yes
    node scripts/plugin-licence.mjs release --version 1.0.0 --zip path/to.zip [--tested 6.9] [--draft] --yes
    node scripts/plugin-licence.mjs revoke  --key BB-... --yes

  Nothing is written without --yes; without it you get the plan and nothing else.

  Point it at production with an env file:

    node --env-file=../brandbite-prod.env scripts/plugin-licence.mjs list
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  try {
    switch (command) {
      case "issue":
        await issue(args);
        break;
      case "release":
        await release(args);
        break;
      case "list":
        await list();
        break;
      case "revoke":
        await revoke(args);
        break;
      default:
        console.log(USAGE);
        process.exitCode = command ? 1 : 0;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\n ", err.message ?? err, "\n");
  process.exit(1);
});
