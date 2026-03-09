"use client";

import React, { useCallback, useRef, useState } from "react";
import type { MoodboardItemClient, DrawingCardData } from "@/lib/moodboard";

type DrawingLayerProps = {
  /** All items of type DRAWING — rendered as SVG paths. */
  drawings: MoodboardItemClient[];
  /** Whether draw mode is active (captures pointer events). */
  active: boolean;
  /** Current stroke color. */
  strokeColor: string;
  /** Current stroke width. */
  strokeWidth: number;
  /** Viewport ref for coordinate conversion. */
  panX: number;
  panY: number;
  zoom: number;
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

export function DrawingLayer({
  drawings,
  active,
  strokeColor,
  strokeWidth,
  panX,
  panY,
  zoom,
  viewportRef,
  onStrokeComplete,
  onSelectDrawing,
  selectedDrawingId,
  onDeleteDrawing,
}: DrawingLayerProps) {
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!active || !viewportRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as SVGSVGElement).setPointerCapture(e.pointerId);

      const rect = viewportRef.current.getBoundingClientRect();
      const pt = toCanvas(e.clientX, e.clientY, rect, panX, panY, zoom);

      pointsRef.current = [pt];
      setCurrentPoints([pt]);
      setIsDrawing(true);
    },
    [active, panX, panY, zoom, viewportRef],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDrawing || !viewportRef.current) return;

      const rect = viewportRef.current.getBoundingClientRect();
      const pt = toCanvas(e.clientX, e.clientY, rect, panX, panY, zoom);

      // Throttle: skip if too close to the previous point
      const prev = pointsRef.current[pointsRef.current.length - 1];
      const dist = Math.sqrt((pt.x - prev.x) ** 2 + (pt.y - prev.y) ** 2);
      if (dist < 2) return;

      pointsRef.current.push(pt);
      setCurrentPoints([...pointsRef.current]);
    },
    [isDrawing, panX, panY, zoom, viewportRef],
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

      onStrokeComplete({ pathData, strokeColor, strokeWidth }, bounds);

      setCurrentPoints([]);
      pointsRef.current = [];
    },
    [isDrawing, strokeColor, strokeWidth, onStrokeComplete],
  );

  // The SVG must cover a large canvas area because the transform div has no
  // intrinsic size (all children are absolutely positioned → 0×0 parent).
  // Using explicit large dimensions ensures pointer events are captured everywhere.
  return (
    <svg
      style={{
        position: "absolute",
        left: -10000,
        top: -10000,
        width: 30000,
        height: 30000,
        overflow: "visible",
        pointerEvents: active ? "auto" : "none",
        cursor: active ? "crosshair" : "default",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Rendered saved drawings */}
      {drawings.map((item) => {
        const data = item.data as DrawingCardData;
        const isSelected = selectedDrawingId === item.id;

        return (
          <g key={item.id}>
            {/* Invisible wider path for easier click targeting in select mode */}
            {!active && onSelectDrawing && (
              <path
                d={data.pathData}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(data.strokeWidth + 12, 16)}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-stroke cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDrawing(item.id);
                }}
              />
            )}
            {/* Visible stroke */}
            <path
              d={data.pathData}
              fill="none"
              stroke={isSelected ? "#F15B2B" : data.strokeColor}
              strokeWidth={isSelected ? data.strokeWidth + 1 : data.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none"
              opacity={isSelected ? 0.8 : 1}
            />
            {/* Delete button for selected drawing */}
            {isSelected && onDeleteDrawing && (
              <g
                className="pointer-events-auto cursor-pointer"
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
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none"
        />
      )}
    </svg>
  );
}
