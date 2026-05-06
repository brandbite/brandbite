// -----------------------------------------------------------------------------
// @file: app/api/profile/route.ts
// @purpose: Per-user identity self-service. GET returns the caller's own
//           profile (name, email, timezone, role); PATCH updates name and/or
//           timezone. Email change deferred — that needs BetterAuth's
//           verification flow and is a follow-up PR.
//
//           Role-agnostic on purpose: every signed-in user has a UserAccount
//           and the same handful of personal fields, so a single endpoint
//           keeps the customer / creative / admin profile pages all in lock-
//           step. Anything role-specific (creative working hours, customer
//           company membership, admin MFA enrollment) lives in its own
//           role-prefixed route.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// IANA timezone strings can be quite long but the longest in the
// real world ("America/Argentina/ComodRivadavia") is 36 chars. Cap
// at a comfortable 64 to leave headroom for any future entries
// without inviting arbitrary blob writes.
const MAX_TIMEZONE_LENGTH = 64;
// Names render in ticket comments, emails, and the admin user list;
// guarding against pasted essays keeps every consumer honest.
const MAX_NAME_LENGTH = 80;

type ProfileResponseUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  timezone: string | null;
  /** Whether the linked AuthUser has BetterAuth login 2FA enabled.
   *  Joined here so the profile page can render the 2FA section state
   *  without a second round-trip. */
  twoFactorEnabled: boolean;
  /** AuthUser.image — public R2 URL to the user's avatar, or null when
   *  unset. Joined from AuthUser since that's BetterAuth's source of
   *  truth for the field. */
  image: string | null;
};

// ---------------------------------------------------------------------------
// GET /api/profile — caller's own profile.
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const session = await getCurrentUserOrThrow();

    const row = await prisma.userAccount.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        timezone: true,
        authUserId: true,
      },
    });
    if (!row) {
      // Session pointed at a UserAccount that no longer exists. Should
      // be impossible outside a soft-delete race, but mirror the 404
      // pattern the rest of the codebase uses rather than throwing.
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Read 2FA state from the linked AuthUser. We do this as a separate
    // query rather than a Prisma relation lookup because UserAccount
    // doesn't define a Prisma relation back to AuthUser — they're
    // intentionally loosely coupled (UserAccount uses authUserId as a
    // string FK without `@relation`) so admin-side hard deletes don't
    // run into Prisma's referential-action machinery.
    const authRow = await prisma.authUser.findUnique({
      where: { id: row.authUserId },
      select: { twoFactorEnabled: true, image: true },
    });

    const user: ProfileResponseUser = {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      timezone: row.timezone,
      twoFactorEnabled: !!authRow?.twoFactorEnabled,
      image: authRow?.image ?? null,
    };
    return NextResponse.json({ user });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[GET /api/profile] error", err);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/profile — update name and/or timezone.
//
// Body shape:
//   { name?: string, timezone?: string | null }
//
// Both fields are optional; sending neither is a no-op (returns the
// current row unchanged). `timezone: null` explicitly clears the
// stored value, falling back to UTC display everywhere. Email changes
// are NOT handled here — they need BetterAuth's verification flow and
// will land in a follow-up PR.
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUserOrThrow();

    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
      timezone?: unknown;
    } | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const data: { name?: string; timezone?: string | null } = {};

    // ----- name -----
    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        return NextResponse.json({ error: "name must be a string" }, { status: 400 });
      }
      const trimmed = body.name.trim();
      if (trimmed.length === 0) {
        return NextResponse.json(
          {
            error: "Name cannot be empty. Leave the field unchanged if you don't want to set one.",
          },
          { status: 400 },
        );
      }
      if (trimmed.length > MAX_NAME_LENGTH) {
        return NextResponse.json(
          { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` },
          { status: 400 },
        );
      }
      data.name = trimmed;
    }

    // ----- timezone -----
    if (body.timezone !== undefined) {
      if (body.timezone === null || body.timezone === "") {
        // Explicit clear — fall back to UTC display.
        data.timezone = null;
      } else if (typeof body.timezone !== "string") {
        return NextResponse.json({ error: "timezone must be a string or null" }, { status: 400 });
      } else {
        const trimmed = body.timezone.trim();
        if (trimmed.length === 0) {
          data.timezone = null;
        } else {
          if (trimmed.length > MAX_TIMEZONE_LENGTH) {
            return NextResponse.json(
              { error: "timezone string is unreasonably long" },
              { status: 400 },
            );
          }
          // Validate via Intl — any string the runtime can't honor is
          // not worth saving. This is the same check Intl.DateTimeFormat
          // would do at render time, surfaced earlier so the user
          // sees the failure on save instead of mysterious UTC output.
          try {
            new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
          } catch {
            return NextResponse.json(
              {
                error:
                  'That timezone isn\'t recognized. Pick a value from the list, e.g. "Europe/Istanbul".',
              },
              { status: 400 },
            );
          }
          data.timezone = trimmed;
        }
      }
    }

    if (Object.keys(data).length === 0) {
      // No-op — return current row so the client can sync without a
      // separate GET round-trip.
      const row = await prisma.userAccount.findUniqueOrThrow({
        where: { id: session.id },
        select: { id: true, email: true, name: true, role: true, timezone: true, authUserId: true },
      });
      const auth = await prisma.authUser.findUnique({
        where: { id: row.authUserId },
        select: { twoFactorEnabled: true, image: true },
      });
      return NextResponse.json({
        user: {
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role,
          timezone: row.timezone,
          twoFactorEnabled: !!auth?.twoFactorEnabled,
          image: auth?.image ?? null,
        } satisfies ProfileResponseUser,
      });
    }

    const updated = await prisma.userAccount.update({
      where: { id: session.id },
      data,
      select: { id: true, email: true, name: true, role: true, timezone: true, authUserId: true },
    });
    const auth = await prisma.authUser.findUnique({
      where: { id: updated.authUserId },
      select: { twoFactorEnabled: true, image: true },
    });
    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        timezone: updated.timezone,
        twoFactorEnabled: !!auth?.twoFactorEnabled,
        image: auth?.image ?? null,
      } satisfies ProfileResponseUser,
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[PATCH /api/profile] error", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
