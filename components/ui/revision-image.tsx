// -----------------------------------------------------------------------------
// @file: components/ui/revision-image.tsx
// @purpose: Revision asset thumbnail grid with presigned URL fallback, lightbox,
//           pin annotation support (edit for customers, resolve for creatives, readonly)
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PinOverlay, type PinData } from "./pin-overlay";
import { PinSidebar, PinBottomSheet } from "./pin-sidebar";
import {
  downloadSingleAsset,
  downloadAssetsAsZip,
} from "@/lib/download-helpers";

// ---------------------------------------------------------------------------
// Download icon SVG (arrow-down to tray)
// ---------------------------------------------------------------------------

function DownloadIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M10 3a.75.75 0 0 1 .75.75v7.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V3.75A.75.75 0 0 1 10 3Z" />
      <path d="M3 15.75a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssetEntry = {
  id: string;
  url: string | null;
  originalName: string | null;
  pinCount?: number;
};

// ---------------------------------------------------------------------------
// useResolvedSrc — resolves public URL or fetches presigned download URL
// ---------------------------------------------------------------------------

function useResolvedSrc(assetId: string, url: string | null) {
  const [src, setSrc] = useState<string | null>(url);
  const [loading, setLoading] = useState(!url);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (url) {
      setSrc(url);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/assets/${assetId}/download`);
        const json = await res.json().catch(() => null);

        if (!cancelled && res.ok && json?.downloadUrl) {
          setSrc(json.downloadUrl);
        } else if (!cancelled) {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assetId, url]);

  return { src, loading, error };
}

// ---------------------------------------------------------------------------
// RevisionImage — single thumbnail (used inside the grid)
// ---------------------------------------------------------------------------

type RevisionImageProps = {
  assetId: string;
  url: string | null;
  alt: string;
  className?: string;
  onClick?: () => void;
};

export function RevisionImage({
  assetId,
  url,
  alt,
  className = "h-16 w-full object-cover",
  onClick,
}: RevisionImageProps) {
  const { src, loading, error } = useResolvedSrc(assetId, url);

  if (loading) {
    return (
      <div className="flex h-16 w-full items-center justify-center">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#e3e1dc] border-t-[#9a9892]" />
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className="flex h-16 w-full items-center justify-center text-[9px] text-[#b1afa9]">
        Image
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} ${onClick ? "cursor-pointer" : ""}`}
      loading="lazy"
      onClick={onClick}
    />
  );
}

// ---------------------------------------------------------------------------
// LightboxImage — full-size image inside lightbox (resolves its own URL)
// Returns an <img> element for use inside PinOverlay
// ---------------------------------------------------------------------------

function LightboxImage({
  assetId,
  url,
  alt,
  hasPins,
}: {
  assetId: string;
  url: string | null;
  alt: string;
  hasPins?: boolean;
}) {
  const { src, loading, error } = useResolvedSrc(assetId, url);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className="rounded-xl bg-white/10 px-6 py-10 text-sm text-white/60">
        Failed to load image
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`rounded-lg object-contain shadow-2xl ${hasPins ? "max-h-[80vh] w-full" : "max-h-[85vh] max-w-[90vw]"}`}
    />
  );
}

// ---------------------------------------------------------------------------
// ImageLightbox — fullscreen overlay with pin support
// ---------------------------------------------------------------------------

type PinMode = "review" | "view" | "resolve";

type ImageLightboxProps = {
  assets: AssetEntry[];
  initialIndex: number;
  onClose: () => void;
  pinMode?: PinMode;
  ticketId?: string;
  onRevisionSubmitted?: () => void;
  onUploadWork?: () => void;
};

