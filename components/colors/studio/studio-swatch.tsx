// -----------------------------------------------------------------------------
// @file: components/colors/studio/studio-swatch.tsx
// @purpose: Color card with separate interactions: the color area copies HEX,
//           the edit icon opens the inspector, and lock and move are their own
//           controls. Labels name the action a control performs. Selection uses
//           a frame and a check mark, so it isn't conveyed by color alone.
// -----------------------------------------------------------------------------

"use client";

import { formatHex, readableTextOn } from "@/lib/colors";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  EditIcon,
  LockIcon,
  UnlockIcon,
} from "./icons";
import { useStudioCopy } from "./use-studio-copy";

const ICON_BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[var(--cs-muted)] hover:text-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-40";

export function StudioSwatch({
  hex,
  selected = false,
  locked = false,
  onToggleLock,
  onEdit,
  onMoveLeft,
  onMoveRight,
}: {
  hex: string;
  selected?: boolean;
  locked?: boolean;
  onToggleLock?: () => void;
  onEdit?: () => void;
  /** Keyboard alternative to dragging. Pass null at the end of the row to disable. */
  onMoveLeft?: (() => void) | null;
  onMoveRight?: (() => void) | null;
}) {
  const label = formatHex(hex);
  const { copy, isCopied } = useStudioCopy();
  const copied = isCopied("swatch");
  const showMove = onMoveLeft !== undefined || onMoveRight !== undefined;

  return (
    <div
      className={`min-w-0 overflow-hidden rounded-2xl border bg-[var(--cs-surface)] ${
        selected
          ? "border-[var(--cs-text)] outline-2 outline-offset-2 outline-[var(--cs-text)]"
          : "border-[var(--cs-border)]"
      }`}
    >
      <div className="relative">
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={() => void copy(label, "swatch")}
          className="block h-40 w-full cursor-copy"
          style={{ backgroundColor: hex }}
        />
        {onToggleLock ? (
          <button
            type="button"
            aria-pressed={locked}
            onClick={onToggleLock}
            className="absolute top-2 left-2 flex h-11 items-center gap-1.5 rounded-[10px] bg-[var(--cs-surface)] px-3 text-sm leading-5 font-medium text-[var(--cs-text)]"
          >
            {locked ? <UnlockIcon /> : <LockIcon />}
            {locked ? "Unlock" : "Lock"}
          </button>
        ) : null}
        {selected ? (
          <span
            className="pointer-events-none absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: readableTextOn(hex), color: hex }}
          >
            <CheckIcon />
            <span className="sr-only">Selected</span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1 py-1 pr-1 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-sm leading-5 select-text">
          {label}
        </span>
        <button
          type="button"
          aria-label={`Copy ${label} value`}
          onClick={() => void copy(label, "value")}
          className={ICON_BUTTON}
        >
          {isCopied("value") || copied ? <CheckIcon /> : <CopyIcon />}
        </button>
        {onEdit ? (
          <button
            type="button"
            aria-label={`Edit ${label}`}
            onClick={onEdit}
            className={ICON_BUTTON}
          >
            <EditIcon />
          </button>
        ) : null}
      </div>
      {showMove ? (
        <div className="flex justify-between border-t border-[var(--cs-border)] p-1">
          <button
            type="button"
            aria-label={`Move ${label} left`}
            disabled={!onMoveLeft}
            onClick={onMoveLeft ?? undefined}
            className={ICON_BUTTON}
          >
            <ArrowLeftIcon />
          </button>
          <button
            type="button"
            aria-label={`Move ${label} right`}
            disabled={!onMoveRight}
            onClick={onMoveRight ?? undefined}
            className={ICON_BUTTON}
          >
            <ArrowRightIcon />
          </button>
        </div>
      ) : null}
    </div>
  );
}
