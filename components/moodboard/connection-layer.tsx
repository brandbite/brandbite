"use client";

import React, { useState } from "react";
import type { MoodboardConnection, MoodboardItemClient } from "@/lib/moodboard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectionLayerProps = {
  connections: MoodboardConnection[];
  items: MoodboardItemClient[];
  onDeleteConnection: (id: string) => void;
  /** In arrow creation mode, this is the source item ID (first click done). */
  pendingSourceId: string | null;
  /** Current mouse position in canvas coords (for temp arrow while creating). */
  pendingTarget: { x: number; y: number } | null;
  /** Called when a connection is hovered/unhovered (for keyboard delete). */
  onHoverConnection?: (id: string | null) => void;
};

type Side = "top" | "right" | "bottom" | "left";
type Anchor = { x: number; y: number; side: Side };
type Rect = { x: number; y: number; w: number; h: number };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Distance from card edge before first turn. */
const GAP = 28;
/** Corner radius for rounded turns. */
const RADIUS = 14;
/** Default arrow stroke color — dark charcoal like FigJam. */
const STROKE_COLOR = "#555555";
/** Old default colors stored in DB — treat as "no custom color". */
const LEGACY_DEFAULTS = new Set(["#b8b5af", "#9ca3af"]);
/** Arrow stroke width. */
const STROKE_WIDTH = 3.5;
/** Hovered arrow stroke width. */
const STROKE_WIDTH_HOVER = 4;

// ---------------------------------------------------------------------------
// Helpers — anchor selection
// ---------------------------------------------------------------------------

/** Returns the 4 edge midpoints of a rectangle. */
function getAnchors(r: Rect): Record<Side, Anchor> {
  return {
    top: { x: r.x + r.w / 2, y: r.y, side: "top" },
    right: { x: r.x + r.w, y: r.y + r.h / 2, side: "right" },
    bottom: { x: r.x + r.w / 2, y: r.y + r.h, side: "bottom" },
    left: { x: r.x, y: r.y + r.h / 2, side: "left" },
  };
}

/** Opposite side map. */
const oppositeSide: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

/**
 * Pick the best source/target anchors based on relative card positions.
 * Uses center-to-center vector to decide exit/entry sides.
 */
function bestAnchorPair(
  sr: Rect,
  tr: Rect,
): { source: Anchor; target: Anchor } {
  const scx = sr.x + sr.w / 2;
  const scy = sr.y + sr.h / 2;
  const tcx = tr.x + tr.w / 2;
  const tcy = tr.y + tr.h / 2;

  const dx = tcx - scx;
  const dy = tcy - scy;

  const sAnchors = getAnchors(sr);
  const tAnchors = getAnchors(tr);

  let sourceSide: Side;
  let targetSide: Side;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal dominant
    sourceSide = dx > 0 ? "right" : "left";
    targetSide = oppositeSide[sourceSide];
  } else {
    // Vertical dominant
    sourceSide = dy > 0 ? "bottom" : "top";
    targetSide = oppositeSide[sourceSide];
  }

  return {
    source: sAnchors[sourceSide],
    target: tAnchors[targetSide],
  };
}

// ---------------------------------------------------------------------------
// Helpers — orthogonal routing
// ---------------------------------------------------------------------------

/** Extend from an anchor perpendicular to its edge by a given gap. */
function extendFromAnchor(anchor: Anchor, gap: number): { x: number; y: number } {
  switch (anchor.side) {
    case "top":
      return { x: anchor.x, y: anchor.y - gap };
    case "bottom":
      return { x: anchor.x, y: anchor.y + gap };
    case "left":
      return { x: anchor.x - gap, y: anchor.y };
    case "right":
      return { x: anchor.x + gap, y: anchor.y };
  }
}

/**
 * Generate intermediate waypoints between exit and entry points.
 * All segments are horizontal or vertical.
 */
