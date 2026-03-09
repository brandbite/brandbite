// -----------------------------------------------------------------------------
// @file: lib/moodboard.ts
// @purpose: Shared TypeScript types and helpers for the Moodboard feature
// -----------------------------------------------------------------------------

import type { MoodboardItemType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Card data shapes (stored as JSON in MoodboardItem.data)
// ---------------------------------------------------------------------------

export type NoteCardData = {
  title?: string;
  body: string;
};

export type ImageCardData = {
  url: string;
  storageKey: string;
  caption?: string;
  width?: number;
  height?: number;
  originalName?: string;
  mimeType?: string;
  bytes?: number;
};

export type ColorCardData = {
  hex: string;
  name?: string;
};

export type LinkCardData = {
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  image?: string;
};

export type FileCardData = {
  url: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  bytes: number;
};

export type TodoItem = {
  id: string;
  text: string;
  checked: boolean;
};

export type TodoCardData = {
  title?: string;
  items: TodoItem[];
};

export type MoodboardItemData =
  | NoteCardData
  | ImageCardData
  | ColorCardData
  | LinkCardData
  | FileCardData
  | TodoCardData;

// ---------------------------------------------------------------------------
// Type-safe data accessors
// ---------------------------------------------------------------------------

export function isNoteData(type: MoodboardItemType, data: unknown): data is NoteCardData {
  return type === "NOTE";
}

export function isImageData(type: MoodboardItemType, data: unknown): data is ImageCardData {
  return type === "IMAGE";
}

export function isColorData(type: MoodboardItemType, data: unknown): data is ColorCardData {
  return type === "COLOR";
}

export function isLinkData(type: MoodboardItemType, data: unknown): data is LinkCardData {
  return type === "LINK";
}

export function isFileData(type: MoodboardItemType, data: unknown): data is FileCardData {
  return type === "FILE";
}

export function isTodoData(type: MoodboardItemType, data: unknown): data is TodoCardData {
  return type === "TODO";
}

// ---------------------------------------------------------------------------
// Client-side item type (what the UI works with)
// ---------------------------------------------------------------------------

export type MoodboardItemClient = {
  id: string;
  type: MoodboardItemType;
  position: number;
  colSpan: number;
  data: MoodboardItemData;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type MoodboardClient = {
  id: string;
  title: string;
  description: string | null;
  companyId: string;
  projectId: string | null;
  ticketId: string | null;
  createdById: string;
  items: MoodboardItemClient[];
  project?: { id: string; name: string } | null;
  ticket?: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Defaults for new items
// ---------------------------------------------------------------------------

export function defaultNoteData(): NoteCardData {
  return { title: "", body: "" };
}

export function defaultColorData(): ColorCardData {
  return { hex: "#F15B2B", name: "" };
}

export function defaultTodoData(): TodoCardData {
  return {
    title: "",
    items: [{ id: crypto.randomUUID(), text: "", checked: false }],
  };
}

// ---------------------------------------------------------------------------
// Preset color palette
// ---------------------------------------------------------------------------

export const COLOR_PRESETS = [
  { hex: "#F15B2B", name: "BrandBite Orange" },
  { hex: "#424143", name: "Dark Gray" },
  { hex: "#4C8EF7", name: "Blue" },
  { hex: "#32B37B", name: "Green" },
  { hex: "#D63A35", name: "Red" },
  { hex: "#8B5CF6", name: "Purple" },
  { hex: "#EC4899", name: "Pink" },
  { hex: "#F5A623", name: "Yellow" },
  { hex: "#FFFFFF", name: "White" },
  { hex: "#000000", name: "Black" },
  { hex: "#FF2E58", name: "Radical Red" },
  { hex: "#2576F4", name: "Dodger Blue" },
];
