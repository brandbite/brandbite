"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";

import { CardWrapper } from "@/components/moodboard/card-wrapper";
import { CanvasControls } from "@/components/moodboard/canvas-controls";
import { NoteCard } from "@/components/moodboard/note-card";
import { ImageCard } from "@/components/moodboard/image-card";
import { ColorCard } from "@/components/moodboard/color-card";
import { LinkCard } from "@/components/moodboard/link-card";
import { FileCard } from "@/components/moodboard/file-card";
import { TodoCard } from "@/components/moodboard/todo-card";
import { useCanvasTransform } from "@/components/moodboard/use-canvas-transform";

import type { MoodboardItemClient, MoodboardItemData } from "@/lib/moodboard";
import {
  isNoteData,
  isImageData,
  isColorData,
  isLinkData,
  isFileData,
  isTodoData,
} from "@/lib/moodboard";

type BoardCanvasProps = {
  items: MoodboardItemClient[];
  onUpdateItem: (itemId: string, data: MoodboardItemData) => void;
  onDeleteItem: (itemId: string) => void;
  onMoveItem: (itemId: string, x: number, y: number) => void;
  onResizeItem: (itemId: string, width: number, height: number) => void;
};

function renderCard(item: MoodboardItemClient, onUpdate: (data: MoodboardItemData) => void) {
  const { type, data } = item;

  if (isNoteData(type, data)) return <NoteCard data={data} onUpdate={onUpdate} />;
  if (isImageData(type, data)) return <ImageCard data={data} onUpdate={onUpdate} />;
  if (isColorData(type, data)) return <ColorCard data={data} onUpdate={onUpdate} />;
  if (isLinkData(type, data)) return <LinkCard data={data} />;
  if (isFileData(type, data)) return <FileCard data={data} />;
  if (isTodoData(type, data)) return <TodoCard data={data} onUpdate={onUpdate} />;

  return null;
}

export function BoardCanvas({
  items,
  onUpdateItem,
  onDeleteItem,
  onMoveItem,
  onResizeItem,
}: BoardCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const {
    transform,
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
  } = useCanvasTransform(items, viewportRef);

  const { panX, panY, zoom } = transform;

  // Register space key listeners
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onKeyDown, onKeyUp]);

  // @dnd-kit sensors — higher distance threshold to avoid accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  // Drag end — calculate new canvas position from delta
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event;
      const item = items.find((i) => i.id === active.id);
      if (!item) return;

      const newX = Math.max(0, item.x + delta.x / zoom);
      const newY = Math.max(0, item.y + delta.y / zoom);

      onMoveItem(String(active.id), newX, newY);
    },
    [items, zoom, onMoveItem],
  );

  const handleFitToContent = useCallback(() => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    fitToContent(items, rect.width, rect.height);
  }, [items, fitToContent]);

  // Auto-fit content into view on initial load
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (didInitialFit.current || items.length === 0 || !viewportRef.current) return;
    didInitialFit.current = true;
    const rect = viewportRef.current.getBoundingClientRect();
    fitToContent(items, rect.width, rect.height);
  }, [items, fitToContent]);

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bb-bg-warm)]">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M14 7V21M7 14H21"
              stroke="var(--bb-text-secondary)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">
          Your moodboard is empty
        </h3>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Use the toolbar to add notes, images, colors, and more.
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* Viewport — clips and captures scroll/pan */}
      <div
        ref={viewportRef}
        className="relative flex-1 overflow-hidden"
        style={{ cursor: "default" }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Dot grid background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, #d1d5db 1px, transparent 1px)`,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${panX % (20 * zoom)}px ${panY % (20 * zoom)}px`,
          }}
        />

        {/* Transformed canvas layer */}
        <div
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: "0 0",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {items.map((item) => (
            <CardWrapper
              key={item.id}
              id={item.id}
              x={item.x}
              y={item.y}
              width={item.width}
              height={item.height}
              zoom={zoom}
              onDelete={() => onDeleteItem(item.id)}
              onResize={(w, h) => onResizeItem(item.id, w, h)}
            >
              {renderCard(item, (data) => onUpdateItem(item.id, data))}
            </CardWrapper>
          ))}
        </div>

        {/* Floating zoom controls */}
        <CanvasControls
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetView}
          onFitToContent={handleFitToContent}
        />
      </div>
    </DndContext>
  );
}
