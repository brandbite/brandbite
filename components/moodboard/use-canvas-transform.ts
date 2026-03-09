"use client";

import { useCallback, useRef, useState } from "react";
import { CANVAS_DEFAULTS } from "@/lib/moodboard";
import type { MoodboardItemClient } from "@/lib/moodboard";

const { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } = CANVAS_DEFAULTS;

export type CanvasTransform = {
  panX: number;
  panY: number;
  zoom: number;
};

export function useCanvasTransform() {
  const [transform, setTransform] = useState<CanvasTransform>({
    panX: 0,
    panY: 0,
    zoom: 1,
  });

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const spaceHeld = useRef(false);

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
    setTransform((t) => ({ ...t, zoom: clampZoom(t.zoom + ZOOM_STEP) }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((t) => ({ ...t, zoom: clampZoom(t.zoom - ZOOM_STEP) }));
  }, []);

  const resetView = useCallback(() => {
    setTransform({ panX: 0, panY: 0, zoom: 1 });
  }, []);

  /** Zoom centered on a specific point (e.g., cursor position) */
  const zoomAtPoint = useCallback(
    (delta: number, clientX: number, clientY: number, rect: DOMRect) => {
      setTransform((t) => {
        const newZoom = clampZoom(t.zoom + delta);
        if (newZoom === t.zoom) return t;

        // Keep the point under the cursor fixed
        const pointX = clientX - rect.left;
        const pointY = clientY - rect.top;

        const scale = newZoom / t.zoom;
        const newPanX = pointX - (pointX - t.panX) * scale;
        const newPanY = pointY - (pointY - t.panY) * scale;

        return { panX: newPanX, panY: newPanY, zoom: newZoom };
      });
    },
    [],
  );

  /** Fit all items into view */
  const fitToContent = useCallback(
    (items: MoodboardItemClient[], viewportWidth: number, viewportHeight: number) => {
      if (items.length === 0) {
        setTransform({ panX: 0, panY: 0, zoom: 1 });
        return;
      }

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const item of items) {
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
        // Regular scroll = pan
        setTransform((t) => ({
          ...t,
          panX: t.panX - e.deltaX,
          panY: t.panY - e.deltaY,
        }));
      }
    },
    [zoomAtPoint],
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

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setTransform((t) => ({
      ...t,
      panX: panStart.current.panX + dx,
      panY: panStart.current.panY + dy,
    }));
  }, []);

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
