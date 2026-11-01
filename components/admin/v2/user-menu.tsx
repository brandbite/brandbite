// -----------------------------------------------------------------------------
// @file: components/admin/v2/user-menu.tsx
// @purpose: Account popover for the admin shell — profile, settings, theme
//           and sign-out (or persona switch in demo mode). Used by both the
//           top-bar avatar (opens down) and the sidebar footer (opens up).
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { IconLogout, IconMembers, IconSettings } from "@/components/navigation/nav-icons";
import type { AdminSessionUser } from "./use-admin-session";

export function Avatar({ user, size = 40 }: { user: AdminSessionUser | null; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--av2-selected)] text-sm font-semibold text-[var(--av2-link)]"
    >
      {user?.initials ?? ""}
    </span>
  );
}

export function UserMenu({
  user,
  placement,
  trigger,
  triggerClassName,
  triggerLabel,
}: {
  user: AdminSessionUser | null;
  placement: "down" | "up";
  trigger: ReactNode;
  triggerClassName: string;
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const router = useRouter();
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = async () => {
    setOpen(false);
    if (isDemoMode) {
      router.push("/debug/demo-user");
      return;
    }
    await authClient.signOut();
    router.push("/login");
  };

  const itemClass =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--av2-text)] hover:bg-[var(--av2-bg)] focus-visible:bg-[var(--av2-bg)] focus-visible:outline-none";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerLabel}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={[
            "absolute z-50 w-64 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-2 shadow-lg",
            placement === "down" ? "top-full right-0 mt-2" : "bottom-full left-0 mb-2",
          ].join(" ")}
        >
          <div className="flex items-center gap-3 border-b border-[var(--av2-border)] px-3 pt-2 pb-3">
            <Avatar user={user} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name ?? "—"}</p>
              <p className="truncate text-xs text-[var(--av2-text-2)]">{user?.roleLabel ?? ""}</p>
            </div>
          </div>
          <div className="py-1">
            <Link
              role="menuitem"
              href="/admin/profile"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <IconMembers width={18} height={18} /> Profile
            </Link>
            <Link
              role="menuitem"
              href="/admin/settings"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <IconSettings width={18} height={18} /> Settings
            </Link>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--av2-border)] px-3 py-2">
            <span className="text-xs text-[var(--av2-text-2)]">Theme</span>
            <ThemeToggle />
          </div>
          <div className="border-t border-[var(--av2-border)] pt-1">
            <button role="menuitem" type="button" onClick={signOut} className={itemClass}>
              <IconLogout width={18} height={18} />
              {isDemoMode ? "Switch persona" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
