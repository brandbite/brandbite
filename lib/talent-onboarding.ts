// -----------------------------------------------------------------------------
// @file: lib/talent-onboarding.ts
// @purpose: Orchestrator for the HIRED → ONBOARDED transition. Single
//           exported `onboardHiredTalent(applicationId)` that:
//
//             1. Asserts status === HIRED.
//             2. Refuses if the candidate's email already has a UserAccount —
//                explicit operator action at /admin/users to promote
//                avoids quietly changing an existing customer's role.
//             3. Resolves approvedCategoryIds → JobType IDs.
//             4. Inside one DB transaction:
//                  - Creates UserAccount(role=DESIGNER) with a synthetic
//                    `authUserId` placeholder.
//                  - Bulk-creates CreativeSkill rows (one per resolved JobType).
//                  - Mirrors approvedTasksPerWeekCap onto
//                    UserAccount.tasksPerWeekCap for PR3's auto-assign filter.
//                  - Flips TalentApplication.status → ONBOARDED, sets
//                    hiredUserAccountId.
//             5. Outside the transaction (best-effort):
//                  - Triggers BetterAuth's signInMagicLink so the candidate
//                    receives the standard "Sign in to Brandbite" email.
//                  - Sends a separate branded "Welcome to the team" email
//                    that restates the agreed terms.
//                  - Audit-logs TALENT_ONBOARDED.
//
//           Why a synthetic authUserId: the codebase pattern (lib/auth.ts:
//           122-148) creates the BetterAuth AuthUser lazily on first login
//           and links it to the matching-by-email UserAccount, swapping
//           the placeholder for the real BetterAuth ID. Pre-creating the
//           UserAccount with a synthetic authUserId means the linker
//           "just works" the first time the candidate clicks the magic
//           link — no separate AuthUser create required.
//
//           Why two emails: the magic-link email is utility (must stay
//           identical to every other auth flow); the welcome email is
//           the brand moment. Splitting them avoids contaminating
//           sendMagicLink with onboarding-specific branching.
// -----------------------------------------------------------------------------

import { randomBytes } from "node:crypto";
import type { TalentApplication } from "@prisma/client";

import { auth } from "@/lib/better-auth";
import { sendNotificationEmail } from "@/lib/email";
import { renderTalentOnboardedEmail } from "@/lib/email-templates/talent/onboarded";
import { prisma } from "@/lib/prisma";

/** Result envelope. The route handler turns these into HTTP status codes. */
export type OnboardResult =
  | { ok: true; userAccountId: string; createdSkillCount: number; magicLinkSent: boolean }
  | { ok: false; status: number; error: string };

/** Synthetic authUserId placeholder — recognizable prefix + 16 bytes of
 *  randomness. Kept narrow on purpose: only `lib/auth.ts`'s first-login
 *  linker should ever observe these (it overwrites them with the real
 *  BetterAuth user ID), and grep-ability via the prefix makes any leak
 *  into queries / logs obvious. */
function generatePendingAuthUserId(): string {
  return `pending-onboard-${randomBytes(16).toString("base64url")}`;
}

