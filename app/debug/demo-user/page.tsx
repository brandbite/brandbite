// -----------------------------------------------------------------------------
// @file: app/debug/demo-user/page.tsx
// @purpose: Simple demo persona switcher (sets bb-demo-user cookie via API)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const personas = [
  {
    id: "site-owner",
    label: "Site owner",
    description: "Platform-level owner for Brandbite.",
    redirectTo: "/admin/ledger",
  },
  {
    id: "site-admin",
    label: "Site admin",
    description: "Platform admin, similar privileges as owner.",
    redirectTo: "/admin/ledger",
  },
  {
    id: "customer-owner",
    label: "Customer • Company owner",
    description: "Owner of Acme Studio (demo company).",
    redirectTo: "/customer/tokens",
  },
  {
    id: "customer-pm",
    label: "Customer • Project manager",
    description: "PM for Acme Studio projects.",
    redirectTo: "/customer/tickets",
  },
  {
    id: "designer-ada",
    label: "Designer • Ada",
    description: "Designer working on Website revamp.",
    redirectTo: "/designer/balance",
  },
  {
    id: "designer-liam",
    label: "Designer • Liam",
    description: "Designer working on Onboarding visuals.",
    redirectTo: "/designer/balance",
  },
];

export default function DebugDemoUserPage() {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPersona = async (personaId: string, redirectTo: string) => {
    setError(null);
    setLoadingId(personaId);

    try {
      const res = await fetch("/api/debug/demo-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          persona: personaId,
          redirectTo,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          json?.error || "Failed to switch demo user. Please try again.",
        );
        return;
      }

      const target = json?.redirectTo || redirectTo;
      router.push(target);
    } catch (err: any) {
      console.error("Debug demo user error:", err);
      setError("Unexpected error while switching persona.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f15b2b] text-sm font-semibold text-white">
              B
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Brandbite
            </span>
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#9a9892]">
            Demo personas
          </span>
        </header>

        <main className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-6 shadow-sm">
          <div className="mb-4">
            <h1 className="text-xl font-semibold tracking-tight">
              Switch demo user
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Pick a persona to explore Brandbite from different perspectives.
              This will set a{" "}
              <code className="rounded bg-[#f5f3f0] px-1 py-0.5 text-[11px]">
                bb-demo-user
              </code>{" "}
              cookie and then redirect you to a relevant dashboard.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-[#fff7f7] px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {personas.map((p) => {
              const isLoading = loadingId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPersona(p.id, p.redirectTo)}
                  disabled={isLoading}
                  className="group flex flex-col rounded-xl border border-[#e3e1dc] bg-[#fdfbf8] px-4 py-3 text-left text-sm shadow-sm transition hover:-translate-y-[1px] hover:border-[#f15b2b] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[#424143]">
                      {p.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-[#b8b6b1]">
                      {isLoading ? "Switching…" : "Use"}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#7a7a7a]">{p.description}</p>
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-[#b8b6b1]">
            This page is for local development and demos only. In production,
            this flow will be replaced by real authentication.
          </p>
        </main>
      </div>
    </div>
  );
}
