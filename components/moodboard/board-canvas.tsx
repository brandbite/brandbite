"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";

import { CardWrapper } from "@/components/moodboard/card-wrapper";
import { CanvasControls } from "@/components/moodboard/canvas-controls";
import { ConnectionLayer } from "@/components/moodboard/connection-layer";
import { DrawingLayer } from "@/components/moodboard/drawing-layer";
import { NoteCard } from "@/components/moodboard/note-card";
import { ImageCard } from "@/components/moodboard/image-card";
import { ColorCard } from "@/components/moodboard/color-card";
import { LinkCard } from "@/components/moodboard/link-card";
import { FileCard } from "@/components/moodboard/file-card";
import { TodoCard } from "@/components/moodboard/todo-card";
import { EmbedCard } from "@/components/moodboard/embed-card";
import { useCanvasTransform } from "@/components/moodboard/use-canvas-transform";

import type {
  MoodboardItemClient,
  MoodboardItemData,
  MoodboardConnection,
  DrawingCardData,
} from "@/lib/moodboard";
import {
  isNoteData,
  isImageData,
  isColorData,
  isLinkData,
  isFileData,
  isTodoData,
  isEmbedData,
} from "@/lib/moodboard";
import type { ToolMode } from "@/components/moodboard/board-toolbar";

type BoardCanvasProps = {
  items: MoodboardItemClient[];
  connections: MoodboardConnection[];
  toolMode: ToolMode;
  drawColor: string;
  drawSize: number;
  onUpdateItem: (itemId: string, data: MoodboardItemData) => void;
  onDeleteItem: (itemId: string) => void;
  onMoveItem: (itemId: string, x: number, y: number) => void;
  onResizeItem: (itemId: string, width: number, height: number) => void;
  onAddConnection: (sourceId: string, targetId: string) => void;
  onDeleteConnection: (id: string) => void;
  onAddDrawing: (
    data: DrawingCardData,
    bounds: { x: number; y: number; w: number; h: number },
  ) => void;
};

function renderCard(item: MoodboardItemClient, onUpdate: (data: MoodboardItemData) => void) {
  const { type, data } = item;

  if (isNoteData(type, data)) return <NoteCard data={data} onUpdate={onUpdate} />;
  if (isImageData(type, data)) return <ImageCard data={data} onUpdate={onUpdate} />;
  if (isColorData(type, data)) return <ColorCard data={data} onUpdate={onUpdate} />;
  if (isLinkData(type, data)) return <LinkCard data={data} />;
  if (isFileData(type, data)) return <FileCard data={data} />;
  if (isTodoData(type, data)) return <TodoCard data={data} onUpdate={onUpdate} />;
  if (isEmbedData(type, data)) return <EmbedCard data={data} />;

  return null;
}

export function BoardCanvas({
  items,
  connections,
  toolMode,
  drawColor,
  drawSize,
  onUpdateItem,
  onDeleteItem,
  onMoveItem,
  onResizeItem,
  onAddConnection,
  onDeleteConnection,
  onAddDrawing,
}: BoardCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  // Arrow creation state
  const [arrowSourceId, setArrowSourceId] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<{ x: number; y: number } | null>(null);
  const [prevToolMode, setPrevToolMode] = useState(toolMode);

  // Drawing selection state
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  // Hovered connection (for keyboard delete)
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);

  // Separate card items from drawings
  const cardItems = items.filter((i) => i.type !== "DRAWING");
  const drawings = items.filter((i) => i.type === "DRAWING");

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

  // Reset state when switching tool modes (React-recommended pattern)
  if (prevToolMode !== toolMode) {
    setPrevToolMode(toolMode);
    if (toolMode !== "arrow") {
      setArrowSourceId(null);
      setPendingTarget(null);
    }
    // Only clear drawing selection when entering arrow mode
    if (toolMode === "arrow") {
      setSelectedDrawingId(null);
    }
  }

  // Escape cancels arrow creation
  useEffect(() => {
    if (toolMode !== "arrow") return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setArrowSourceId(null);
        setPendingTarget(null);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [toolMode]);

  // Delete/Backspace deletes selected drawing or hovered connection
  useEffect(() => {
    function handleDeleteKey(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;

      // Don't intercept if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Priority 1: Delete selected drawing
      if (selectedDrawingId) {
        e.preventDefault();
        onDeleteItem(selectedDrawingId);
        setSelectedDrawingId(null);
        return;
      }

      // Priority 2: Delete hovered connection
      if (hoveredConnectionId) {
        e.preventDefault();
        onDeleteConnection(hoveredConnectionId);
        setHoveredConnectionId(null);
        return;
      }
    }

    window.addEventListener("keydown", handleDeleteKey);
    return () => window.removeEventListener("keydown", handleDeleteKey);
  }, [selectedDrawingId, hoveredConnectionId, onDeleteItem, onDeleteConnection]);

  // Track cursor position for pending arrow
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (toolMode !== "arrow" || !arrowSourceId || !viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      setPendingTarget({
        x: (e.clientX - rect.left - panX) / zoom,
        y: (e.clientY - rect.top - panY) / zoom,
      });
    },
    [toolMode, arrowSourceId, panX, panY, zoom],
  );

  // Handle card click in arrow mode
  function handleArrowCardClick(itemId: string) {
    if (!arrowSourceId) {
      // First click — select source
      setArrowSourceId(itemId);
    } else if (arrowSourceId !== itemId) {
      // Second click — create connection
      onAddConnection(arrowSourceId, itemId);
      setArrowSourceId(null);
      setPendingTarget(null);
    }
  }

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
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--bb-border-subtle)] bg-white/60">
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
        style={{ cursor: toolMode === "arrow" || toolMode === "draw" ? "crosshair" : "default" }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onMouseMove={handleMouseMove}
      >
        {/* Dot grid background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, #ddd9d4 0.75px, transparent 0.75px)`,
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${panX % (24 * zoom)}px ${panY % (24 * zoom)}px`,
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
          {/* Cards (excluding drawings) */}
          {cardItems.map((item) => (
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

          {/* Drawing layer — SVG strokes */}
          <DrawingLayer
            drawings={drawings}
            active={toolMode === "draw"}
            strokeColor={drawColor}
            strokeWidth={drawSize}
            panX={panX}
            panY={panY}
            zoom={zoom}
            viewportRef={viewportRef}
            onStrokeComplete={onAddDrawing}
            onSelectDrawing={toolMode === "select" ? setSelectedDrawingId : undefined}
            selectedDrawingId={selectedDrawingId}
            onDeleteDrawing={toolMode === "select" ? onDeleteItem : undefined}
          />

          {/* Connection arrows layer */}
          <ConnectionLayer
            connections={connections}
            items={cardItems}
            onDeleteConnection={onDeleteConnection}
            pendingSourceId={arrowSourceId}
            pendingTarget={pendingTarget}
            onHoverConnection={setHoveredConnectionId}
          />

          {/* Arrow mode — click overlays on cards */}
          {toolMode === "arrow" &&
            cardItems.map((item) => (
              <div
                key={`arrow-target-${item.id}`}
                className={`absolute rounded-2xl border-2 transition-colors ${
                  arrowSourceId === item.id
                    ? "border-[var(--bb-primary)] bg-[var(--bb-primary)]/10"
                    : "border-transparent hover:border-[var(--bb-primary)]/50 hover:bg-[var(--bb-primary)]/5"
                }`}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height || 200,
                  zIndex: 100,
                  cursor: "crosshair",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleArrowCardClick(item.id);
                }}
              />
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
