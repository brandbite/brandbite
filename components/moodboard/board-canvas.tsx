"use client";

import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { DragOverlay } from "@dnd-kit/core";

import { CardWrapper } from "@/components/moodboard/card-wrapper";
import { NoteCard } from "@/components/moodboard/note-card";
import { ImageCard } from "@/components/moodboard/image-card";
import { ColorCard } from "@/components/moodboard/color-card";
import { LinkCard } from "@/components/moodboard/link-card";
import { FileCard } from "@/components/moodboard/file-card";
import { TodoCard } from "@/components/moodboard/todo-card";

import type {
  MoodboardItemClient,
  MoodboardItemData,
} from "@/lib/moodboard";
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
  onReorder: (orderedIds: string[]) => void;
  onUpdateItem: (itemId: string, data: MoodboardItemData) => void;
  onDeleteItem: (itemId: string) => void;
  onToggleItemWidth: (itemId: string) => void;
};

function renderCard(
  item: MoodboardItemClient,
  onUpdate: (data: MoodboardItemData) => void,
) {
  const { type, data } = item;

  if (isNoteData(type, data)) {
    return <NoteCard data={data} onUpdate={onUpdate} />;
  }
  if (isImageData(type, data)) {
    return <ImageCard data={data} onUpdate={onUpdate} />;
  }
  if (isColorData(type, data)) {
    return <ColorCard data={data} onUpdate={onUpdate} />;
  }
  if (isLinkData(type, data)) {
    return <LinkCard data={data} />;
  }
  if (isFileData(type, data)) {
    return <FileCard data={data} />;
  }
  if (isTodoData(type, data)) {
    return <TodoCard data={data} onUpdate={onUpdate} />;
  }

  return null;
}

export function BoardCanvas({
  items,
  onReorder,
  onUpdateItem,
  onDeleteItem,
  onToggleItemWidth,
}: BoardCanvasProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeItem = activeId
    ? items.find((item) => item.id === activeId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Build reordered array
    const reordered = [...items];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    onReorder(reordered.map((item) => item.id));
  }

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <CardWrapper
              key={item.id}
              id={item.id}
              colSpan={item.colSpan}
              isDragging={item.id === activeId}
              onDelete={() => onDeleteItem(item.id)}
              onToggleWidth={() => onToggleItemWidth(item.id)}
            >
              {renderCard(item, (data) => onUpdateItem(item.id, data))}
            </CardWrapper>
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeItem ? (
          <div className="rounded-2xl border border-[var(--bb-border)] bg-white shadow-xl opacity-90">
            {renderCard(activeItem, () => {})}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