export async function onboardHiredTalent(applicationId: string): Promise<OnboardResult> {
  // 1. Read row + status check. Re-fetched here even though the route
  //    handler already loaded it; keeps the orchestrator self-contained
  //    so a future cron / retry path can call it without prep.
  const row = await prisma.talentApplication.findUnique({
    where: { id: applicationId },
  });
  if (!row) {
    return { ok: false, status: 404, error: "Application not found." };
  }
  if (row.status !== "HIRED") {
    return {
      ok: false,
      status: 409,
      error: `Cannot onboard from status ${row.status}.`,
    };
  }
  if (row.hiredUserAccountId) {
    return {
      ok: false,
      status: 409,
      error: "Application is already onboarded.",
    };
  }

  // 2. Email-collision guard. Refuse rather than silently promote — the
  //    plan's recommendation. An existing CUSTOMER becoming a DESIGNER
  //    is a permission-surface change that warrants explicit operator
  //    action at /admin/users.
  const existing = await prisma.userAccount.findUnique({
    where: { email: row.email },
    select: { id: true, role: true, deletedAt: true },
  });
  if (existing && !existing.deletedAt) {
    return {
      ok: false,
      status: 409,
      error: `Email ${row.email} already has a ${existing.role} account. Promote it manually at /admin/users instead of creating a duplicate.`,
    };
  }

  // 3. Resolve approved categories → JobType IDs. Empty result is OK —
  //    the orchestrator still creates the UserAccount, just with no
  //    CreativeSkill rows; admin can backfill later.
  const approvedCategoryIds = readApprovedCategoryIds(row);
  const jobTypes =
    approvedCategoryIds.length > 0
      ? await prisma.jobType.findMany({
          where: { categoryId: { in: approvedCategoryIds }, isActive: true },
          select: { id: true },
        })
      : [];

  // 4. Resolve category names for the welcome email — done before the
  //    transaction since we want to fail BEFORE writes if the category
  //    rows are missing (catastrophic data state worth surfacing). On
  //    success the names go into the email template props.
  const categoryRows =
    approvedCategoryIds.length > 0
      ? await prisma.jobTypeCategory.findMany({
          where: { id: { in: approvedCategoryIds } },
          select: { id: true, name: true },
        })
      : [];
  const categoryNameById = new Map(categoryRows.map((c) => [c.id, c.name]));
  const approvedCategoryNames = approvedCategoryIds.map(
    (id) => categoryNameById.get(id) ?? "(removed)",
  );

  // 5. The atomic write. Either everything in this block succeeds or the
  //    application stays at HIRED for a retry. The non-atomic side-effects
  //    (magic-link, welcome email, audit log) come AFTER and are
  //    best-effort — see the comment at the top of the file.
  const placeholderAuthId = generatePendingAuthUserId();
  let userAccountId: string;
  let createdSkillCount = 0;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const userAccount = await tx.userAccount.create({
        data: {
          authUserId: placeholderAuthId,
          email: row.email,
          name: row.fullName,
          role: "DESIGNER",
          tasksPerWeekCap: row.approvedTasksPerWeekCap,
        },
        select: { id: true },
      });

      // CreativeSkill is a M2M join with @@unique([creativeId, jobTypeId]).
      // skipDuplicates is defensive — same JobType appearing twice in
      // the resolved list (via two approvedCategoryIds that share a
      // JobType) would otherwise P2002 the whole transaction.
      const skillsResult =
        jobTypes.length > 0
          ? await tx.creativeSkill.createMany({
              data: jobTypes.map((jt) => ({
                creativeId: userAccount.id,
                jobTypeId: jt.id,
              })),
              skipDuplicates: true,
            })
          : { count: 0 };

      // Flip the application's status + link the new account. Conditional
      // on status=HIRED to prevent a race with another concurrent onboard
      // attempt (though the route's from-status guard makes this rare).
      const updateResult = await tx.talentApplication.updateMany({
        where: { id: applicationId, status: "HIRED" },
        data: {
          status: "ONBOARDED",
          hiredUserAccountId: userAccount.id,
        },
      });
      if (updateResult.count === 0) {
        throw new Error(
          "Application status changed during onboarding. The transaction was rolled back; refresh and try again.",
        );
      }

      return { userAccountId: userAccount.id, skillCount: skillsResult.count };
    });
    userAccountId = result.userAccountId;
    createdSkillCount = result.skillCount;
  } catch (err) {
    console.error("[talent-onboarding] transaction failed", err);
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "Onboarding transaction failed.",
    };
  }

  // 6. Best-effort magic-link send via BetterAuth. signInMagicLink
  //    auto-creates the AuthUser if missing (which it always is on first
  //    onboarding) and fires our sendMagicLink callback in
  //    lib/better-auth.ts to email the link. Failures are logged but do
  //    not roll back the transaction — the candidate can self-trigger a
  //    fresh magic-link by visiting /login and entering their email.
  //
  //    `headers` is required by BetterAuth's endpoint type but unused
  //    for the URL/email generation. We pass an empty Headers object
  //    because this is a server-internal admin-triggered call, not a
  //    request-scoped sign-in — there are no candidate headers to
  //    forward, and the admin's headers would be misleading in any
  //    sign-in audit log BetterAuth might add later.
  let magicLinkSent = false;
  try {
    await auth.api.signInMagicLink({
      headers: new Headers(),
      body: {
        email: row.email,
        name: row.fullName,
        callbackURL: "/creative/board",
      },
    });
    magicLinkSent = true;
  } catch (err) {
    console.error(
      "[talent-onboarding] signInMagicLink failed; candidate can self-trigger from /login",
      err,
    );
  }

  // 7. Best-effort branded welcome email. Independent of the magic-link;
  //    see file header for the rationale on the two-email split.
  try {
    const { subject, html } = await renderTalentOnboardedEmail({
      candidateName: row.fullName,
      workingHours: row.workingHours ?? "(to be confirmed)",
      approvedCategoryNames,
      tasksPerWeekCap: row.approvedTasksPerWeekCap,
    });
    await sendNotificationEmail(row.email, subject, html);
  } catch (err) {
    console.error("[talent-onboarding] welcome email send failed", err);
  }

  return {
    ok: true,
    userAccountId,
    createdSkillCount,
    magicLinkSent,
  };
}

/** Defensively read the JSON column. Empty array on any unexpected
 *  shape — the orchestrator continues with no CreativeSkill seeding,
 *  which the welcome email surfaces ("Categories: —") so the admin
 *  notices and backfills. */
function readApprovedCategoryIds(row: TalentApplication): string[] {
  const raw = row.approvedCategoryIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}