function ImageLightbox({
  assets,
  initialIndex,
  onClose,
  pinMode,
  ticketId,
  onRevisionSubmitted,
  onUploadWork,
}: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const asset = assets[index];
  const hasMultiple = assets.length > 1;

  // Pin state — keyed by asset ID so navigating between images preserves pins
  const [pinsPerAsset, setPinsPerAsset] = useState<Record<string, PinData[]>>(
    {},
  );
  const [activePinOrder, setActivePinOrder] = useState<number | null>(null);
  const [existingPinsLoaded, setExistingPinsLoaded] = useState<Set<string>>(
    new Set(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<number>>(
    new Set(),
  );
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [mobileAutoExpand, setMobileAutoExpand] = useState(false);
  const [resolvingPinId, setResolvingPinId] = useState<string | null>(null);
  const [lightboxDownloading, setLightboxDownloading] = useState(false);

  const currentPins = pinsPerAsset[asset.id] ?? [];
  const isEditMode = pinMode === "review";
  const isResolveMode = pinMode === "resolve";
  const hasPinUI = isEditMode || pinMode === "view" || isResolveMode;

  // Total pins across all assets (for discard guard)
  const totalNewPins = Object.values(pinsPerAsset).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  // Fetch existing pins for the current asset
  useEffect(() => {
    if (!hasPinUI) return;
    if (existingPinsLoaded.has(asset.id)) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/assets/${asset.id}/pins`);
        const json = await res.json().catch(() => null);

        if (!cancelled && res.ok && json?.pins?.length > 0) {
          const fetched: PinData[] = json.pins.map((p: any) => ({
            id: p.id,
            x: p.x,
            y: p.y,
            order: p.order,
            label: p.label ?? "",
            status: p.status,
          }));
          setPinsPerAsset((prev) => ({
            ...prev,
            [asset.id]: fetched,
          }));
        }
      } catch {
        // Silently fail — pins are optional
      }
      if (!cancelled) {
        setExistingPinsLoaded((prev) => new Set(prev).add(asset.id));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [asset.id, hasPinUI, existingPinsLoaded]);

  // Navigation
  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : assets.length - 1));
    setActivePinOrder(null);
  }, [assets.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i < assets.length - 1 ? i + 1 : 0));
    setActivePinOrder(null);
  }, [assets.length]);

  // Close with discard guard
  const handleClose = useCallback(() => {
    if (isEditMode && totalNewPins > 0) {
      // Check if any pins are new (no id = unsaved)
      const hasUnsaved = Object.values(pinsPerAsset).some((pins) =>
        pins.some((p) => !p.id),
      );
      if (hasUnsaved) {
        setShowDiscardConfirm(true);
        return;
      }
    }
    onClose();
  }, [isEditMode, totalNewPins, pinsPerAsset, onClose]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showDiscardConfirm) return;
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        isEditMode &&
        activePinOrder != null
      ) {
        // Only delete if not focused on a textarea
        const active = document.activeElement;
        if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) return;
        handlePinDelete(activePinOrder);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleClose, goPrev, goNext, isEditMode, activePinOrder, showDiscardConfirm]);

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Pin placement
  const handleImageClick = useCallback(
    (x: number, y: number) => {
      if (!isEditMode) return;
      const existing = pinsPerAsset[asset.id] ?? [];
      const nextOrder =
        existing.length > 0
          ? Math.max(...existing.map((p) => p.order)) + 1
          : 1;
      const newPin: PinData = { x, y, order: nextOrder, label: "" };

      setPinsPerAsset((prev) => ({
        ...prev,
        [asset.id]: [...(prev[asset.id] ?? []), newPin],
      }));
      setActivePinOrder(nextOrder);
      setMobileAutoExpand(true);
      // Clear validation error for this pin
      setValidationErrors((prev) => {
        const next = new Set(prev);
        next.delete(nextOrder);
        return next;
      });
    },
    [isEditMode, asset.id, pinsPerAsset],
  );

  const handlePinClick = useCallback((pin: PinData) => {
    setActivePinOrder(pin.order);
  }, []);

  const handlePinLabelChange = useCallback(
    (order: number, label: string) => {
      setPinsPerAsset((prev) => ({
        ...prev,
        [asset.id]: (prev[asset.id] ?? []).map((p) =>
          p.order === order ? { ...p, label } : p,
        ),
      }));
      // Clear validation error when user types
      setValidationErrors((prev) => {
        const next = new Set(prev);
        next.delete(order);
        return next;
      });
    },
    [asset.id],
  );

  const handlePinDelete = useCallback(
    (order: number) => {
      setPinsPerAsset((prev) => {
        const filtered = (prev[asset.id] ?? []).filter(
          (p) => p.order !== order,
        );
        // Re-order remaining pins sequentially
        const reordered = filtered.map((p, i) => ({ ...p, order: i + 1 }));
        return { ...prev, [asset.id]: reordered };
      });
      setActivePinOrder(null);
    },
    [asset.id],
  );

  // Resolve a single pin (creative mode)
  const handleResolvePin = useCallback(
    async (pin: PinData) => {
      if (!pin.id || resolvingPinId) return;
      setResolvingPinId(pin.id);
      try {
        const res = await fetch(`/api/assets/${asset.id}/pins`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinId: pin.id }),
        });
        if (res.ok) {
          setPinsPerAsset((prev) => ({
            ...prev,
            [asset.id]: (prev[asset.id] ?? []).map((p) =>
              p.id === pin.id ? { ...p, status: "RESOLVED" as const } : p,
            ),
          }));
        }
      } catch (err) {
        console.error("[Lightbox] resolve pin error:", err);
      } finally {
        setResolvingPinId(null);
      }
    },
    [asset.id, resolvingPinId],
  );

  // Submit revision
  const handleSubmitRevision = useCallback(async () => {
    // Collect all pins across all assets
    const allAssetPins = Object.entries(pinsPerAsset).filter(
      ([, pins]) => pins.length > 0 && pins.some((p) => !p.id), // only assets with new pins
    );

    if (allAssetPins.length === 0) return;

    // Validate: all pins must have labels
    for (const [assetId, pins] of allAssetPins) {
      const empty = pins.filter((p) => !p.id && !p.label.trim());
      if (empty.length > 0) {
        // Navigate to the first asset with empty pins
        const assetIndex = assets.findIndex((a) => a.id === assetId);
        if (assetIndex >= 0) setIndex(assetIndex);
        setActivePinOrder(empty[0].order);
        setValidationErrors(new Set(empty.map((p) => p.order)));
        return;
      }
    }

    setSubmitting(true);

    try {
      for (let i = 0; i < allAssetPins.length; i++) {
        const [assetId, pins] = allAssetPins[i];
        const newPins = pins.filter((p) => !p.id); // only unsaved pins
        if (newPins.length === 0) continue;

        const isLast = i === allAssetPins.length - 1;

        const res = await fetch(`/api/assets/${assetId}/pins`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pins: newPins.map((p) => ({
              x: p.x,
              y: p.y,
              order: p.order,
              label: p.label.trim(),
            })),
            ticketId,
            submitRevision: isLast, // only submit on last batch
            revisionMessage: `${newPins.length} pin annotation${newPins.length > 1 ? "s" : ""} placed`,
          }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error || "Failed to save pins");
        }
      }

      onRevisionSubmitted?.();
      onClose();
    } catch (err) {
      console.error("[Lightbox] submit revision error:", err);
    } finally {
      setSubmitting(false);
    }
  }, [pinsPerAsset, assets, ticketId, onRevisionSubmitted, onClose]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const sidebarMode = isEditMode ? "edit" : isResolveMode ? "resolve" : "readonly";

  const sidebarProps = {
    pins: currentPins,
    mode: sidebarMode as "edit" | "readonly" | "resolve",
    activePinOrder,
    onActivePinChange: setActivePinOrder,
    onPinLabelChange: isEditMode ? handlePinLabelChange : undefined,
    onPinDelete: isEditMode ? handlePinDelete : undefined,
    onSubmitRevision: isEditMode ? handleSubmitRevision : undefined,
    onResolvePin: isResolveMode ? handleResolvePin : undefined,
    resolvingPinId: isResolveMode ? resolvingPinId : undefined,
    onUploadWork: isResolveMode && onUploadWork ? () => {
      onClose();
      onUploadWork();
    } : undefined,
    submitting,
    validationErrors,
  };

  const showSidebar = hasPinUI;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !showDiscardConfirm) handleClose();
      }}
    >
      {/* Discard confirmation overlay */}
      {showDiscardConfirm && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-sm font-semibold text-[#424143]">
              Discard revision notes?
            </p>
            <p className="mt-1.5 text-xs text-[#9a9892]">
              You have unsaved pin annotations that will be lost.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="rounded-lg border border-[#e3e1dc] px-3.5 py-1.5 text-xs font-medium text-[#424143] hover:bg-[#f7f5f0]"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-[#f15b2b] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#d94e24]"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-3">
        {/* Counter */}
        {hasMultiple ? (
          <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
            {index + 1} / {assets.length}
          </div>
        ) : (
          <div />
        )}

        {/* Right-side toolbar */}
        <div className="flex items-center gap-2">
          {/* Download current image */}
          <button
            type="button"
            onClick={async () => {
              setLightboxDownloading(true);
              try {
                await downloadSingleAsset(
                  asset.id,
                  asset.originalName || `image-${index + 1}`,
                );
              } catch (err) {
                console.error("[Lightbox] download error:", err);
              } finally {
                setLightboxDownloading(false);
              }
            }}
            disabled={lightboxDownloading}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-50"
            aria-label="Download"
            title={`Download ${asset.originalName || "image"}`}
          >
            {lightboxDownloading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <DownloadIcon className="h-4 w-4" />
            )}
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div
        className={`flex w-full items-center justify-center px-4 ${showSidebar ? "md:gap-4" : ""}`}
        style={{ height: "calc(100vh - 100px)", marginTop: "48px" }}
      >
        {/* Prev arrow */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="z-10 hidden shrink-0 items-center justify-center rounded-full bg-white/10 text-xl text-white/80 transition-colors hover:bg-white/20 hover:text-white md:flex md:h-10 md:w-10"
            aria-label="Previous image"
          >
            &#8249;
          </button>
        )}

        {/* Image area (with or without pin overlay) */}
        <div
          className={`relative flex max-h-full flex-1 items-center justify-center overflow-hidden ${showSidebar ? "md:flex-[1_1_0%]" : ""}`}
          onClick={(e) => {
            // Only close if clicking the background, not the image area
            if (!showSidebar && e.target === e.currentTarget) handleClose();
          }}
        >
          {hasPinUI ? (
            <PinOverlay
              pins={currentPins}
              mode={isEditMode ? "edit" : "readonly"}
              activePinOrder={activePinOrder}
              onPinClick={handlePinClick}
              onImageClick={isEditMode ? handleImageClick : undefined}
              resolveMode={isResolveMode}
            >
              <LightboxImage
                key={asset.id}
                assetId={asset.id}
                url={asset.url}
                alt={asset.originalName || "Output"}
                hasPins
              />
            </PinOverlay>
          ) : (
            <LightboxImage
              key={asset.id}
              assetId={asset.id}
              url={asset.url}
              alt={asset.originalName || "Output"}
            />
          )}
        </div>

        {/* Desktop sidebar */}
        {showSidebar && <PinSidebar {...sidebarProps} />}

        {/* Next arrow */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="z-10 hidden shrink-0 items-center justify-center rounded-full bg-white/10 text-xl text-white/80 transition-colors hover:bg-white/20 hover:text-white md:flex md:h-10 md:w-10"
            aria-label="Next image"
          >
            &#8250;
          </button>
        )}
      </div>

      {/* Mobile nav arrows (smaller, overlaid) */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-lg text-white/80 transition-colors hover:bg-white/20 md:hidden"
            aria-label="Previous image"
          >
            &#8249;
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-lg text-white/80 transition-colors hover:bg-white/20 md:hidden"
            aria-label="Next image"
          >
            &#8250;
          </button>
        </>
      )}

      {/* Filename */}
      {asset.originalName && (
        <div className="absolute bottom-16 left-1/2 z-10 max-w-[80vw] -translate-x-1/2 truncate rounded-full bg-white/10 px-3 py-1 text-xs text-white/70 md:bottom-4">
          {asset.originalName}
        </div>
      )}

      {/* Mobile bottom sheet */}
      {showSidebar && (
        <PinBottomSheet {...sidebarProps} autoExpand={mobileAutoExpand} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RevisionImageGrid — thumbnail grid with click-to-lightbox & pin mode
// ---------------------------------------------------------------------------

type RevisionImageGridProps = {
  assets: AssetEntry[];
  /** "review" = customer can place pins, "resolve" = creative can resolve pins, "view" = readonly */
  pinMode?: PinMode;
  /** Ticket ID needed for revision submission */
  ticketId?: string;
  /** Callback when revision is submitted through the lightbox */
  onRevisionSubmitted?: () => void;
  /** Callback for creatives to open upload modal after resolving all pins */
  onUploadWork?: () => void;
};

export function RevisionImageGrid({
  assets,
  pinMode,
  ticketId,
  onRevisionSubmitted,
  onUploadWork,
}: RevisionImageGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (!assets || assets.length === 0) return null;

  const handleDownload = async (assetId: string, filename: string) => {
    setDownloadingId(assetId);
    try {
      await downloadSingleAsset(assetId, filename);
    } catch (err) {
      console.error("[RevisionImageGrid] download error:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {assets.map((asset, i) => (
          <div
            key={asset.id}
            className="group relative overflow-hidden rounded-lg border border-[#e3e1dc] bg-[#f5f3f0]"
          >
            <RevisionImage
              assetId={asset.id}
              url={asset.url}
              alt={asset.originalName || "Output"}
              onClick={() => setLightboxIndex(i)}
            />
            {/* Hover overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/15">
              <span className="scale-0 text-lg text-white drop-shadow transition-transform group-hover:scale-100">
                &#x2922;
              </span>
            </div>
            {/* Download button — always visible, enhanced on hover */}
            <button
              type="button"
              className="pointer-events-auto absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/20 text-white/70 backdrop-blur-sm transition-all group-hover:h-6 group-hover:w-6 group-hover:bg-black/50 group-hover:text-white hover:!bg-black/70"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(asset.id, asset.originalName || `image-${i + 1}`);
              }}
              aria-label="Download"
              title="Download"
            >
              {downloadingId === asset.id ? (
                <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-white border-t-transparent" />
              ) : (
                <DownloadIcon className="h-3 w-3" />
              )}
            </button>
            {/* Pin count badge */}
            {asset.pinCount != null && asset.pinCount > 0 && (
              <div className="absolute left-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#f15b2b] px-1 text-[8px] font-bold text-white shadow-sm">
                📌 {asset.pinCount}
              </div>
            )}
          </div>
        ))}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          assets={assets}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          pinMode={pinMode}
          ticketId={ticketId}
          onRevisionSubmitted={onRevisionSubmitted}
          onUploadWork={onUploadWork}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// RevisionImageLarge — larger single-column display for "current version"
// ---------------------------------------------------------------------------

export function RevisionImageLarge({
  assets,
  pinMode,
  ticketId,
  onRevisionSubmitted,
  onUploadWork,
}: RevisionImageGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (!assets || assets.length === 0) return null;

  const handleDownload = async (assetId: string, filename: string) => {
    setDownloadingId(assetId);
    try {
      await downloadSingleAsset(assetId, filename);
    } catch (err) {
      console.error("[RevisionImageLarge] download error:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <div className="mt-3 space-y-2.5">
        {assets.map((asset, i) => (
          <div
            key={asset.id}
            className="group relative max-w-[600px] cursor-pointer overflow-hidden rounded-xl border border-[#e3e1dc] bg-[#f5f3f0]"
            onClick={() => setLightboxIndex(i)}
          >
            <RevisionImage
              assetId={asset.id}
              url={asset.url}
              alt={asset.originalName || "Output"}
              className="w-full object-contain"
            />
            {/* Hover overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
              <span className="scale-0 text-xl text-white drop-shadow-lg transition-transform group-hover:scale-100">
                &#x2922;
              </span>
            </div>
            {/* Download button — always visible, enhanced on hover */}
            <button
              type="button"
              className="pointer-events-auto absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/20 text-white/70 backdrop-blur-sm transition-all group-hover:h-8 group-hover:w-8 group-hover:bg-black/50 group-hover:text-white hover:!bg-black/70"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(asset.id, asset.originalName || `image-${i + 1}`);
              }}
              aria-label="Download"
              title="Download"
            >
              {downloadingId === asset.id ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white border-t-transparent" />
              ) : (
                <DownloadIcon />
              )}
            </button>
            {/* Pin count badge */}
            {asset.pinCount != null && asset.pinCount > 0 && (
              <div className="absolute left-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#f15b2b] px-1.5 text-[9px] font-bold text-white shadow-sm">
                📌 {asset.pinCount}
              </div>
            )}
          </div>
        ))}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          assets={assets}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          pinMode={pinMode}
          ticketId={ticketId}
          onRevisionSubmitted={onRevisionSubmitted}
          onUploadWork={onUploadWork}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// DownloadAllButton — zip download for a set of assets (brief or revision)
// ---------------------------------------------------------------------------

export function DownloadAllButton({
  assets,
  zipFilename,
  className = "",
}: {
  assets: AssetEntry[];
  zipFilename: string;
  className?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  if (!assets || assets.length < 2) return null;

  const handleClick = async () => {
    setDownloading(true);
    try {
      await downloadAssetsAsZip(assets, zipFilename);
    } catch (err) {
      console.error("[DownloadAllButton] zip download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={downloading}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#d0cec9] bg-[#f9f8f6] px-3 py-1.5 text-xs font-medium text-[#666] transition-colors hover:border-[#f15b2b] hover:bg-[#fff5f2] hover:text-[#f15b2b] disabled:opacity-50 ${className}`}
    >
      {downloading ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
          Zipping…
        </>
      ) : (
        <>
          <DownloadIcon className="h-3.5 w-3.5" />
          Download all ({assets.length})
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// BriefThumbnailRow — compact 64×64 thumbnails for brief attachments
// Used when creative work exists so briefs don't dominate the viewport
// ---------------------------------------------------------------------------

export function BriefThumbnailRow({
  assets,
}: {
  assets: AssetEntry[];
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (!assets || assets.length === 0) return null;

  const handleDownload = async (assetId: string, filename: string) => {
    setDownloadingId(assetId);
    try {
      await downloadSingleAsset(assetId, filename);
    } catch (err) {
      console.error("[BriefThumbnailRow] download error:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {assets.map((asset, i) => (
          <div
            key={asset.id}
            className="group/brief relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-[#e3e1dc] bg-[#f5f3f0]"
            onClick={() => setLightboxIndex(i)}
          >
            <RevisionImage
              assetId={asset.id}
              url={asset.url}
              alt={asset.originalName || "Brief attachment"}
              className="h-16 w-16 object-cover"
            />
            {/* Download badge */}
            <button
              type="button"
              className="pointer-events-auto absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/20 text-white/70 transition-all group-hover/brief:h-5 group-hover/brief:w-5 group-hover/brief:bg-black/50 group-hover/brief:text-white hover:!bg-black/70"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(asset.id, asset.originalName || `brief-${i + 1}`);
              }}
              aria-label="Download"
              title="Download"
            >
              {downloadingId === asset.id ? (
                <span className="h-2 w-2 animate-spin rounded-full border border-white border-t-transparent" />
              ) : (
                <DownloadIcon className="h-2.5 w-2.5" />
              )}
            </button>
          </div>
        ))}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          assets={assets}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          pinMode="view"
        />
      )}
    </>
  );
}
