// -----------------------------------------------------------------------------
// @file: components/colors/studio/use-saved-palettes.ts
// @purpose: The saved-palette collection for the current visitor: the account for
//           signed-in users, the browser for guests. Browser palettes never move
//           on their own; a signed-in user is offered moveLocalToAccount, so a
//           shared computer can't put someone's palettes in the wrong account.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { authClient } from "@/lib/auth-client";
import type { StudioPalette } from "@/lib/colors";

import {
  accountPaletteStore,
  localPaletteStore,
  PaletteStoreError,
  type PaletteStore,
  type PaletteStoreErrorKind,
  type PaletteStoreMode,
} from "./palette-store";

export type SavedPalettesStatus = "loading" | "ready" | "error";

export type SaveResult<T> = { ok: true; value: T } | { ok: false; message: string };

const MESSAGES: Record<PaletteStoreErrorKind, string> = {
  corrupt:
    "The palettes saved in this browser couldn't be read. Import a backup, or clear them to start over.",
  storage: "Couldn't save. Browser storage is full or blocked.",
  network: "Couldn't reach your account. Check your connection and try again.",
  limit: "You've reached the limit for saved palettes.",
  "not-found": "That palette no longer exists.",
  invalid: "That palette isn't valid.",
};

function messageFor(err: unknown): string {
  if (err instanceof PaletteStoreError) {
    return err.kind === "limit" && err.message !== err.kind ? err.message : MESSAGES[err.kind];
  }
  return MESSAGES.network;
}

function storeFor(mode: PaletteStoreMode): PaletteStore {
  return mode === "account" ? accountPaletteStore : localPaletteStore;
}

type Loaded = {
  mode: PaletteStoreMode;
  palettes: StudioPalette[];
  error: PaletteStoreErrorKind | null;
};

export function useSavedPalettes() {
  const { data: session, isPending } = authClient.useSession();
  const mode: PaletteStoreMode | null = isPending ? null : session ? "account" : "local";

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [localCount, setLocalCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    storeFor(mode)
      .list()
      .then((palettes) => {
        if (!cancelled) setLoaded({ mode, palettes, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const kind = err instanceof PaletteStoreError ? err.kind : "network";
        setLoaded({ mode, palettes: [], error: kind });
      });
    if (mode === "account") {
      localPaletteStore
        .list()
        .then((palettes) => {
          if (!cancelled) setLocalCount(palettes.length);
        })
        // Unreadable browser data has nothing to offer moving. Guests see the error instead.
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [mode, reloadKey]);

  const current = loaded && loaded.mode === mode ? loaded : null;
  const palettes = useMemo(() => current?.palettes ?? [], [current]);
  const status: SavedPalettesStatus = !current ? "loading" : current.error ? "error" : "ready";

  const setPalettes = useCallback((update: (prev: StudioPalette[]) => StudioPalette[]) => {
    setLoaded((prev) => (prev ? { ...prev, palettes: update(prev.palettes) } : prev));
  }, []);

  const createMany = useCallback(
    async (incoming: StudioPalette[]): Promise<SaveResult<StudioPalette[]>> => {
      if (!mode) return { ok: false, message: MESSAGES.network };
      try {
        const created = await storeFor(mode).createMany(incoming);
        setPalettes((prev) => [...created, ...prev]);
        return { ok: true, value: created };
      } catch (err) {
        return { ok: false, message: messageFor(err) };
      }
    },
    [mode, setPalettes],
  );

  const update = useCallback(
    async (palette: StudioPalette): Promise<SaveResult<StudioPalette>> => {
      if (!mode) return { ok: false, message: MESSAGES.network };
      try {
        const saved = await storeFor(mode).update(palette);
        setPalettes((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
        return { ok: true, value: saved };
      } catch (err) {
        return { ok: false, message: messageFor(err) };
      }
    },
    [mode, setPalettes],
  );

  /** Update a palette that's in the collection, otherwise add it. */
  const save = useCallback(
    async (palette: StudioPalette): Promise<SaveResult<StudioPalette>> => {
      if (palettes.some((p) => p.id === palette.id)) return update(palette);
      const result = await createMany([palette]);
      return result.ok ? { ok: true, value: result.value[0] } : result;
    },
    [palettes, update, createMany],
  );

  const remove = useCallback(
    async (id: string): Promise<SaveResult<null>> => {
      if (!mode) return { ok: false, message: MESSAGES.network };
      try {
        await storeFor(mode).remove(id);
        setPalettes((prev) => prev.filter((p) => p.id !== id));
        return { ok: true, value: null };
      } catch (err) {
        return { ok: false, message: messageFor(err) };
      }
    },
    [mode, setPalettes],
  );

  /** Copies browser palettes to the account, clearing them only after that succeeds. */
  const moveLocalToAccount = useCallback(async (): Promise<SaveResult<number>> => {
    try {
      const local = await localPaletteStore.list();
      if (local.length === 0) return { ok: true, value: 0 };
      const created = await accountPaletteStore.createMany(local);
      localPaletteStore.clear();
      setLocalCount(0);
      setPalettes((prev) => [...created, ...prev]);
      return { ok: true, value: created.length };
    } catch (err) {
      return { ok: false, message: messageFor(err) };
    }
  }, [setPalettes]);

  /** Discard unreadable browser data at the user's request. */
  const clearCorruptLocal = useCallback(() => {
    localPaletteStore.clear();
    setReloadKey((key) => key + 1);
  }, []);

  return {
    mode,
    status,
    palettes,
    errorMessage: current?.error ? MESSAGES[current.error] : null,
    errorKind: current?.error ?? null,
    localCount,
    createMany,
    save,
    remove,
    moveLocalToAccount,
    clearCorruptLocal,
  };
}
