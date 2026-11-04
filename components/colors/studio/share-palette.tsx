// -----------------------------------------------------------------------------
// @file: components/colors/studio/share-palette.tsx
// @purpose: Share one palette by link. What the link exposes is explained before
//           it exists, and copying only becomes available after the server has
//           created the snapshot.
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import { Modal, ModalHeader } from "@/components/ui/modal";
import type { StudioPalette } from "@/lib/colors";

import { STUDIO_FIELD } from "./palette-parts";
import { StudioButton } from "./studio-button";
import { useStudioCopy } from "./use-studio-copy";

export function SharePaletteButton({ palette }: { palette: StudioPalette }) {
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
        variant="secondary"
        onClick={() => {
          setUrl(null);
          setError(null);
          setOpen(true);
        }}
      >
        Share
      </StudioButton>
      <Modal open={open} onClose={() => setOpen(false)} size="md">
        <ModalHeader
          title={`Share ${palette.name}`}
          subtitle="Anyone with this link can view this snapshot."
          onClose={() => setOpen(false)}
        />
        <p className="text-sm leading-5">
          The link shares only this palette&apos;s name, colors and roles. New edits require a new
          link, and links can&apos;t be removed once created.
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm leading-5 text-[#B42318]">
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
            <StudioButton loading={creating} onClick={() => void createLink()}>
              Create link
            </StudioButton>
          )}
        </div>
      </Modal>
    </>
  );
}
