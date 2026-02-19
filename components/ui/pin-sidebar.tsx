// -----------------------------------------------------------------------------
// @file: components/ui/pin-sidebar.tsx
// @purpose: Pin list sidebar + mobile bottom sheet for lightbox pin annotations
//           Supports edit (customer), resolve (designer), and readonly modes
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { PinData } from "./pin-overlay";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PinSidebarProps = {
  pins: PinData[];
  mode: "edit" | "readonly" | "resolve";
  activePinOrder: number | null;
  onActivePinChange: (order: number | null) => void;
  onPinLabelChange?: (order: number, label: string) => void;
  onPinDelete?: (order: number) => void;
  onSubmitRevision?: () => void;
  onResolvePin?: (pin: PinData) => void;
  resolvingPinId?: string | null;
  onUploadWork?: () => void;
  submitting?: boolean;
  validationErrors?: Set<number>; // pin orders with empty labels
};

// ---------------------------------------------------------------------------
// Desktop sidebar
// ---------------------------------------------------------------------------

function PinList({
  pins,
  mode,
  activePinOrder,
  onActivePinChange,
  onPinLabelChange,
  onPinDelete,
  onResolvePin,
  resolvingPinId,
  validationErrors,
}: Omit<PinSidebarProps, "onSubmitRevision" | "submitting" | "onUploadWork">) {
  const listRef = useRef<HTMLDivElement>(null);
  const pinRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Auto-scroll to active pin
  useEffect(() => {
    if (activePinOrder == null) return;
    const el = pinRefs.current.get(activePinOrder);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activePinOrder]);

  const openCount = pins.filter((p) => p.status !== "RESOLVED").length;
  const resolvedCount = pins.filter((p) => p.status === "RESOLVED").length;

  if (pins.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#f15b2b]/10">
            <span className="text-lg">📌</span>
          </div>
          {mode === "edit" ? (
            <>
              <p className="text-xs font-medium text-[#424143]">
                Click on the image to add pins
              </p>
              <p className="mt-1 text-[10px] text-[#9a9892]">
                Mark areas that need changes and describe what you want different
              </p>
            </>
          ) : mode === "resolve" ? (
            <>
              <p className="text-xs font-medium text-[#424143]">
                No customer annotations
              </p>
              <p className="mt-1 text-[10px] text-[#9a9892]">
                There are no revision notes to review yet
              </p>
            </>
          ) : (
            <p className="text-xs text-[#9a9892]">No annotations</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
      {/* How-to instruction banner (edit mode) */}
      {mode === "edit" && (
        <div className="rounded-lg bg-[#f15b2b]/[0.06] px-3 py-2">
          <p className="text-[10px] leading-relaxed text-[#5a5953]">
            <span className="font-semibold text-[#f15b2b]">How it works:</span>{" "}
            Click on the image to place all your pins, add a note to each one, then press{" "}
            <span className="font-semibold">&quot;Send all notes&quot;</span> when you&apos;re done.
          </p>
        </div>
      )}

      {/* How-to instruction banner (resolve mode) */}
      {mode === "resolve" && (
        <div className="rounded-lg bg-[#32b37b]/[0.06] px-3 py-2">
          <p className="text-[10px] leading-relaxed text-[#5a5953]">
            Review customer feedback and mark each note as resolved when addressed.
          </p>
        </div>
      )}

      {/* All-resolved success banner */}
      {mode === "resolve" && openCount === 0 && resolvedCount > 0 && (
        <div className="rounded-lg bg-[#32b37b]/[0.08] px-3 py-2.5 text-center">
          <p className="text-[11px] font-semibold text-[#32b37b]">
            All notes addressed ✓
          </p>
          <p className="mt-0.5 text-[9px] text-[#32b37b]/70">
            Every revision note has been resolved
          </p>
        </div>
      )}

      {pins.map((pin) => {
        const isActive = activePinOrder === pin.order;
        const hasError = validationErrors?.has(pin.order);
        const isResolved = pin.status === "RESOLVED";
        const isResolving = resolvingPinId === pin.id;

        return (
          <div
            key={pin.order}
            ref={(el) => {
              if (el) pinRefs.current.set(pin.order, el);
            }}
            className={`group rounded-xl border p-2.5 transition-all
              ${isActive
                ? isResolved
                  ? "border-[#32b37b]/40 bg-[#32b37b]/[0.04] shadow-sm"
                  : "border-[#f15b2b]/40 bg-[#f15b2b]/[0.04] shadow-sm"
                : "border-[#e3e1dc] bg-white hover:border-[#d0cec9]"}
              ${hasError ? "border-red-300 bg-red-50/50" : ""}
            `}
            onClick={() => onActivePinChange(pin.order)}
          >
            <div className="mb-1.5 flex items-center gap-2">
              {/* Pin number badge */}
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white
                  ${isResolved ? "bg-[#32b37b]" : "bg-[#f15b2b]"}
                `}
              >
                {isResolved ? "✓" : pin.order}
              </div>

              {/* Label display (readonly and resolve modes) */}
              {mode === "readonly" || mode === "resolve" ? (
                <p className="flex-1 text-[11px] leading-snug text-[#424143]">
                  {pin.label || "No note"}
                </p>
              ) : (
                <span className="flex-1 text-[10px] font-medium text-[#9a9892]">
                  Pin {pin.order}
                </span>
              )}

              {/* Delete button (edit mode only) */}
              {mode === "edit" && onPinDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinDelete(pin.order);
                  }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#b1afa9] opacity-0 transition-opacity hover:bg-[#f5f3f0] hover:text-[#5a5953] group-hover:opacity-100"
                  aria-label={`Delete pin ${pin.order}`}
                >
                  ×
                </button>
              )}
            </div>

            {/* Textarea for note (edit mode) */}
            {mode === "edit" && (
              <textarea
                value={pin.label}
                onChange={(e) =>
                  onPinLabelChange?.(pin.order, e.target.value)
                }
                placeholder="Describe the change needed here..."
                className={`w-full resize-none rounded-lg border bg-white px-2.5 py-2 text-[11px] leading-snug text-[#424143] outline-none placeholder:text-[#b1afa9] transition-colors
                  ${hasError ? "border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200" : "border-[#e3e1dc] focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]/20"}
                `}
                rows={2}
                autoFocus={isActive}
                onFocus={() => onActivePinChange(pin.order)}
              />
            )}

            {/* Resolve button (resolve mode, OPEN pins only) */}
            {mode === "resolve" && !isResolved && onResolvePin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResolvePin(pin);
                }}
                disabled={isResolving}
                className="mt-2 w-full rounded-lg border border-[#f15b2b]/30 bg-[#f15b2b]/[0.06] px-2.5 py-1.5 text-[10px] font-semibold text-[#f15b2b] transition-colors hover:bg-[#f15b2b]/15 disabled:opacity-50"
              >
                {isResolving ? "Resolving..." : "Mark as resolved"}
              </button>
            )}

            {/* Resolved status indicator */}
            {isResolved && (
              <div className="mt-1 text-[9px] font-medium text-[#32b37b]">
                ✓ Resolved
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile bottom sheet
// ---------------------------------------------------------------------------

type SheetSnap = "collapsed" | "half" | "expanded";

export function PinBottomSheet({
  pins,
  mode,
  activePinOrder,
  onActivePinChange,
  onPinLabelChange,
  onPinDelete,
  onSubmitRevision,
  onResolvePin,
  resolvingPinId,
  onUploadWork,
  submitting,
  validationErrors,
  autoExpand,
}: PinSidebarProps & { autoExpand?: boolean }) {
  const [snap, setSnap] = useState<SheetSnap>("collapsed");
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartTranslate = useRef(0);

  // Auto-expand when new pin placed
  useEffect(() => {
    if (autoExpand && pins.length > 0) {
      setSnap("half");
    }
  }, [autoExpand, pins.length]);

  const snapHeights: Record<SheetSnap, string> = {
    collapsed: "56px",
    half: "50vh",
    expanded: "75vh",
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      dragStartY.current = e.touches[0].clientY;
      const el = sheetRef.current;
      if (el) {
        dragStartTranslate.current = el.getBoundingClientRect().top;
      }
    },
    [],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (dragStartY.current === null) return;
      // Prevent default to avoid scroll conflicts
      e.preventDefault();
    },
    [],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (dragStartY.current === null) return;
      const endY = e.changedTouches[0].clientY;
      const delta = dragStartY.current - endY;
      dragStartY.current = null;

      // Swipe up → expand, swipe down → collapse
      if (delta > 50) {
        setSnap((s) =>
          s === "collapsed" ? "half" : s === "half" ? "expanded" : "expanded",
        );
      } else if (delta < -50) {
        setSnap((s) =>
          s === "expanded" ? "half" : s === "half" ? "collapsed" : "collapsed",
        );
      }
    },
    [],
  );

  const toggleSnap = useCallback(() => {
    setSnap((s) => (s === "collapsed" ? "half" : "collapsed"));
  }, []);

  const openCount = pins.filter((p) => p.status !== "RESOLVED").length;
  const resolvedCount = pins.filter((p) => p.status === "RESOLVED").length;

  return (
    <div
      ref={sheetRef}
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border-t border-[#e3e1dc] bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 ease-out md:hidden"
      style={{ height: snapHeights[snap] }}
    >
      {/* Drag handle */}
      <div
        className="flex shrink-0 cursor-grab items-center justify-between px-4 py-2.5"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={toggleSnap}
      >
        <div className="flex items-center gap-2">
          {/* Handle bar */}
          <div className="mx-auto h-1 w-8 rounded-full bg-[#d0cec9]" />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-[#5a5953]">
            {mode === "resolve" && pins.length > 0
              ? `${openCount} open, ${resolvedCount} resolved`
              : pins.length > 0
                ? `${pins.length} note${pins.length > 1 ? "s" : ""}`
                : "No pins yet"}
          </span>

          {mode === "edit" && onSubmitRevision && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSubmitRevision();
              }}
              disabled={pins.length === 0 || submitting}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white transition-colors
                ${pins.length > 0 && !submitting ? "bg-[#f15b2b] hover:bg-[#d94e24]" : "bg-[#d0cec9] cursor-not-allowed"}
              `}
            >
              {submitting ? "Sending..." : "Send all notes"}
            </button>
          )}

          {mode === "resolve" && onUploadWork && openCount === 0 && resolvedCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUploadWork();
              }}
              className="rounded-lg bg-[#f15b2b] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#d94e24]"
            >
              Upload new revision
            </button>
          )}
        </div>
      </div>

      {/* Scrollable pin list (visible when expanded) */}
      {snap !== "collapsed" && (
        <div className="flex-1 overflow-hidden">
          <PinList
            pins={pins}
            mode={mode}
            activePinOrder={activePinOrder}
            onActivePinChange={onActivePinChange}
            onPinLabelChange={onPinLabelChange}
            onPinDelete={onPinDelete}
            onResolvePin={onResolvePin}
            resolvingPinId={resolvingPinId}
            validationErrors={validationErrors}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop sidebar (exported)
// ---------------------------------------------------------------------------

export function PinSidebar({
  pins,
  mode,
  activePinOrder,
  onActivePinChange,
  onPinLabelChange,
  onPinDelete,
  onSubmitRevision,
  onResolvePin,
  resolvingPinId,
  onUploadWork,
  submitting,
  validationErrors,
}: PinSidebarProps) {
  const openCount = pins.filter((p) => p.status !== "RESOLVED").length;
  const resolvedCount = pins.filter((p) => p.status === "RESOLVED").length;

  return (
    <div className="hidden md:flex md:w-80 md:shrink-0 md:flex-col md:rounded-xl md:border md:border-[#e3e1dc] md:bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#f0eee9] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
            {mode === "resolve" ? "Designer review" : "Revision notes"}
          </span>
          {pins.length > 0 && mode !== "resolve" && (
            <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#f15b2b] px-1.5 text-[9px] font-bold text-white">
              {pins.length}
            </span>
          )}
          {mode === "resolve" && pins.length > 0 && (
            <div className="flex items-center gap-1">
              {openCount > 0 && (
                <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#f15b2b] px-1.5 text-[9px] font-bold text-white">
                  {openCount}
                </span>
              )}
              {resolvedCount > 0 && (
                <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#32b37b] px-1.5 text-[9px] font-bold text-white">
                  {resolvedCount}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pin list */}
      <PinList
        pins={pins}
        mode={mode}
        activePinOrder={activePinOrder}
        onActivePinChange={onActivePinChange}
        onPinLabelChange={onPinLabelChange}
        onPinDelete={onPinDelete}
        onResolvePin={onResolvePin}
        resolvingPinId={resolvingPinId}
        validationErrors={validationErrors}
      />

      {/* Footer with upload work button (resolve mode, all pins resolved) */}
      {mode === "resolve" && onUploadWork && (() => {
        const allResolved = pins.length > 0 && pins.every((p) => p.status === "RESOLVED");
        if (!allResolved) return null;
        return (
          <div className="shrink-0 border-t border-[#f0eee9] px-4 py-3">
            <button
              type="button"
              onClick={onUploadWork}
              className="w-full rounded-xl bg-[#f15b2b] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#d94e24]"
            >
              Upload new revision
            </button>
            <p className="mt-1.5 text-center text-[9px] text-[#b1afa9]">
              Ready to upload your updated designs
            </p>
          </div>
        );
      })()}

      {/* Footer with submit button (edit mode only) */}
      {mode === "edit" && onSubmitRevision && (
        <div className="shrink-0 border-t border-[#f0eee9] px-4 py-3">
          <button
            type="button"
            onClick={onSubmitRevision}
            disabled={pins.length === 0 || submitting}
            className={`w-full rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-all
              ${pins.length > 0 && !submitting ? "bg-[#f15b2b] hover:bg-[#d94e24] shadow-sm" : "bg-[#d0cec9] cursor-not-allowed"}
            `}
          >
            {submitting
              ? "Sending all notes..."
              : pins.length > 0
                ? `Send all notes (${pins.length})`
                : "Send all notes"}
          </button>
          {pins.length > 0 && !submitting && (
            <p className="mt-1.5 text-center text-[9px] text-[#b1afa9]">
              Done pinning? This will send all your notes to the designer
            </p>
          )}
        </div>
      )}
    </div>
  );
}
