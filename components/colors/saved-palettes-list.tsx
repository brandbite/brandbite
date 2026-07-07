// -----------------------------------------------------------------------------
// @file: components/colors/saved-palettes-list.tsx
// @purpose: Shows the signed-in user's saved palettes (GET /api/colors/palettes).
//           Renders nothing when signed out. Refreshable via a `refreshKey`.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { SavedPaletteDTO } from "@/lib/colors";
import { readableTextOn } from "@/lib/colors";

export function SavedPalettesList({ refreshKey = 0 }: { refreshKey?: number }) {
  const { data: session } = authClient.useSession();
  const [palettes, setPalettes] = useState<SavedPaletteDTO[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/colors/palettes");
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && Array.isArray(json?.palettes)) {
          setPalettes(json.palettes);
        }
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, refreshKey]);

  if (!session) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold text-[var(--bb-secondary)]">Your saved palettes</h2>
      {loading && palettes.length === 0 ? (
        <p className="text-sm text-[var(--bb-text-tertiary)]">Loading…</p>
      ) : palettes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-6 py-8 text-center text-sm text-[var(--bb-text-tertiary)]">
          No saved palettes yet. Build one above and hit “Save palette”.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {palettes.map((p) => (
            <li
              key={p.id}
              className="overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)]"
            >
              <div className="flex h-16">
                {p.colors.map((hex, i) => (
                  <div
                    key={i}
                    className="flex flex-1 items-center justify-center"
                    style={{ backgroundColor: hex, color: readableTextOn(hex) }}
                    title={hex}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="truncate text-sm font-medium text-[var(--bb-secondary)]">
                  {p.name}
                </span>
                <span className="ml-2 shrink-0 text-[10px] tracking-wide text-[var(--bb-text-muted)] uppercase">
                  {p.source ?? ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
