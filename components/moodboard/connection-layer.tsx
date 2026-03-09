"use client";

import React, { useState } from "react";
import type { MoodboardConnection, MoodboardItemClient } from "@/lib/moodboard";

type ConnectionLayerProps = {
  connections: MoodboardConnection[];
  items: MoodboardItemClient[];
  onDeleteConnection: (id: string) => void;
  /** In arrow creation mode, this is the source item ID (first click done). */
  pendingSourceId: string | null;
  /** Current mouse position in canvas coords (for temp arrow while creating). */
  pendingTarget: { x: number; y: number } | null;
};

/**
 * Compute the point on the edge of a rectangle closest to a target point,
 * along the line from rect center to target.
 */
function edgePoint(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  tx: number,
  ty: number,
): { x: number; y: number } {
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const dx = tx - cx;
  const dy = ty - cy;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const halfW = rw / 2;
  const halfH = rh / 2;

  // Scale factor to reach the edge
  let scale: number;
  if (absDx / halfW > absDy / halfH) {
    scale = halfW / absDx;
  } else {
    scale = halfH / absDy;
  }

  return { x: cx + dx * scale, y: cy + dy * scale };
}

function itemCenter(item: MoodboardItemClient) {
  return { x: item.x + item.width / 2, y: item.y + (item.height || 200) / 2 };
}

function itemRect(item: MoodboardItemClient) {
  return { x: item.x, y: item.y, w: item.width, h: item.height || 200 };
}

/** Slight bezier curve offset for visual polish. */
function curvedPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Perpendicular offset proportional to distance (subtle curve)
  const offset = Math.min(dist * 0.1, 30);
  const cx = mx - (dy / dist) * offset;
  const cy = my + (dx / dist) * offset;

  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export function ConnectionLayer({
  connections,
  items,
  onDeleteConnection,
  pendingSourceId,
  pendingTarget,
}: ConnectionLayerProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const itemMap = new Map(items.map((i) => [i.id, i]));

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
        </marker>
        <marker
          id="arrowhead-hover"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
        </marker>
        <marker
          id="arrowhead-pending"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#F15B2B" />
        </marker>
      </defs>

      {/* Render existing connections */}
      {connections.map((conn) => {
        const source = itemMap.get(conn.sourceItemId);
        const target = itemMap.get(conn.targetItemId);
        if (!source || !target) return null;

        const tc = itemCenter(target);
        const sc = itemCenter(source);
        const sr = itemRect(source);
        const tr = itemRect(target);

        const start = edgePoint(sr.x, sr.y, sr.w, sr.h, tc.x, tc.y);
        const end = edgePoint(tr.x, tr.y, tr.w, tr.h, sc.x, sc.y);

        const isHovered = hoveredId === conn.id;
        const strokeColor = isHovered ? "#ef4444" : (conn.color ?? "#9ca3af");
        const marker = isHovered ? "url(#arrowhead-hover)" : "url(#arrowhead)";

        return (
          <g key={conn.id}>
            {/* Invisible wider path for easier hover/click targeting */}
            <path
              d={curvedPath(start.x, start.y, end.x, end.y)}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              className="pointer-events-stroke cursor-pointer"
              onMouseEnter={() => setHoveredId(conn.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConnection(conn.id);
              }}
            />
            {/* Visible path */}
            <path
              d={curvedPath(start.x, start.y, end.x, end.y)}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isHovered ? 3 : 2}
              strokeDasharray={conn.style === "dashed" ? "8 4" : undefined}
              markerEnd={marker}
              className="pointer-events-none transition-colors"
            />
            {/* Delete indicator on hover */}
            {isHovered && (
              <g
                transform={`translate(${(start.x + end.x) / 2 - 8}, ${(start.y + end.y) / 2 - 8})`}
              >
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
                x={(start.x + end.x) / 2}
                y={(start.y + end.y) / 2 - 8}
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

      {/* Pending arrow (being created — from source to mouse cursor) */}
      {pendingSourceId &&
        pendingTarget &&
        (() => {
          const source = itemMap.get(pendingSourceId);
          if (!source) return null;
          const sr = itemRect(source);
          const start = edgePoint(sr.x, sr.y, sr.w, sr.h, pendingTarget.x, pendingTarget.y);
          return (
            <path
              d={`M ${start.x} ${start.y} L ${pendingTarget.x} ${pendingTarget.y}`}
              fill="none"
              stroke="#F15B2B"
              strokeWidth={2}
              strokeDasharray="6 3"
              markerEnd="url(#arrowhead-pending)"
              className="pointer-events-none"
            />
          );
        })()}
    </svg>
  );
}
