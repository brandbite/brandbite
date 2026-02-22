// -----------------------------------------------------------------------------
// @file: app/api/admin/settings/route.ts
// @purpose: Admin API for reading and updating app-level settings
// @version: v1.0.0
// @status: active
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { getAppSetting, setAppSetting } from "@/lib/app-settings";
import { parseBody } from "@/lib/schemas/helpers";
import { updateAdminSettingSchema } from "@/lib/schemas/admin-settings.schemas";

function requireAdmin(userRole: string) {
  if (userRole !== "SITE_OWNER" && userRole !== "SITE_ADMIN") {
    const error: Error & { code?: string; status?: number } = new Error(
      "You do not have permission to manage settings.",
    );
    error.code = "FORBIDDEN";
    error.status = 403;
    throw error;
  }
}

/** Allowed setting keys that admins may read/write via this endpoint. */
const ALLOWED_KEYS = ["MIN_WITHDRAWAL_TOKENS"] as const;

function isAllowedKey(key: string): key is (typeof ALLOWED_KEYS)[number] {
  return (ALLOWED_KEYS as readonly string[]).includes(key);
}

// -----------------------------------------------------------------------------
// GET: read one or all allowed settings
// Query: ?key=MIN_WITHDRAWAL_TOKENS  (optional — omit to get all)
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    requireAdmin(user.role);

    const key = req.nextUrl.searchParams.get("key");

    if (key) {
      if (!isAllowedKey(key)) {
        return NextResponse.json({ error: `Unknown setting key: ${key}` }, { status: 400 });
      }
      const value = await getAppSetting(key);
      return NextResponse.json({ key, value });
    }

    // Return all allowed settings
    const entries: Record<string, string | null> = {};
    for (const k of ALLOWED_KEYS) {
      entries[k] = await getAppSetting(k);
    }
    return NextResponse.json({ settings: entries });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error?.code === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 403 });
    }
    console.error("[admin.settings] GET error", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH: update a setting
// Body: { key: string, value: string }
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    requireAdmin(user.role);

    const parsed = await parseBody(req, updateAdminSettingSchema);
    if (!parsed.success) return parsed.response;
    const { key, value } = parsed.data;

    await setAppSetting(key, value);

    return NextResponse.json({ key, value });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error?.code === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 403 });
    }
    console.error("[admin.settings] PATCH error", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
