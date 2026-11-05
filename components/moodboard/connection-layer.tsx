"use client";

import React, { memo, useState, useSyncExternalStore } from "react";
import type { MoodboardConnection, MoodboardItemClient } from "@/lib/moodboard";

import type { CardOverrideStore } from "./card-override-store";
import { roundedPath, routeConnection, routeMidpoint, type RouteRect } from "./connection-routing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectionLayerProps = {
  connections: MoodboardConnection[];
  items: MoodboardItemClient[];
  /** The cards being moved or resized right now, if any. */
  overrides: CardOverrideStore;
  selectedId: string | null;
  /** Arrows can only be picked with the Select tool. */
  interactive: boolean;
  onSelectConnection: (id: string) => void;
  onDeleteConnection: (id: string) => void;
  /** In arrow creation mode, this is the source item ID (first click done). */
  pendingSourceId: string | null;
  /** Current mouse position in canvas coords (for temp arrow while creating). */
  pendingTarget: { x: number; y: number } | null;
  /** The object under the pointer while drawing an arrow. */
  pendingTargetId?: string | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STROKE_COLOR = "#4A4A4A";
/** A hovered or selected arrow. */
const SELECTED_COLOR = "#F15B2B";
/** Old default colors stored in DB — treat as "no custom color". */
const LEGACY_DEFAULTS = new Set(["#b8b5af", "#9ca3af"]);
const STROKE_WIDTH = 2.5;
const STROKE_WIDTH_HOVER = 3;

function itemRect(item: MoodboardItemClient): RouteRect {
  return { x: item.x, y: item.y, w: item.width, h: item.height || 200 };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ConnectionLayerBase({
  connections,
  items,
  overrides,
  selectedId,
  interactive,
  onSelectConnection,
  onDeleteConnection,
  pendingSourceId,
  pendingTarget,
  pendingTargetId,
}: ConnectionLayerProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // While a card moves, its arrows follow the live position, not the saved one.
  const moving = useSyncExternalStore(overrides.subscribe, overrides.get, overrides.get);

  const itemMap = new Map(
    items.map((i) => {
      const override = moving?.find((o) => o.id === i.id);
      return [
        i.id,
        override
          ? {
              ...i,
              x: override.x,
              y: override.y,
              width: override.width ?? i.width,
              height: override.height ?? i.height,
            }
          : i,
      ];
    }),
  );

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
          markerWidth="7"
          markerHeight="6"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0.2 L 6.5 3 L 0 5.8 Z" fill={STROKE_COLOR} />
        </marker>
        <marker
          id="arrowhead-hover"
          markerWidth="7"
          markerHeight="6"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0.2 L 6.5 3 L 0 5.8 Z" fill="#ef4444" />
        </marker>
        <marker
          id="arrowhead-pending"
          markerWidth="7"
          markerHeight="6"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0.2 L 6.5 3 L 0 5.8 Z" fill="#F15B2B" />
        </marker>
      </defs>

      {/* Render existing connections */}
      {connections.map((conn) => {
        const source = itemMap.get(conn.sourceItemId);
        const target = itemMap.get(conn.targetItemId);
        if (!source || !target) return null;

        const { points } = routeConnection(itemRect(source), itemRect(target));
        const pathD = roundedPath(points);
        const mid = routeMidpoint(points);

        const isHovered = hoveredId === conn.id;
        const isSelected = selectedId === conn.id;
        // Use new dark color unless user has explicitly set a custom (non-legacy) color
        const customColor = conn.color && !LEGACY_DEFAULTS.has(conn.color) ? conn.color : null;
        const strokeColor =
          isSelected || isHovered ? SELECTED_COLOR : (customColor ?? STROKE_COLOR);
        const marker = isSelected || isHovered ? "url(#arrowhead-pending)" : "url(#arrowhead)";

        return (
          <g key={conn.id}>
            {/* Invisible wider path for easier hover/click targeting. The svg has
                pointer-events: none, so this has to opt back in with an inline style. */}
            {interactive && (
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                data-testid={`connection-${conn.id}`}
                onMouseEnter={() => setHoveredId(conn.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectConnection(conn.id);
                }}
              />
            )}
            {/* Visible path */}
            <path
              d={pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isSelected || isHovered ? STROKE_WIDTH_HOVER : STROKE_WIDTH}
              strokeDasharray={conn.style === "dashed" ? "8 4" : undefined}
              markerEnd={marker}
              className="pointer-events-none"
            />
            {/* Delete button on the selected arrow */}
            {isSelected && (
              <g
                transform={`translate(${mid.x - 8}, ${mid.y - 8})`}
                style={{ pointerEvents: "auto", cursor: "pointer" }}
                role="button"
                aria-label="Delete arrow"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConnection(conn.id);
                }}
              >
                <circle cx="8" cy="8" r="11" fill="white" stroke="#ef4444" strokeWidth="1.5" />
                <text x="8" y="12" textAnchor="middle" fontSize="13" fill="#ef4444">
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

      {/* Arrow being drawn: routes like a finished one, snapping to a hovered object */}
      {pendingSourceId &&
        pendingTarget &&
        (() => {
          const source = itemMap.get(pendingSourceId);
          if (!source) return null;
          const hovered = pendingTargetId ? itemMap.get(pendingTargetId) : null;
          const end = hovered
            ? itemRect(hovered)
            : { x: pendingTarget.x, y: pendingTarget.y, w: 0, h: 0 };
          return (
            <path
              d={roundedPath(routeConnection(itemRect(source), end).points)}
              fill="none"
              stroke={SELECTED_COLOR}
              strokeWidth={STROKE_WIDTH}
              markerEnd="url(#arrowhead-pending)"
              className="pointer-events-none"
            />
          );
        })()}
    </svg>
  );
}

export const ConnectionLayer = memo(ConnectionLayerBase);
