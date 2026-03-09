"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CANVAS_DEFAULTS } from "@/lib/moodboard";
import type { MoodboardItemClient } from "@/lib/moodboard";

const { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } = CANVAS_DEFAULTS;

/** Padding (in canvas px) allowed beyond content edges when panning. */
const PAN_PADDING = 100;

export type CanvasTransform = {
  panX: number;
  panY: number;
  zoom: number;
};

export function useCanvasTransform(
  items: MoodboardItemClient[],
  viewportRef: React.RefObject<HTMLDivElement | null>,
) {
  const [transform, setTransform] = useState<CanvasTransform>({
    panX: 0,
    panY: 0,
    zoom: 1,
  });

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const spaceHeld = useRef(false);

  // Keep a ref so callbacks always read latest items without re-creating
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // -------------------------------------------------------------------------
  // Pan clamping — keep content at least partially in view
  // -------------------------------------------------------------------------

  const clampPan = useCallback(
    (panX: number, panY: number, zoom: number) => {
      const curItems = itemsRef.current;
      const el = viewportRef.current;
      if (curItems.length === 0 || !el) return { panX, panY };

      const { width: vw, height: vh } = el.getBoundingClientRect();

      let cMinX = Infinity,
        cMinY = Infinity,
        cMaxX = -Infinity,
        cMaxY = -Infinity;
      for (const item of curItems) {
        cMinX = Math.min(cMinX, item.x);
        cMinY = Math.min(cMinY, item.y);
        cMaxX = Math.max(cMaxX, item.x + item.width);
        cMaxY = Math.max(cMaxY, item.y + (item.height || 200));
      }

      // Visible canvas region:
      //   left  = -panX / zoom          right  = (-panX + vw) / zoom
      //   top   = -panY / zoom          bottom = (-panY + vh) / zoom
      //
      // Constraint: visible region must overlap content + padding
      //   left  < cMaxX + pad   →  panX > -(cMaxX + pad) * zoom
      //   right > cMinX - pad   →  panX < -(cMinX - pad) * zoom + vw
      //   (same for Y)
      const loPanX = -(cMaxX + PAN_PADDING) * zoom;
      const hiPanX = -(cMinX - PAN_PADDING) * zoom + vw;
      const loPanY = -(cMaxY + PAN_PADDING) * zoom;
      const hiPanY = -(cMinY - PAN_PADDING) * zoom + vh;

      return {
        panX: Math.max(loPanX, Math.min(hiPanX, panX)),
        panY: Math.max(loPanY, Math.min(hiPanY, panY)),
      };
    },
    [viewportRef],
  );

  /** setTransform wrapper that clamps pan values to content bounds. */
  const setClampedTransform = useCallback(
    (updater: (prev: CanvasTransform) => CanvasTransform) => {
      setTransform((prev) => {
        const next = updater(prev);
        const { panX, panY } = clampPan(next.panX, next.panY, next.zoom);
        return { ...next, panX, panY };
      });
    },
    [clampPan],
  );

  // -------------------------------------------------------------------------
  // Coordinate conversion
  // -------------------------------------------------------------------------

  /** Convert screen (viewport) coordinates to canvas (logical) coordinates */
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number, viewportRect: DOMRect) => {
      return {
        x: (screenX - viewportRect.left - transform.panX) / transform.zoom,
        y: (screenY - viewportRect.top - transform.panY) / transform.zoom,
      };
    },
    [transform],
  );

  // -------------------------------------------------------------------------
  // Zoom
  // -------------------------------------------------------------------------

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const zoomIn = useCallback(() => {
    setClampedTransform((t) => ({ ...t, zoom: clampZoom(t.zoom + ZOOM_STEP) }));
  }, [setClampedTransform]);

  const zoomOut = useCallback(() => {
    setClampedTransform((t) => ({ ...t, zoom: clampZoom(t.zoom - ZOOM_STEP) }));
  }, [setClampedTransform]);

  const resetView = useCallback(() => {
    // Reset zoom to 100% and clamp pan to keep content visible
    setClampedTransform(() => ({ panX: 0, panY: 0, zoom: 1 }));
  }, [setClampedTransform]);

  /** Zoom centered on a specific point (e.g., cursor position) */
  const zoomAtPoint = useCallback(
    (delta: number, clientX: number, clientY: number, rect: DOMRect) => {
      setClampedTransform((t) => {
        const newZoom = clampZoom(t.zoom + delta);
        if (newZoom === t.zoom) return t;

        const pointX = clientX - rect.left;
        const pointY = clientY - rect.top;

        const scale = newZoom / t.zoom;
        const newPanX = pointX - (pointX - t.panX) * scale;
        const newPanY = pointY - (pointY - t.panY) * scale;

        return { panX: newPanX, panY: newPanY, zoom: newZoom };
      });
    },
    [setClampedTransform],
  );

  /** Fit all items into view (unclamped — this calculates perfect position) */
  const fitToContent = useCallback(
    (fitItems: MoodboardItemClient[], viewportWidth: number, viewportHeight: number) => {
      if (fitItems.length === 0) {
        setTransform({ panX: 0, panY: 0, zoom: 1 });
        return;
      }

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const item of fitItems) {
        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
        maxX = Math.max(maxX, item.x + item.width);
        maxY = Math.max(maxY, item.y + (item.height || 200));
      }

      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const padding = 60;

      const scaleX = (viewportWidth - padding * 2) / contentW;
      const scaleY = (viewportHeight - padding * 2) / contentH;
      const zoom = clampZoom(Math.min(scaleX, scaleY, 1));

      const panX = (viewportWidth - contentW * zoom) / 2 - minX * zoom;
      const panY = (viewportHeight - contentH * zoom) / 2 - minY * zoom;

      setTransform({ panX, panY, zoom });
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Wheel handler (zoom + pan)
  // -------------------------------------------------------------------------

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom / ctrl+scroll = zoom
        const delta = -e.deltaY * 0.005;
        zoomAtPoint(delta, e.clientX, e.clientY, rect);
      } else {
        // Regular scroll = pan (clamped)
        setClampedTransform((t) => ({
          ...t,
          panX: t.panX - e.deltaX,
          panY: t.panY - e.deltaY,
        }));
      }
    },
    [zoomAtPoint, setClampedTransform],
  );

  // -------------------------------------------------------------------------
  // Pan via middle-click or space+drag
  // -------------------------------------------------------------------------

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Middle mouse button OR space+left-click
      if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          panX: transform.panX,
          panY: transform.panY,
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    },
    [transform.panX, transform.panY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanning.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setClampedTransform((t) => ({
        ...t,
        panX: panStart.current.panX + dx,
        panY: panStart.current.panY + dy,
      }));
    },
    [setClampedTransform],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning.current) {
      isPanning.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Space key tracking (for space+drag pan)
  // -------------------------------------------------------------------------

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === "Space" && !e.repeat) {
      spaceHeld.current = true;
    }
  }, []);

  const onKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === "Space") {
      spaceHeld.current = false;
    }
  }, []);

  return {
    transform,
    screenToCanvas,
    zoomIn,
    zoomOut,
    resetView,
    fitToContent,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    onKeyUp,
    isPanningRef: isPanning,
    spaceHeldRef: spaceHeld,
  };
}
