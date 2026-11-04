// -----------------------------------------------------------------------------
// @file: components/colors/studio/open-palette.tsx
// @purpose: Move a palette into another tool through the shared workspace. If the
//           workspace holds unsaved changes to a different palette, asks first:
//           Save changes, Discard, or Keep working.
// -----------------------------------------------------------------------------

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";
import type { StudioPalette } from "@/lib/colors";

import { StudioButton } from "./studio-button";
import { useWorkspace, workspaceActions } from "./workspace-store";

type PendingOpen = { palette: StudioPalette; href: string; selectedColorId?: string };

/** `save` persists the workspace's palette and reports whether that worked. */
export function usePaletteOpener(save: (palette: StudioPalette) => Promise<boolean>) {
  const router = useRouter();
  const workspace = useWorkspace();
  const [pending, setPending] = useState<PendingOpen | null>(null);

  const open = ({ palette, href, selectedColorId }: PendingOpen) => {
    workspaceActions.load(palette, selectedColorId);
    router.push(href);
  };

  const requestOpen = (palette: StudioPalette, href: string, selectedColorId?: string) => {
    if (workspace.dirty && workspace.activePalette?.id !== palette.id) {
      setPending({ palette, href, selectedColorId });
    } else {
      open({ palette, href, selectedColorId });
    }
  };

  const saveThenOpen = async () => {
    if (!pending || !workspace.activePalette) return;
    const saved = await save(workspace.activePalette);
    if (saved) open(pending);
    else setPending(null);
  };

  const dialog = (
    <Modal open={pending !== null} onClose={() => setPending(null)} size="sm">
      <ModalHeader
        title="You have unsaved changes"
        subtitle={`Opening this palette would replace "${workspace.activePalette?.name ?? ""}".`}
        onClose={() => setPending(null)}
      />
      <ModalFooter>
        <StudioButton variant="secondary" onClick={() => setPending(null)}>
          Keep working
        </StudioButton>
        <StudioButton variant="danger" onClick={() => pending && open(pending)}>
          Discard
        </StudioButton>
        <StudioButton onClick={() => void saveThenOpen()}>Save changes</StudioButton>
      </ModalFooter>
    </Modal>
  );

  return { requestOpen, dialog };
}
