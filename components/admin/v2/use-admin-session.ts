// -----------------------------------------------------------------------------
// @file: components/admin/v2/use-admin-session.ts
// @purpose: Display identity for the admin shell (avatar initials, name,
//           role label) from /api/session. Fetched once per page load and
//           shared between the sidebar footer and the top-bar user menu.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { formatRole } from "@/lib/roles";

export type AdminSessionUser = {
  name: string;
  email: string;
  roleLabel: string;
  initials: string;
};

let cache: Promise<AdminSessionUser | null> | null = null;

function initialsOf(nameOrEmail: string): string {
  const base = nameOrEmail.split("@")[0].trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : base.slice(0, 2) || "?";
  return letters.toUpperCase();
}

async function load(): Promise<AdminSessionUser | null> {
  try {
    const res = await fetch("/api/session", { cache: "no-store" });
    const json = await res.json();
    const u = json?.user;
    if (!u) return null;
    const name = (u.name as string | null)?.trim() || (u.email as string);
    return {
      name,
      email: u.email,
      roleLabel: formatRole(u.role),
      initials: initialsOf(name),
    };
  } catch {
    return null;
  }
}

export function useAdminSession(): AdminSessionUser | null {
  const [user, setUser] = useState<AdminSessionUser | null>(null);
  useEffect(() => {
    cache ??= load();
    let alive = true;
    cache.then((u) => alive && setUser(u));
    return () => {
      alive = false;
    };
  }, []);
  return user;
}
