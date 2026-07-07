// -----------------------------------------------------------------------------
// @file: components/colors/save-palette-button.tsx
// @purpose: Session-gated "Save Palette" action. Renders nothing for signed-out
//           visitors (tools stay fully usable statelessly); signed-in users get
//           a name modal that POSTs to /api/colors/palettes.
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { Palette, PaletteSource } from "@/lib/colors";
import { formatHex } from "@/lib/colors";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { FormInput } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";

export function SavePaletteButton({
  palette,
  source,
  onSaved,
}: {
  palette: Palette;
  source: PaletteSource;
  onSaved?: () => void;
}) {
  const { data: session } = authClient.useSession();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  if (!session) return null; // signed-out visitors: no persistence UI

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch("/api/colors/palettes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          colors: palette.map((c) => formatHex(c.hex)),
          source,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Failed to save");
      }
      showToast({ type: "success", title: "Palette saved" });
      setOpen(false);
      setName("");
      onSaved?.();
    } catch {
      showToast({
        type: "error",
        title: "Couldn't save palette",
        description: "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        disabled={palette.length === 0}
        onClick={() => setOpen(true)}
      >
        Save palette
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} size="sm">
        <ModalHeader
          eyebrow="Color tools"
          title="Save this palette"
          onClose={() => setOpen(false)}
        />
        <div className="space-y-1.5 px-5 pb-2">
          <label
            htmlFor="save-palette-name"
            className="block text-xs font-medium text-[var(--bb-text-secondary)]"
          >
            Palette name
          </label>
          <FormInput
            id="save-palette-name"
            value={name}
            maxLength={80}
            placeholder="e.g. Autumn warmth"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
            autoFocus
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={saving}
            disabled={!name.trim()}
            onClick={() => void save()}
          >
            Save
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
