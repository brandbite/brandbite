"use client";

import React, { useState } from "react";
import { Modal, ModalHeader } from "@/components/ui/modal";
import type { ColorCardData } from "@/lib/moodboard";
import { COLOR_PRESETS } from "@/lib/moodboard";

type AddColorModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: ColorCardData) => void;
};

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function AddColorModal({ open, onClose, onSave }: AddColorModalProps) {
  const [hex, setHex] = useState("#");
  const [name, setName] = useState("");

  function handleClose() {
    setHex("#");
    setName("");
    onClose();
  }

  function handleSave() {
    const trimmedHex = hex.trim();
    if (!HEX_REGEX.test(trimmedHex)) return;

    onSave({
      hex: trimmedHex.toUpperCase(),
      name: name.trim() || undefined,
    });

    setHex("#");
    setName("");
    onClose();
  }

  function selectPreset(preset: { hex: string; name: string }) {
    setHex(preset.hex);
    setName(preset.name);
  }

  const isValidHex = HEX_REGEX.test(hex.trim());

  return (
    <Modal open={open} onClose={handleClose} size="md">
      <ModalHeader title="Add Color" onClose={handleClose} />

      <div className="space-y-4">
        {/* Live preview + hex input */}
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 flex-shrink-0 rounded-lg border border-[var(--bb-border)]"
            style={{
              backgroundColor: isValidHex ? hex.trim() : "#ffffff",
            }}
          />
          <input
            type="text"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            placeholder="#F15B2B"
            className="flex-1 rounded-lg border border-[var(--bb-border)] bg-white px-3 py-2 font-mono text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400 focus:border-[var(--bb-primary)]"
          />
        </div>

        {/* Name input */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Color name (optional)"
          className="w-full rounded-lg border border-[var(--bb-border)] bg-white px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400 focus:border-[var(--bb-primary)]"
        />

        {/* Preset swatches */}
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--bb-text-secondary)]">Presets</p>
          <div className="grid grid-cols-6 gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => selectPreset(preset)}
                title={preset.name}
                className={`h-8 w-full rounded-lg border transition-transform hover:scale-110 ${
                  hex.toUpperCase() === preset.hex.toUpperCase()
                    ? "border-[var(--bb-primary)] ring-2 ring-[var(--bb-primary)]/30"
                    : "border-[var(--bb-border)]"
                }`}
                style={{ backgroundColor: preset.hex }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={handleClose}
          className="rounded-lg border border-[var(--bb-border)] px-4 py-2 text-sm font-medium text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-bg-warm)]"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isValidHex}
          className="rounded-lg bg-[var(--bb-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--bb-primary-hover)] disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
