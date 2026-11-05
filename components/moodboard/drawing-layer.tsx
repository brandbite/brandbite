"use client";

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import type { MoodboardItemClient, DrawingCardData } from "@/lib/moodboard";

type DrawingLayerProps = {
  /** All items of type DRAWING — rendered as SVG paths. */
  drawings: MoodboardItemClient[];
  /** Whether draw mode is active (captures pointer events). */
  active: boolean;
  /** Whether eraser mode is active. */
  eraserActive: boolean;
  /** Current stroke color. */
  strokeColor: string;
  /** Current stroke width. */
  strokeWidth: number;
  /** Below 1 for the highlighter. */
  strokeOpacity: number;
  /** Read when needed, so moving the canvas doesn't re-render this layer. */
  getTransform: () => { panX: number; panY: number; zoom: number };
  /** Viewport ref for coordinate conversion. */
  viewportRef: React.RefObject<HTMLDivElement | null>;
  /** Called when a new stroke is completed. */
  onStrokeComplete: (
    data: DrawingCardData,
    bounds: { x: number; y: number; w: number; h: number },
  ) => void;
  /** Called when a drawing item is clicked (for deletion in select mode). */
  onSelectDrawing?: (itemId: string) => void;
  /** ID of the currently selected drawing (for highlight). */
  selectedDrawingId?: string | null;
  /** Called to delete the selected drawing. */
  onDeleteDrawing?: (itemId: string) => void;
};

/** How often a swipe checks for strokes along its path, in screen pixels. */
const ERASE_STEP_PX = 6;

/** Convert client coordinates to canvas (untransformed) coordinates. */
function toCanvas(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  panX: number,
  panY: number,
  zoom: number,
) {
  return {
    x: (clientX - rect.left - panX) / zoom,
    y: (clientY - rect.top - panY) / zoom,
  };
}

