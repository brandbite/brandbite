// -----------------------------------------------------------------------------
// @file: components/admin/v2/unsaved-changes.tsx
// @purpose: One unsaved-changes guard for the whole admin.
//
//           Pages report their draft state with `useUnsavedChanges(dirty)`.
//           While anything is dirty the provider:
//             - asks before following any in-app link (sidebar, breadcrumbs,
//               "View …" links, Next <Link>s) — captured at the document so
//               no page has to wire its own links;
//             - asks before Ctrl/⌘K palette jumps and sign-out (they call
//               `confirmDiscard()` explicitly);
//             - sets the native beforeunload prompt for reload / tab close /
//               external links.
//           Pages also call the returned `confirmDiscard()` before in-page
//           actions that would drop a draft (switching record, "New …",
//           closing the editor panel).
//
//           Not covered: the browser Back/Forward buttons inside the SPA —
//           the App Router exposes no cancellable route-change event.
// -----------------------------------------------------------------------------

"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Entry = { dirty: boolean; label?: string };

type Ctx = {
  set: (id: string, entry: Entry) => void;
  remove: (id: string) => void;
  /** Resolves true when there is nothing to lose or the user chose to discard. */
  confirmDiscard: () => Promise<boolean>;
};

const UnsavedCtx = createContext<Ctx | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const entries = useRef(new Map<string, Entry>());
  const [pending, setPending] = useState<{
    labels: string[];
    resolve: (ok: boolean) => void;
  } | null>(null);

  const dirtyLabels = useCallback(() => {
    const out: string[] = [];
    let any = false;
    for (const e of entries.current.values()) {
      if (!e.dirty) continue;
      any = true;
      if (e.label && !out.includes(e.label)) out.push(e.label);
    }
    return any ? out : null;
  }, []);

  const confirmDiscard = useCallback(() => {
    const labels = dirtyLabels();
    if (!labels) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => setPending({ labels, resolve }));
  }, [dirtyLabels]);

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  // Reload / tab close / external navigation.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyLabels()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyLabels]);

  // Any in-app link click while something is dirty.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab/window
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // beforeunload covers it
      if (url.protocol !== "http:" && url.protocol !== "https:") return; // mailto: etc.
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return; // same page / hash
      if (!dirtyLabels()) return;

      e.preventDefault();
      e.stopPropagation();
      void confirmDiscard().then((ok) => {
        if (!ok) return;
        entries.current.clear();
        router.push(url.pathname + url.search + url.hash);
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [confirmDiscard, dirtyLabels, router]);

  const value = useMemo<Ctx>(
    () => ({
      set: (id, entry) => entries.current.set(id, entry),
      remove: (id) => entries.current.delete(id),
      confirmDiscard,
    }),
    [confirmDiscard],
  );

  const labels = pending?.labels ?? [];

  return (
    <UnsavedCtx.Provider value={value}>
      {children}
      <ConfirmDialog
        open={pending !== null}
        onClose={() => settle(false)}
        onConfirm={() => settle(true)}
        variant="warning"
        title="Discard unsaved changes?"
        description={
          labels.length
            ? `You have unsaved changes in ${labels.join(", ")}. If you leave now they will be lost.`
            : "You have unsaved changes. If you leave now they will be lost."
        }
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
      />
    </UnsavedCtx.Provider>
  );
}

/**
 * Report whether this component holds unsaved edits. Returns
 * `confirmDiscard()` — await it before any in-page action that would throw
 * the draft away (switching record, starting a new one, closing the editor).
 */
export function useUnsavedChanges(dirty: boolean, label?: string) {
  const ctx = useContext(UnsavedCtx);
  const id = useId();

  useEffect(() => {
    ctx?.set(id, { dirty, label });
  }, [ctx, id, dirty, label]);

  useEffect(() => {
    return () => ctx?.remove(id);
  }, [ctx, id]);

  return ctx?.confirmDiscard ?? confirmNothing;
}

/** For callers that navigate but don't own a draft (palette, sign-out). */
export function useConfirmDiscard() {
  return useContext(UnsavedCtx)?.confirmDiscard ?? confirmNothing;
}

const confirmNothing = () => Promise.resolve(true);
