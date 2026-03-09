"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type CardWrapperProps = {
  id: string;
  children: React.ReactNode;
  onDelete?: () => void;
  onToggleWidth?: () => void;
  colSpan?: number;
  isDragging?: boolean;
};

export function CardWrapper({
  id,
  children,
  onDelete,
  onToggleWidth,
  colSpan,
  isDragging,
}: CardWrapperProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    useSortable({ id });

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(colSpan === 2 ? { gridColumn: "span 2" } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-white shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? "opacity-50" : ""
      }`}
      {...attributes}
    >
      {/* Drag handle + menu — always visible */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {/* Drag handle (grip icon) */}
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          className="flex h-7 w-7 cursor-grab items-center justify-center rounded-lg bg-white/80 shadow-sm hover:bg-gray-100 active:cursor-grabbing"
          aria-label="Drag to reorder"
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

        {/* Three-dot menu */}
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
              {onToggleWidth && (
                <button
                  onClick={() => {
                    onToggleWidth();
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[var(--bb-secondary)] hover:bg-gray-50"
                >
                  Toggle width
                </button>
              )}
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
    </div>
  );
}