function routeBetween(
  exit: { x: number; y: number },
  exitSide: Side,
  entry: { x: number; y: number },
  entrySide: Side,
): { x: number; y: number }[] {
  const isHorizontalExit = exitSide === "left" || exitSide === "right";
  const isHorizontalEntry = entrySide === "left" || entrySide === "right";

  // Opposing sides (right→left, top→bottom, etc.)
  if (oppositeSide[exitSide] === entrySide) {
    if (isHorizontalExit) {
      // Both exit horizontally — route with H, V, H segments
      const midX = (exit.x + entry.x) / 2;
      return [
        { x: midX, y: exit.y },
        { x: midX, y: entry.y },
      ];
    } else {
      // Both exit vertically — route with V, H, V segments
      const midY = (exit.y + entry.y) / 2;
      return [
        { x: exit.x, y: midY },
        { x: entry.x, y: midY },
      ];
    }
  }

  // Same side (right→right, top→top, etc.)
  if (exitSide === entrySide) {
    if (isHorizontalExit) {
      // Push out to whichever is further, then route
      const outX = exitSide === "right"
        ? Math.max(exit.x, entry.x) + GAP
        : Math.min(exit.x, entry.x) - GAP;
      return [
        { x: outX, y: exit.y },
        { x: outX, y: entry.y },
      ];
    } else {
      const outY = exitSide === "bottom"
        ? Math.max(exit.y, entry.y) + GAP
        : Math.min(exit.y, entry.y) - GAP;
      return [
        { x: exit.x, y: outY },
        { x: entry.x, y: outY },
      ];
    }
  }

  // Adjacent sides — L-shape with single waypoint
  if (isHorizontalExit && !isHorizontalEntry) {
    // e.g., right→top, right→bottom, left→top, left→bottom
    return [{ x: entry.x, y: exit.y }];
  } else {
    // e.g., top→right, bottom→left, etc.
    return [{ x: exit.x, y: entry.y }];
  }
}

/**
 * Build an SVG path from a series of points, with rounded corners at each turn.
 */
