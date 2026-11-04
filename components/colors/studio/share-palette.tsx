// -----------------------------------------------------------------------------
// @file: components/colors/studio/share-palette.tsx
// @purpose: Share one palette by link. What the link exposes, and that it can't be
//           removed, is explained before it exists, and copying only becomes
//           available after the server has created the snapshot.
// -----------------------------------------------------------------------------

"use client";

import { useId, useState } from "react";

import { Modal } from "@/components/ui/modal";
import type { StudioPalette } from "@/lib/colors";

import { CloseIcon, EyeIcon, ShareIcon } from "./icons";
import { STUDIO_FIELD } from "./palette-parts";
import { StudioButton, studioButtonClasses } from "./studio-button";
import { useStudioCopy } from "./use-studio-copy";

export function SharePaletteButton({ palette }: { palette: StudioPalette }) {
  const titleId = useId();
  const { copy } = useStudioCopy();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createLink = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/colors/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: palette.name,
          colors: palette.colors.map((c) => ({ id: c.id, hex: c.hex })),
          roles: palette.roles,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.id) {
        setUrl(`${window.location.origin}/colors/p/${json.id}`);
      } else {
        setError(
          res.status === 429
            ? "You've created a lot of links recently. Please try again later."
            : "The link couldn't be created. Please try again.",
        );
      }
    } catch {
      setError("The link couldn't be created. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <StudioButton
        icon={<ShareIcon />}
        onClick={() => {
          setUrl(null);
          setError(null);
          setOpen(true);
        }}
      >
        Share palette
      </StudioButton>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        scrollable
        labelledBy={titleId}
        className="bg-[var(--cs-surface)]! p-8! max-[479px]:p-5!"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--cs-soft)] text-[var(--cs-soft-text)]">
            <ShareIcon />
          </span>
          <h2
            id={titleId}
            className="min-w-0 flex-1 text-[32px] leading-10 font-bold max-[479px]:text-2xl max-[479px]:leading-8"
          >
            Share palette
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
          >
            <CloseIcon />
          </button>
        </div>
        <p className="mt-2 text-base leading-6 text-[var(--cs-muted)]">
          Send this palette to your team or client.
        </p>

        <div className="mt-5 rounded-2xl border border-[var(--cs-border)] p-4">
          <p className="truncate text-lg leading-[26px] font-semibold">{palette.name}</p>
          <div className="mt-3 flex gap-2">
            {palette.colors.map((color) => (
              <span
                key={color.id}
                className="h-14 min-w-0 flex-1 rounded-[10px] border border-[var(--cs-border)]"
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-xl bg-[var(--cs-background)] px-4 py-3 text-sm leading-5">
          <span className="text-[var(--cs-muted)]">
            <EyeIcon />
          </span>
          <span className="min-w-0 flex-1">Anyone with the link can view this palette.</span>
          <span className="shrink-0 rounded-md bg-[var(--cs-soft)] px-2 py-0.5 font-medium text-[var(--cs-soft-text)]">
            View only
          </span>
        </div>
        <p className="mt-3 text-sm leading-5 text-[var(--cs-muted)]">
          Your saved palettes stay private.
        </p>

        {error ? (
          <p role="alert" className="mt-3 text-sm leading-5 text-[var(--cs-danger)]">
            {error}
          </p>
        ) : null}

        <div className="mt-4">
          {url ? (
            <div className="flex flex-wrap gap-2">
              <input
                aria-label="Share link"
                readOnly
                value={url}
                onFocus={(event) => event.currentTarget.select()}
                className={`${STUDIO_FIELD} min-w-0 flex-1`}
              />
              <StudioButton onClick={() => void copy(url, "share-link", "link")}>
                Copy link
              </StudioButton>
            </div>
          ) : (
            <button
              type="button"
              disabled={creating}
              aria-busy={creating || undefined}
              onClick={() => void createLink()}
              className={`${studioButtonClasses("primary")} h-12! w-full text-base`}
            >
              {creating ? (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
              ) : null}
              Create share link
            </button>
          )}
        </div>
        <p className="mt-3 text-center text-sm leading-5 text-[var(--cs-muted)]">
          This shares a snapshot. Later edits won&apos;t change this link, and the link can&apos;t
          be removed.
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-[10px] text-sm leading-5 font-semibold hover:bg-[var(--cs-background)]"
        >
          {url ? "Done" : "Cancel"}
        </button>
      </Modal>
    </>
  );
}
