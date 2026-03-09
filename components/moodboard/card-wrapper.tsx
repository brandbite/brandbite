"use client";

import React, { useState, useRef, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CANVAS_DEFAULTS } from "@/lib/moodboard";

type CardWrapperProps = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  children: React.ReactNode;
  onDelete?: () => void;
  onResize?: (width: number, height: number) => void;
};

const { MIN_WIDTH, MIN_HEIGHT } = CANVAS_DEFAULTS;

export function CardWrapper({
  id,
  x,
  y,
  width,
  height,
  zoom,
  children,
  onDelete,
  onResize,
}: CardWrapperProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useDraggable({ id });

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Resize state — use state (not ref) for values read during render
  const [resizing, setResizing] = useState(false);
  const [resizeOrigin, setResizeOrigin] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [resizeDelta, setResizeDelta] = useState({ dw: 0, dh: 0 });

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Resize handlers
  function onResizePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const origin = { x: e.clientX, y: e.clientY, w: width, h: height || 200 };
    setResizeOrigin(origin);
    setResizeDelta({ dw: 0, dh: 0 });
    setResizing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onResizePointerMove(e: React.PointerEvent) {
    if (!resizing) return;
    const dw = (e.clientX - resizeOrigin.x) / zoom;
    const dh = (e.clientY - resizeOrigin.y) / zoom;
    setResizeDelta({ dw, dh });
  }

  function onResizePointerUp(e: React.PointerEvent) {
    if (!resizing) return;
    setResizing(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    const newW = Math.max(MIN_WIDTH, resizeOrigin.w + resizeDelta.dw);
    const newH = Math.max(MIN_HEIGHT, resizeOrigin.h + resizeDelta.dh);
    setResizeDelta({ dw: 0, dh: 0 });
    onResize?.(newW, newH);
  }

  // Position: base + drag offset (in screen space, which canvas div undoes via its transform)
  const dragOffsetX = transform ? transform.x / zoom : 0;
  const dragOffsetY = transform ? transform.y / zoom : 0;

  const currentW = resizing ? Math.max(MIN_WIDTH, resizeOrigin.w + resizeDelta.dw) : width;
  const currentH = resizing ? Math.max(MIN_HEIGHT, resizeOrigin.h + resizeDelta.dh) : height;

  const style: React.CSSProperties = {
    position: "absolute",
    left: x + dragOffsetX,
    top: y + dragOffsetY,
    width: currentW,
    ...(currentH > 0 ? { height: currentH } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-white shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? "z-50 opacity-80 shadow-xl" : ""
      }`}
      {...attributes}
    >
      {/* Drag handle + menu — always visible */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {/* Drag handle */}
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          className="flex h-7 w-7 cursor-grab items-center justify-center rounded-lg bg-white/80 shadow-sm hover:bg-gray-100 active:cursor-grabbing"
          aria-label="Drag to move"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="text-[var(--bb-text-secondary)]"
          >
            <circle cx="4" cy="2" r="1.25" fill="currentColor" />
            <circle cx="10" cy="2" r="1.25" fill="currentColor" />
            <circle cx="4" cy="7" r="1.25" fill="currentColor" />
            <circle cx="10" cy="7" r="1.25" fill="currentColor" />
            <circle cx="4" cy="12" r="1.25" fill="currentColor" />
            <circle cx="10" cy="12" r="1.25" fill="currentColor" />
          </svg>
        </button>

        {/* Menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 shadow-sm hover:bg-gray-100"
            aria-label="Card options"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="text-[var(--bb-text-secondary)]"
            >
              <circle cx="7" cy="2.5" r="1.25" fill="currentColor" />
              <circle cx="7" cy="7" r="1.25" fill="currentColor" />
              <circle cx="7" cy="11.5" r="1.25" fill="currentColor" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute top-8 right-0 z-20 w-40 rounded-xl border border-[var(--bb-border)] bg-white py-1 shadow-lg">
              {onDelete && (
                <button
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {children}

      {/* Resize handle — bottom-right corner */}
      <div
        className="absolute right-0 bottom-0 z-10 flex h-5 w-5 cursor-se-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-gray-400">
          <path
            d="M9 1L1 9M9 5L5 9M9 9L9 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
