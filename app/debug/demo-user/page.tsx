// -----------------------------------------------------------------------------
// @file: app/debug/demo-user/page.tsx
// @purpose: Simple demo persona switcher (sets bb-demo-user cookie via API)
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_PERSONAS } from "@/lib/demo-personas";
import { InlineAlert } from "@/components/ui/inline-alert";

const personas = DEMO_PERSONAS;

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
    } catch (err) {
      console.error("[debug.demo-user] switch error", err);
      setError("Unexpected error while switching demo user.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bb-bg-card)] text-[var(--bb-secondary)]">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 py-10">
        <div className="w-full rounded-3xl bg-[var(--bb-bg-page)]/90 p-6 shadow-sm shadow-[var(--bb-border)] md:p-8">
          <header className="mb-6 border-b border-[var(--bb-border-subtle)] pb-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--bb-text-muted)]">
              Debug
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--bb-secondary)]">
              Browse Brandbite as…
            </h1>
            <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
              Pick a persona to explore Brandbite from different perspectives.
              This will set a{" "}
              <code className="rounded bg-[var(--bb-bg-card)] px-1 py-0.5 text-[11px]">
                bb-demo-user
              </code>{" "}
              cookie and then redirect you to a relevant dashboard.
            </p>
          </header>

          {error && (
            <InlineAlert variant="error" className="mb-4">
              {error}
            </InlineAlert>
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
                  className="group flex flex-col rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-4 py-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:border-[var(--bb-primary)]/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[var(--bb-secondary)]">
                      {p.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--bb-text-muted)]">
                      {isLoading ? "Switching…" : "Use"}
                    </span>
                  </div>
                  <p className="mb-2 text-[11px] font-medium text-[var(--bb-text-muted)]">
                    {p.role === "SITE_OWNER" || p.role === "SITE_ADMIN"
                      ? "Platform"
                      : p.role === "CUSTOMER"
                      ? "Customer"
                      : p.role === "DESIGNER"
                      ? "Creative"
                      : p.role}
                  </p>
                  <p className="text-[12px] text-[var(--bb-text-secondary)]">{p.description}</p>
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-[var(--bb-text-muted)]">
            This page is for local development and demos only. In production,
            this flow will be replaced by real authentication.
          </p>
        </div>
      </div>
    </div>
  );
}
