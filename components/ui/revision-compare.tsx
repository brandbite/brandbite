// -----------------------------------------------------------------------------
// @file: components/ui/revision-compare.tsx
// @purpose: Side-by-side revision comparison modal for creative review workflows
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-21
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RevisionImage } from "./revision-image";
import type { AssetEntry } from "./revision-image";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RevisionData = {
  version: number;
  submittedAt: string | null;
  assets: AssetEntry[];
};

type RevisionCompareProps = {
  revisions: RevisionData[];
  initialLeftVersion?: number;
  initialRightVersion?: number;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// useResolvedSrc — same as revision-image.tsx (resolve presigned URL fallback)
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
// CompareImage — single image in the comparison grid
// ---------------------------------------------------------------------------

function CompareImage({
  asset,
  label,
}: {
  asset: AssetEntry;
  label: string;
}) {
  const { src, loading, error } = useResolvedSrc(asset.id, asset.url);

  if (loading) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-card)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--bb-border)] border-t-[var(--bb-text-tertiary)]" />
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-card)] text-xs text-[var(--bb-text-muted)]">
        Could not load image
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-card)]">
      <img
        src={src}
        alt={label}
        className="aspect-video w-full object-cover"
      />
      {asset.originalName && (
        <p className="truncate px-2 py-1 text-[10px] text-[var(--bb-text-tertiary)]">
          {asset.originalName}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptySlot — placeholder when one side has fewer assets
// ---------------------------------------------------------------------------

function EmptySlot() {
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-page)] text-xs text-[var(--bb-text-muted)]">
      No corresponding file
    </div>
  );
}

// ---------------------------------------------------------------------------
// RevisionCompare — full modal overlay
// ---------------------------------------------------------------------------

export function RevisionCompare({
  revisions,
  initialLeftVersion,
  initialRightVersion,
  onClose,
}: RevisionCompareProps) {
  const sorted = [...revisions].sort((a, b) => a.version - b.version);

  const defaultRight = sorted[sorted.length - 1]?.version ?? 1;
  const defaultLeft =
    sorted.length >= 2 ? sorted[sorted.length - 2].version : defaultRight;

  const [leftVersion, setLeftVersion] = useState(
    initialLeftVersion ?? defaultLeft,
  );
  const [rightVersion, setRightVersion] = useState(
    initialRightVersion ?? defaultRight,
  );

  // Mobile tab state
  const [activeTab, setActiveTab] = useState<"left" | "right">("left");

  const leftRev = sorted.find((r) => r.version === leftVersion);
  const rightRev = sorted.find((r) => r.version === rightVersion);

  const maxAssets = Math.max(
    leftRev?.assets.length ?? 0,
    rightRev?.assets.length ?? 0,
  );

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/60 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3 md:px-6">
        <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">
          Compare revisions
        </h2>

        <div className="flex items-center gap-3">
          {/* Desktop dropdowns */}
          <div className="hidden items-center gap-2 md:flex">
            <label className="text-[11px] text-[var(--bb-text-tertiary)]">Left:</label>
            <select
              className="rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-2 py-1 text-xs text-[var(--bb-secondary)]"
              value={leftVersion}
              onChange={(e) => setLeftVersion(Number(e.target.value))}
            >
              {sorted.map((r) => (
                <option key={r.version} value={r.version}>
                  v{r.version}
                </option>
              ))}
            </select>

            <span className="text-xs text-[var(--bb-text-muted)]">vs</span>

            <label className="text-[11px] text-[var(--bb-text-tertiary)]">Right:</label>
            <select
              className="rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-2 py-1 text-xs text-[var(--bb-secondary)]"
              value={rightVersion}
              onChange={(e) => setRightVersion(Number(e.target.value))}
            >
              {sorted.map((r) => (
                <option key={r.version} value={r.version}>
                  v{r.version}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--bb-text-tertiary)] transition-colors hover:bg-[var(--bb-bg-card)] hover:text-[var(--bb-secondary)]"
            aria-label="Close comparison"
          >
            &#10005;
          </button>
        </div>
      </div>

      {/* Mobile tabs + dropdowns */}
      <div className="flex items-center justify-between border-b border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-2 md:hidden">
        <div className="flex gap-1">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === "left"
                ? "bg-[var(--bb-primary)] text-white"
                : "bg-[var(--bb-bg-page)] text-[var(--bb-secondary)] border border-[var(--bb-border-input)]"
            }`}
            onClick={() => setActiveTab("left")}
          >
            v{leftVersion}
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === "right"
                ? "bg-[var(--bb-primary)] text-white"
                : "bg-[var(--bb-bg-page)] text-[var(--bb-secondary)] border border-[var(--bb-border-input)]"
            }`}
            onClick={() => setActiveTab("right")}
          >
            v{rightVersion}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-2 py-1 text-xs text-[var(--bb-secondary)]"
            value={activeTab === "left" ? leftVersion : rightVersion}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (activeTab === "left") setLeftVersion(v);
              else setRightVersion(v);
            }}
          >
            {sorted.map((r) => (
              <option key={r.version} value={r.version}>
                v{r.version}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {maxAssets === 0 && (
          <div className="flex h-40 items-center justify-center text-sm text-[var(--bb-text-muted)]">
            No assets to compare.
          </div>
        )}

        {maxAssets > 0 && (
          <>
            {/* Desktop: side-by-side grid */}
            <div className="hidden md:block">
              {/* Column headers */}
              <div className="mb-3 grid grid-cols-2 gap-4">
                <p className="text-xs font-semibold text-[var(--bb-secondary)]">
                  Version {leftVersion}
                  {leftRev?.submittedAt && (
                    <span className="ml-2 font-normal text-[var(--bb-text-tertiary)]">
                      {new Date(leftRev.submittedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
                <p className="text-xs font-semibold text-[var(--bb-secondary)]">
                  Version {rightVersion}
                  {rightRev?.submittedAt && (
                    <span className="ml-2 font-normal text-[var(--bb-text-tertiary)]">
                      {new Date(rightRev.submittedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>

              {/* Asset pairs */}
              <div className="space-y-4">
                {Array.from({ length: maxAssets }).map((_, i) => {
                  const leftAsset = leftRev?.assets[i] ?? null;
                  const rightAsset = rightRev?.assets[i] ?? null;

                  return (
                    <div key={i} className="grid grid-cols-2 gap-4">
                      {leftAsset ? (
                        <CompareImage
                          asset={leftAsset}
                          label={`v${leftVersion} asset ${i + 1}`}
                        />
                      ) : (
                        <EmptySlot />
                      )}
                      {rightAsset ? (
                        <CompareImage
                          asset={rightAsset}
                          label={`v${rightVersion} asset ${i + 1}`}
                        />
                      ) : (
                        <EmptySlot />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile: single column, tab-switched */}
            <div className="md:hidden">
              <p className="mb-3 text-xs font-semibold text-[var(--bb-secondary)]">
                Version{" "}
                {activeTab === "left" ? leftVersion : rightVersion}
              </p>

              <div className="space-y-3">
                {(activeTab === "left" ? leftRev : rightRev)?.assets.map(
                  (asset, i) => (
                    <CompareImage
                      key={asset.id}
                      asset={asset}
                      label={`v${activeTab === "left" ? leftVersion : rightVersion} asset ${i + 1}`}
                    />
                  ),
                )}
                {((activeTab === "left" ? leftRev : rightRev)?.assets
                  .length ?? 0) === 0 && (
                  <div className="flex h-32 items-center justify-center text-xs text-[var(--bb-text-muted)]">
                    No assets in this version.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
