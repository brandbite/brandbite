// -----------------------------------------------------------------------------
// @file: components/colors/studio/guest-palettes-notice.tsx
// @purpose: Dashboard notice for palettes saved in this browser before signing in.
//           Signing in leads to the dashboard, so the offer on /colors/saved would
//           otherwise go unseen. Moving still takes a click, because a shared
//           computer's palettes may belong to someone else. Dismissing is
//           remembered; the offer on /colors/saved stays available.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { localPaletteStore, moveLocalPalettesToAccount } from "./palette-store";
import { messageFor } from "./use-saved-palettes";

const DISMISSED_KEY = "brandbite.colorStudio.moveNoticeDismissed";

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function plural(count: number): string {
  return `${count} saved ${count === 1 ? "palette" : "palettes"}`;
}

const PANEL =
  "mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-4 text-sm";

export function GuestPalettesNotice() {
  const [count, setCount] = useState(0);
  const [moving, setMoving] = useState(false);
  const [moved, setMoved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wasDismissed()) return;
    let cancelled = false;
    localPaletteStore
      .list()
      .then((palettes) => {
        if (!cancelled) setCount(palettes.length);
      })
      // Unreadable browser data has nothing to offer moving.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const move = async () => {
    setError(null);
    setMoving(true);
    try {
      const created = await moveLocalPalettesToAccount();
      setCount(0);
      setMoved(created.length);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setMoving(false);
    }
  };

  const dismiss = () => {
    setCount(0);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // It just comes back next time.
    }
  };

  if (moved !== null) {
    return (
      <section role="status" className={PANEL}>
        <p>Moved {plural(moved)} to your account.</p>
        <div className="flex items-center gap-2">
          <Link href="/colors/saved" className="font-medium text-[var(--bb-primary)] underline">
            View palettes
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setMoved(null)}>
            Close
          </Button>
        </div>
      </section>
    );
  }

  if (count === 0) return null;

  return (
    <section aria-label="Palettes saved in this browser" className={PANEL}>
      <div className="min-w-0">
        <p>This browser has {plural(count)} that aren&apos;t on your account.</p>
        {error ? (
          <p role="alert" className="mt-1 text-[var(--bb-danger-text)]">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" loading={moving} loadingText="Moving…" onClick={() => void move()}>
          Move to my account
        </Button>
        <Button variant="ghost" size="sm" disabled={moving} onClick={dismiss}>
          Dismiss
        </Button>
      </div>
    </section>
  );
}
