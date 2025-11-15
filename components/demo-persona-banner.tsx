// -----------------------------------------------------------------------------
// @file: components/demo-persona-banner.tsx
// @purpose: Client-side demo persona banner that reads from /api/session
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type DemoPersonaSummary = {
  id: string;
  label: string;
  roleLabel: string | null;
};

type SessionState =
  | { status: "idle" | "loading" }
  | { status: "anonymous" }
  | { status: "ready"; persona: DemoPersonaSummary };

export default function DemoPersonaBanner() {
  const pathname = usePathname();
  const [state, setState] = useState<SessionState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // İlk seferde / route değişimlerinde state'i loading'e çekelim
      setState((prev) => {
        if (prev.status === "ready") {
          return { status: "loading" };
        }
        if (prev.status === "idle") {
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
          if (!cancelled) {
            setState({ status: "anonymous" });
          }
          return;
        }

        const data = await res.json();
        const persona = data?.demoPersona ?? null;

        if (cancelled) return;

        if (!persona) {
          setState({ status: "anonymous" });
          return;
        }

        setState({
          status: "ready",
          persona: {
            id: persona.id,
            label: persona.label,
            roleLabel: persona.roleLabel ?? null,
          },
        });
      } catch (error) {
        console.error("[DemoPersonaBanner] failed to load session:", error);
        if (!cancelled) {
          setState({ status: "anonymous" });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (state.status !== "ready") {
    // Persona yoksa veya henüz yükleniyorsa banner göstermiyoruz
    return null;
  }

  const { persona } = state;

  return (
    <div className="w-full bg-[#f15b2b] text-[11px] text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]">
            Demo mode
          </span>
          <span className="opacity-90">
            You are browsing as{" "}
            <span className="font-medium">{persona.label}</span>
            {persona.roleLabel && (
              <span className="opacity-75"> ({persona.roleLabel})</span>
            )}
          </span>
        </div>

        <a
          href="/debug/demo-user"
          className="rounded-full border border-white/40 px-3 py-1 text-[11px] font-medium hover:bg-white/10"
        >
          Switch persona
        </a>
      </div>
    </div>
  );
}