/** Build an SVG path data string from a series of points using smooth curves. */
function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  if (points.length === 2) {
    d += ` L ${points[1].x} ${points[1].y}`;
    return d;
  }

  // Use quadratic bezier curves through midpoints for smoothness
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${mx} ${my}`;
  }

  // End at last point
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;

  return d;
}

/** Compute bounding box of a set of points with padding. */
function computeBounds(points: { x: number; y: number }[], strokeWidth: number) {
  const pad = strokeWidth / 2 + 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

function DrawingLayerBase({
  drawings,
  active,
  eraserActive,
  strokeColor,
  strokeWidth,
  strokeOpacity,
  getTransform,
  viewportRef,
  onStrokeComplete,
  onSelectDrawing,
  selectedDrawingId,
  onDeleteDrawing,
}: DrawingLayerProps) {
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);

  // Eraser state
  const [eraserHoveredId, setEraserHoveredId] = useState<string | null>(null);
  const [eraserCursorPos, setEraserCursorPos] = useState<{ x: number; y: number } | null>(null);
  const erasing = useRef(false);
  const erased = useRef(new Set<string>());
  const lastErasePoint = useRef<{ x: number; y: number } | null>(null);

  // Clear eraser state when eraser mode is deactivated
  useEffect(() => {
    if (!eraserActive) {
      setEraserHoveredId(null);
      setEraserCursorPos(null);
      erasing.current = false;
    }
  }, [eraserActive]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!active || !viewportRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as SVGSVGElement).setPointerCapture(e.pointerId);

      const rect = viewportRef.current.getBoundingClientRect();
      const { panX, panY, zoom } = getTransform();
      const pt = toCanvas(e.clientX, e.clientY, rect, panX, panY, zoom);

      pointsRef.current = [pt];
      setCurrentPoints([pt]);
      setIsDrawing(true);
    },
    [active, getTransform, viewportRef],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDrawing || !viewportRef.current) return;

      const rect = viewportRef.current.getBoundingClientRect();
      const { panX, panY, zoom } = getTransform();
      const pt = toCanvas(e.clientX, e.clientY, rect, panX, panY, zoom);

      // Throttle: skip if too close to the previous point
      const prev = pointsRef.current[pointsRef.current.length - 1];
      const dist = Math.sqrt((pt.x - prev.x) ** 2 + (pt.y - prev.y) ** 2);
      if (dist < 2) return;

      pointsRef.current.push(pt);
      setCurrentPoints([...pointsRef.current]);
    },
    [isDrawing, getTransform, viewportRef],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDrawing) return;
      (e.target as SVGSVGElement).releasePointerCapture(e.pointerId);
      setIsDrawing(false);

      const points = pointsRef.current;
      if (points.length < 2) {
        setCurrentPoints([]);
        return;
      }

      const pathData = pointsToPath(points);
      const bounds = computeBounds(points, strokeWidth);

      onStrokeComplete(
        {
          pathData,
          strokeColor,
          strokeWidth,
          ...(strokeOpacity < 1 ? { opacity: strokeOpacity } : {}),
        },
        bounds,
      );

      setCurrentPoints([]);
      pointsRef.current = [];
    },
    [isDrawing, strokeColor, strokeWidth, strokeOpacity, onStrokeComplete],
  );

  // --- Eraser handlers ---

  // Looks up what's under the pointer rather than relying on enter and leave events:
  // those don't fire on touch screens, or while the pointer is captured for a drag.
  const drawingAt = useCallback((clientX: number, clientY: number) => {
    return (
      document
        .elementFromPoint(clientX, clientY)
        ?.closest("[data-mb-drawing-id]")
        ?.getAttribute("data-mb-drawing-id") ?? null
    );
  }, []);

  /** Erases everything along the line, so a fast swipe doesn't jump over a stroke. */
  const eraseAlong = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const steps = Math.max(
        1,
        Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / ERASE_STEP_PX),
      );
      for (let i = 0; i <= steps; i++) {
        const id = drawingAt(
          from.x + ((to.x - from.x) * i) / steps,
          from.y + ((to.y - from.y) * i) / steps,
        );
        if (id && !erased.current.has(id)) {
          erased.current.add(id);
          onDeleteDrawing?.(id);
        }
      }
    },
    [drawingAt, onDeleteDrawing],
  );

  const moveEraserCursor = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const { panX, panY, zoom } = getTransform();
      setEraserCursorPos(toCanvas(e.clientX, e.clientY, rect, panX, panY, zoom));
    },
    [getTransform, viewportRef],
  );

  const handleEraserPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!eraserActive || !viewportRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      erasing.current = true;
      erased.current.clear();
      const point = { x: e.clientX, y: e.clientY };
      lastErasePoint.current = point;
      eraseAlong(point, point);
      setEraserHoveredId(null);
      moveEraserCursor(e);
    },
    [eraserActive, eraseAlong, moveEraserCursor, viewportRef],
  );

  const handleEraserPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!eraserActive) return;
      moveEraserCursor(e);
      const point = { x: e.clientX, y: e.clientY };
      if (erasing.current) {
        eraseAlong(lastErasePoint.current ?? point, point);
        lastErasePoint.current = point;
      } else {
        setEraserHoveredId(drawingAt(point.x, point.y));
      }
    },
    [eraserActive, eraseAlong, moveEraserCursor, drawingAt],
  );

  const handleEraserPointerEnd = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!eraserActive) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      erasing.current = false;
      lastErasePoint.current = null;
      // A finger has lifted, so there's no longer a position to show.
      if (e.pointerType === "touch") setEraserCursorPos(null);
    },
    [eraserActive],
  );

  // The SVG must cover a large canvas area because the transform div has no
  // intrinsic size (all children are absolutely positioned → 0×0 parent).
  // Using explicit large dimensions ensures pointer events are captured everywhere.
  return (
    <svg
      viewBox="-10000 -10000 30000 30000"
      style={{
        position: "absolute",
        left: -10000,
        top: -10000,
        width: 30000,
        height: 30000,
        overflow: "visible",
        pointerEvents: active || eraserActive ? "auto" : "none",
        cursor: active ? "crosshair" : eraserActive ? "none" : "default",
      }}
      onPointerDown={
        active ? handlePointerDown : eraserActive ? handleEraserPointerDown : undefined
      }
      onPointerMove={
        active ? handlePointerMove : eraserActive ? handleEraserPointerMove : undefined
      }
      onPointerUp={active ? handlePointerUp : eraserActive ? handleEraserPointerEnd : undefined}
      onPointerCancel={eraserActive ? handleEraserPointerEnd : undefined}
    >
      {/* Rendered saved drawings */}
      {drawings.map((item) => {
        const data = item.data as DrawingCardData;
        const isSelected = selectedDrawingId === item.id;
        const isEraserHovered = eraserActive && eraserHoveredId === item.id;

        return (
          <g key={item.id}>
            {/* Invisible wider path for click/hover targeting (select + eraser modes) */}
            {(!active || eraserActive) && (
              <path
                d={data.pathData}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(data.strokeWidth + 12, 16)}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                data-mb-drawing-id={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!eraserActive) onSelectDrawing?.(item.id);
                }}
              />
            )}
            {/* Visible stroke */}
            <path
              d={data.pathData}
              fill="none"
              stroke={isEraserHovered ? "#ef4444" : isSelected ? "#F15B2B" : data.strokeColor}
              strokeWidth={
                isEraserHovered
                  ? data.strokeWidth + 2
                  : isSelected
                    ? data.strokeWidth + 1
                    : data.strokeWidth
              }
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none"
              opacity={isEraserHovered ? 0.6 : isSelected ? 0.8 : (data.opacity ?? 1)}
            />
            {/* Delete button for selected drawing (select mode only) */}
            {isSelected && !eraserActive && onDeleteDrawing && (
              <g
                style={{ pointerEvents: "auto", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDrawing(item.id);
                }}
              >
                <circle
                  cx={item.x + item.width}
                  cy={item.y}
                  r={12}
                  fill="white"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                />
                <text
                  x={item.x + item.width}
                  y={item.y + 4.5}
                  textAnchor="middle"
                  fontSize="14"
                  fill="#ef4444"
                  fontWeight="bold"
                >
                  ×
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Currently being drawn stroke */}
      {currentPoints.length > 1 && (
        <path
          d={pointsToPath(currentPoints)}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={strokeOpacity}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none"
        />
      )}

      {/* Eraser cursor indicator */}
      {eraserActive && eraserCursorPos && (
        <circle
          cx={eraserCursorPos.x}
          cy={eraserCursorPos.y}
          r={10 / getTransform().zoom}
          fill="white"
          fillOpacity={0.7}
          stroke="#ef4444"
          strokeWidth={2 / getTransform().zoom}
          className="pointer-events-none"
        />
      )}
    </svg>
  );
}

export const DrawingLayer = memo(DrawingLayerBase);