function buildRoundedPath(points: { x: number; y: number }[], radius: number): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Direction vectors
    const d1x = curr.x - prev.x;
    const d1y = curr.y - prev.y;
    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;

    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);

    if (len1 === 0 || len2 === 0) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    // Clamp radius to half of shortest adjacent segment
    const r = Math.min(radius, len1 / 2, len2 / 2);

    // Unit vectors
    const u1x = d1x / len1;
    const u1y = d1y / len1;
    const u2x = d2x / len2;
    const u2y = d2y / len2;

    // Points where the arc starts and ends
    const arcStartX = curr.x - u1x * r;
    const arcStartY = curr.y - u1y * r;
    const arcEndX = curr.x + u2x * r;
    const arcEndY = curr.y + u2y * r;

    // Determine sweep direction using cross product
    const cross = u1x * u2y - u1y * u2x;
    const sweepFlag = cross > 0 ? 1 : 0;

    d += ` L ${arcStartX} ${arcStartY}`;
    d += ` A ${r} ${r} 0 0 ${sweepFlag} ${arcEndX} ${arcEndY}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;

  return d;
}

/**
 * Full orthogonal path from source rect to target rect.
 * Returns an SVG path string with rounded corners.
 */
function orthogonalPath(sr: Rect, tr: Rect): string {
  const { source, target } = bestAnchorPair(sr, tr);

  const exit = extendFromAnchor(source, GAP);
  const entry = extendFromAnchor(target, GAP);

  const waypoints = routeBetween(exit, source.side, entry, target.side);

  const allPoints = [
    { x: source.x, y: source.y },
    exit,
    ...waypoints,
    entry,
    { x: target.x, y: target.y },
  ];

  return buildRoundedPath(allPoints, RADIUS);
}

/**
 * Find the midpoint along a series of line segments for placing labels/indicators.
 */
function pathMidpoint(sr: Rect, tr: Rect): { x: number; y: number } {
  const { source, target } = bestAnchorPair(sr, tr);
  const exit = extendFromAnchor(source, GAP);
  const entry = extendFromAnchor(target, GAP);
  const waypoints = routeBetween(exit, source.side, entry, target.side);

  const allPoints = [
    { x: source.x, y: source.y },
    exit,
    ...waypoints,
    entry,
    { x: target.x, y: target.y },
  ];

  // Calculate total path length and find midpoint
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 1; i < allPoints.length; i++) {
    const dx = allPoints[i].x - allPoints[i - 1].x;
    const dy = allPoints[i].y - allPoints[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segLens.push(len);
    totalLen += len;
  }

  const halfLen = totalLen / 2;
  let accumulated = 0;
  for (let i = 0; i < segLens.length; i++) {
    if (accumulated + segLens[i] >= halfLen) {
      const t = (halfLen - accumulated) / segLens[i];
      return {
        x: allPoints[i].x + (allPoints[i + 1].x - allPoints[i].x) * t,
        y: allPoints[i].y + (allPoints[i + 1].y - allPoints[i].y) * t,
      };
    }
    accumulated += segLens[i];
  }

  // Fallback to center of source-target
  return {
    x: (sr.x + sr.w / 2 + tr.x + tr.w / 2) / 2,
    y: (sr.y + sr.h / 2 + tr.y + tr.h / 2) / 2,
  };
}

/** Get closest anchor of a rect to a point (for pending arrow). */
function closestAnchor(r: Rect, px: number, py: number): Anchor {
  const anchors = getAnchors(r);
  let best: Anchor = anchors.top;
  let bestDist = Infinity;

  for (const a of Object.values(anchors)) {
    const dx = a.x - px;
    const dy = a.y - py;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = a;
    }
  }

  return best;
}

function itemRect(item: MoodboardItemClient): Rect {
  return { x: item.x, y: item.y, w: item.width, h: item.height || 200 };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectionLayer({
  connections,
  items,
  onDeleteConnection,
  pendingSourceId,
  pendingTarget,
  onHoverConnection,
}: ConnectionLayerProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const itemMap = new Map(items.map((i) => [i.id, i]));

  return (
    <svg
      className="pointer-events-none"
      viewBox="-10000 -10000 30000 30000"
      style={{
        position: "absolute",
        left: -10000,
        top: -10000,
        width: 30000,
        height: 30000,
        overflow: "visible",
      }}
    >
      <defs>
        {/* FigJam-style bold arrowheads — strokeWidth units for zoom-independent size */}
        <marker
          id="arrowhead"
          markerWidth="5"
          markerHeight="4"
          refX="4.5"
          refY="2"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 5 2 L 0 4 Z" fill={STROKE_COLOR} />
        </marker>
        <marker
          id="arrowhead-hover"
          markerWidth="5"
          markerHeight="4"
          refX="4.5"
          refY="2"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 5 2 L 0 4 Z" fill="#ef4444" />
        </marker>
        <marker
          id="arrowhead-pending"
          markerWidth="5"
          markerHeight="4"
          refX="4.5"
          refY="2"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 5 2 L 0 4 Z" fill="#F15B2B" />
        </marker>
      </defs>

      {/* Render existing connections */}
      {connections.map((conn) => {
        const source = itemMap.get(conn.sourceItemId);
        const target = itemMap.get(conn.targetItemId);
        if (!source || !target) return null;

        const sr = itemRect(source);
        const tr = itemRect(target);

        const pathD = orthogonalPath(sr, tr);
        const mid = pathMidpoint(sr, tr);

        const isHovered = hoveredId === conn.id;
        // Use new dark color unless user has explicitly set a custom (non-legacy) color
        const customColor = conn.color && !LEGACY_DEFAULTS.has(conn.color) ? conn.color : null;
        const strokeColor = isHovered ? "#ef4444" : (customColor ?? STROKE_COLOR);
        const marker = isHovered ? "url(#arrowhead-hover)" : "url(#arrowhead)";

        return (
          <g key={conn.id}>
            {/* Invisible wider path for easier hover/click targeting */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              className="pointer-events-stroke cursor-pointer"
              onMouseEnter={() => {
                setHoveredId(conn.id);
                onHoverConnection?.(conn.id);
              }}
              onMouseLeave={() => {
                setHoveredId(null);
                onHoverConnection?.(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConnection(conn.id);
              }}
            />
            {/* Visible path */}
            <path
              d={pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isHovered ? STROKE_WIDTH_HOVER : STROKE_WIDTH}
              strokeDasharray={conn.style === "dashed" ? "8 4" : undefined}
              markerEnd={marker}
              className="pointer-events-none transition-colors"
            />
            {/* Delete indicator on hover */}
            {isHovered && (
              <g transform={`translate(${mid.x - 8}, ${mid.y - 8})`}>
                <circle
                  cx="8"
                  cy="8"
                  r="10"
                  fill="white"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  className="pointer-events-none"
                />
                <text
                  x="8"
                  y="12"
                  textAnchor="middle"
                  fontSize="12"
                  fill="#ef4444"
                  className="pointer-events-none"
                >
                  ×
                </text>
              </g>
            )}
            {/* Label */}
            {conn.label && (
              <text
                x={mid.x}
                y={mid.y - 12}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
                className="pointer-events-none"
              >
                {conn.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Pending arrow (being created — from source anchor to mouse cursor) */}
      {pendingSourceId &&
        pendingTarget &&
        (() => {
          const source = itemMap.get(pendingSourceId);
          if (!source) return null;
          const sr = itemRect(source);
          const anchor = closestAnchor(sr, pendingTarget.x, pendingTarget.y);
          return (
            <path
              d={`M ${anchor.x} ${anchor.y} L ${pendingTarget.x} ${pendingTarget.y}`}
              fill="none"
              stroke="#F15B2B"
              strokeWidth={STROKE_WIDTH}
              strokeDasharray="8 4"
              markerEnd="url(#arrowhead-pending)"
              className="pointer-events-none"
            />
          );
        })()}
    </svg>
  );
}
