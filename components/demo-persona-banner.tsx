// -----------------------------------------------------------------------------
// @file: components/demo-persona-banner.tsx
// @purpose: Demo-mode banner. Shows the real signed-in user when a BetterAuth
//           session is active; falls back to "Browsing as <persona>" when
//           only the persona cookie is set.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-05-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { formatRole, type AppUserRole } from "@/lib/roles";

type DemoPersonaSummary = {
  id: string;
  label: string;
  roleLabel: string | null;
};

type RealUser = {
  name: string | null;
  email: string;
  role: string;
};

type SessionState =
  | { status: "idle" | "loading" }
  | { status: "anonymous" }
  | {
      status: "ready";
      persona: DemoPersonaSummary | null;
      realUser: RealUser | null;
    };

export default function DemoPersonaBanner() {
  const pathname = usePathname();
  const [state, setState] = useState<SessionState>({ status: "idle" });
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState((prev) => {
        if (prev.status === "ready" || prev.status === "idle") {
          return { status: "loading" };
        }
        return prev;
      });

      try {
        const res = await fetch("/api/session", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          if (!cancelled) setState({ status: "anonymous" });
          return;
        }

        const data = await res.json();
        const personaRaw = data?.demoPersona ?? null;
        const userRaw = data?.user ?? null;

        if (cancelled) return;

        // No persona AND no real user → nothing to show.
        if (!personaRaw && !userRaw) {
          setState({ status: "anonymous" });
          return;
        }

        // The real user resolved through BetterAuth wins the headline.
        // The persona is reduced to a "you also have an overlay set" note
        // when both exist (so the user can clear it from the banner).
        const realUserShadowsPersona = !!userRaw && !!personaRaw;

        setState({
          status: "ready",
          persona: personaRaw
            ? {
                id: personaRaw.id,
                label: personaRaw.label,
                roleLabel: personaRaw.roleLabel ?? null,
              }
            : null,
          realUser:
            userRaw && (realUserShadowsPersona || !personaRaw)
              ? {
                  name: userRaw.name ?? null,
                  email: userRaw.email,
                  role: userRaw.role,
                }
              : null,
        });
      } catch (error) {
        console.error("[DemoPersonaBanner] failed to load session:", error);
        if (!cancelled) setState({ status: "anonymous" });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (state.status !== "ready") return null;

  const handleClearPersona = async () => {
    setClearing(true);
    try {
      await fetch("/api/debug/demo-user", { method: "DELETE" });
      // Re-fetch session so the banner re-renders without the persona.
      // A full reload is the simplest way to ensure server components
      // (sidebars, dashboards) also re-resolve to the real user.
      window.location.reload();
    } catch (err) {
      console.error("[DemoPersonaBanner] clear failed", err);
      setClearing(false);
    }
  };

  const { persona, realUser } = state;

  // Banner sits above the fixed sidebar — see comments in v1 for the
  // --bb-sidebar-w padding interaction.
  return (
    <div className="w-full bg-[var(--bb-primary)] text-[11px] text-white">
      <div className="md:pl-[var(--bb-sidebar-w,0px)] md:transition-[padding] md:duration-200">
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full bg-[var(--bb-bg-page)]/15 px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] uppercase">
              Demo mode
            </span>

            {realUser ? (
              <span className="opacity-90">
                Signed in as{" "}
                <span className="font-medium">{realUser.name?.trim() || realUser.email}</span>
                <span className="opacity-75"> ({formatRole(realUser.role as AppUserRole)})</span>
                {persona && (
                  <span className="ml-2 opacity-75">
                    · persona overlay <span className="font-medium">{persona.label}</span> is set
                  </span>
                )}
              </span>
            ) : persona ? (
              <span className="opacity-90">
                You are browsing as <span className="font-medium">{persona.label}</span>
                {persona.roleLabel && <span className="opacity-75"> ({persona.roleLabel})</span>}
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {persona && (
              <button
                type="button"
                onClick={handleClearPersona}
                disabled={clearing}
                className="rounded-full border border-white/40 px-3 py-1 text-[11px] font-medium hover:bg-[var(--bb-bg-page)]/10 disabled:opacity-60"
              >
                {clearing ? "Clearing…" : "Clear persona"}
              </button>
            )}
            <a
              href="/debug/demo-user"
              className="rounded-full border border-white/40 px-3 py-1 text-[11px] font-medium hover:bg-[var(--bb-bg-page)]/10"
            >
              {persona ? "Switch persona" : "Try a persona"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
