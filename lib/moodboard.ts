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

export type EmbedCardData = {
  url: string;
  embedUrl: string;
  title?: string;
  provider: "youtube" | "vimeo" | "loom" | "generic";
  thumbnailUrl?: string;
};

export type MoodboardItemData =
  | NoteCardData
  | ImageCardData
  | ColorCardData
  | LinkCardData
  | FileCardData
  | TodoCardData
  | EmbedCardData;

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

export function isEmbedData(type: MoodboardItemType, data: unknown): data is EmbedCardData {
  return type === "EMBED";
}

// ---------------------------------------------------------------------------
// Client-side item type (what the UI works with)
// ---------------------------------------------------------------------------

export type MoodboardItemClient = {
  id: string;
  type: MoodboardItemType;
  position: number;
  colSpan: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data: MoodboardItemData;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Connections (arrows between items)
// ---------------------------------------------------------------------------

export type MoodboardConnection = {
  id: string;
  sourceItemId: string;
  targetItemId: string;
  label?: string;
  color?: string;
  style?: "solid" | "dashed";
};

export function createConnection(sourceItemId: string, targetItemId: string): MoodboardConnection {
  return {
    id: crypto.randomUUID(),
    sourceItemId,
    targetItemId,
    color: "#9ca3af",
    style: "solid",
  };
}

// ---------------------------------------------------------------------------
// Canvas constants
// ---------------------------------------------------------------------------

export const CANVAS_DEFAULTS = {
  CARD_WIDTH: 280,
  CARD_HEIGHT: 0, // 0 = auto-height
  GRID_SNAP: 20,
  GAP: 20,
  MIN_WIDTH: 160,
  MIN_HEIGHT: 80,
  MIN_ZOOM: 0.15,
  MAX_ZOOM: 2,
  ZOOM_STEP: 0.1,
} as const;

export type MoodboardClient = {
  id: string;
  title: string;
  description: string | null;
  companyId: string;
  projectId: string | null;
  ticketId: string | null;
  createdById: string;
  items: MoodboardItemClient[];
  connections: MoodboardConnection[];
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

export function defaultEmbedData(): EmbedCardData {
  return { url: "", embedUrl: "", provider: "generic" };
}

// ---------------------------------------------------------------------------
// Video URL parser — extracts embed URL and thumbnail from video platforms
// ---------------------------------------------------------------------------

export function parseVideoUrl(
  url: string,
): { embedUrl: string; provider: EmbedCardData["provider"]; thumbnailUrl?: string } | null {
  try {
    const u = new URL(url);

    // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID
    if (
      u.hostname === "www.youtube.com" ||
      u.hostname === "youtube.com" ||
      u.hostname === "m.youtube.com"
    ) {
      let videoId = u.searchParams.get("v");
      if (!videoId) {
        const shortsMatch = u.pathname.match(/\/shorts\/([^/?]+)/);
        if (shortsMatch) videoId = shortsMatch[1];
      }
      if (videoId) {
        return {
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          provider: "youtube",
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        };
      }
    }

    if (u.hostname === "youtu.be") {
      const videoId = u.pathname.slice(1).split("/")[0];
      if (videoId) {
        return {
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          provider: "youtube",
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        };
      }
    }

    // Vimeo: vimeo.com/ID
    if (u.hostname === "vimeo.com" || u.hostname === "www.vimeo.com") {
      const videoId = u.pathname.slice(1).split("/")[0];
      if (videoId && /^\d+$/.test(videoId)) {
        return {
          embedUrl: `https://player.vimeo.com/video/${videoId}`,
          provider: "vimeo",
        };
      }
    }

    // Loom: loom.com/share/ID
    if (u.hostname === "www.loom.com" || u.hostname === "loom.com") {
      const shareMatch = u.pathname.match(/\/share\/([^/?]+)/);
      if (shareMatch) {
        return {
          embedUrl: `https://www.loom.com/embed/${shareMatch[1]}`,
          provider: "loom",
        };
      }
    }

    // Generic — any other valid URL, try as iframe
    if (u.protocol === "http:" || u.protocol === "https:") {
      return { embedUrl: url, provider: "generic" };
    }

    return null;
  } catch {
    return null;
  }
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
