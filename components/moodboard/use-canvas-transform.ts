"use client";

// -----------------------------------------------------------------------------
// @file: components/moodboard/use-canvas-transform.ts
// @purpose: Pan and zoom for the moodboard canvas. The transform lives in a ref
//           and is written straight to the DOM once per frame, so moving the
//           canvas doesn't re-render React. Only the zoom readout subscribes.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";

import { CANVAS_DEFAULTS } from "@/lib/moodboard";

import {
  clampZoom,
  fitTransform,
  gridSpacing,
  wheelDeltaPx,
  wheelZoomFactor,
  zoomAtPoint,
  type CanvasRect,
  type CanvasTransform,
} from "./canvas-math";

const ANIMATION_MS = 180;
/** Layer stays promoted this long after a gesture, then re-rasters so text is crisp. */
const SETTLE_MS = 150;

export type CanvasController = ReturnType<typeof useCanvasTransform>;

export function useCanvasTransform(
  viewportRef: RefObject<HTMLDivElement | null>,
  worldRef: RefObject<HTMLDivElement | null>,
  gridRef: RefObject<HTMLDivElement | null>,
) {
  const transformRef = useRef<CanvasTransform>({ panX: 0, panY: 0, zoom: 1 });
  const frameRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomListeners = useRef(new Set<() => void>());
  const shownZoom = useRef(1);

  const paint = useCallback(() => {
    frameRef.current = null;
    const { panX, panY, zoom } = transformRef.current;

    const world = worldRef.current;
    if (world) {
      world.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`;
      // Lets selection outlines and handles keep a constant size on screen.
      world.style.setProperty("--mb-inverse-zoom", String(1 / zoom));
    }

    const grid = gridRef.current;
    if (grid) {
      const spacing = gridSpacing(zoom);
      grid.style.backgroundSize = `${spacing}px ${spacing}px`;
      grid.style.backgroundPosition = `${panX % spacing}px ${panY % spacing}px`;
    }

    if (shownZoom.current !== zoom) {
      shownZoom.current = zoom;
      zoomListeners.current.forEach((listener) => listener());
    }
  }, [worldRef, gridRef]);

  const schedulePaint = useCallback(() => {
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(paint);

    const world = worldRef.current;
    if (!world) return;
    world.style.willChange = "transform";
    if (settleRef.current) clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => {
      world.style.willChange = "";
    }, SETTLE_MS);
  }, [paint, worldRef]);

  const cancelAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  /** Jump there now; a gesture owns the canvas from this point. */
  const setTransform = useCallback(
    (next: CanvasTransform) => {
      cancelAnimation();
      transformRef.current = next;
      schedulePaint();
    },
    [cancelAnimation, schedulePaint],
  );

  /** Ease there, for the buttons and shortcuts. */
  const animateTo = useCallback(
    (target: CanvasTransform) => {
      cancelAnimation();
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setTransform(target);
        return;
      }

      const from = transformRef.current;
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / ANIMATION_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        transformRef.current = {
          panX: from.panX + (target.panX - from.panX) * eased,
          panY: from.panY + (target.panY - from.panY) * eased,
          // Interpolated in log space so the zoom speed looks constant.
          zoom: from.zoom * Math.pow(target.zoom / from.zoom, eased),
        };
        schedulePaint();
        animationRef.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      animationRef.current = requestAnimationFrame(step);
    },
    [cancelAnimation, schedulePaint, setTransform],
  );

  const viewportSize = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
  }, [viewportRef]);

  const zoomBy = useCallback(
    (factor: number) => {
      const { width, height } = viewportSize();
      const current = transformRef.current;
      animateTo(zoomAtPoint(current, clampZoom(current.zoom * factor), width / 2, height / 2));
    },
    [animateTo, viewportSize],
  );

  const controller = useMemo(
    () => ({
      getTransform: () => transformRef.current,
      getZoom: () => shownZoom.current,
      subscribeZoom: (listener: () => void) => {
        zoomListeners.current.add(listener);
        return () => {
          zoomListeners.current.delete(listener);
        };
      },
      setTransform,
      animateTo,
      zoomIn: () => zoomBy(CANVAS_DEFAULTS.ZOOM_STEP),
      zoomOut: () => zoomBy(1 / CANVAS_DEFAULTS.ZOOM_STEP),
      resetZoom: () => {
        const { width, height } = viewportSize();
        animateTo(zoomAtPoint(transformRef.current, 1, width / 2, height / 2));
      },
      fit: (rects: CanvasRect[], options: { animate?: boolean } = {}) => {
        const { width, height } = viewportSize();
        const target = fitTransform(rects, width, height);
        if (options.animate) animateTo(target);
        else setTransform(target);
      },
      /** The canvas point at the middle of what's on screen. */
      viewCenter: () => {
        const { width, height } = viewportSize();
        const { panX, panY, zoom } = transformRef.current;
        return { x: (width / 2 - panX) / zoom, y: (height / 2 - panY) / zoom };
      },
    }),
    [animateTo, setTransform, viewportSize, zoomBy],
  );

  // React registers wheel listeners as passive, and a passive listener can't
  // stop the browser zooming the whole page. This has to be a native listener.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const zooming = e.ctrlKey || e.metaKey;
      // A focused text box keeps its own scrolling.
      if (!zooming && target.tagName === "TEXTAREA" && document.activeElement === target) return;

      e.preventDefault();
      const dx = wheelDeltaPx(e.deltaX, e.deltaMode);
      const dy = wheelDeltaPx(e.deltaY, e.deltaMode);
      const current = transformRef.current;

      if (zooming) {
        const rect = viewport.getBoundingClientRect();
        setTransform(
          zoomAtPoint(
            current,
            current.zoom * wheelZoomFactor(dy),
            e.clientX - rect.left,
            e.clientY - rect.top,
          ),
        );
      } else if (e.shiftKey && dx === 0) {
        // Shift + wheel moves sideways on a mouse, which has no horizontal axis.
        setTransform({ ...current, panX: current.panX - dy });
      } else {
        setTransform({ ...current, panX: current.panX - dx, panY: current.panY - dy });
      }
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [viewportRef, setTransform]);

  useEffect(() => {
    // Also repaints after an effect re-run, which cancels any frame still pending.
    schedulePaint();
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      cancelAnimation();
      if (settleRef.current) clearTimeout(settleRef.current);
    };
  }, [schedulePaint, cancelAnimation]);

  return controller;
}
