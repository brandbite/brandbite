// -----------------------------------------------------------------------------
// @file: lib/moodboard.ts
// @purpose: Shared TypeScript types and helpers for the Moodboard feature
// -----------------------------------------------------------------------------

import { parseSpotifyUrl, spotifyEmbedUrl } from "@/lib/soundtrack/spotify";
import type { MoodboardItemType } from "@prisma/client";

/** A unique id made in the browser. randomUUID only exists on https and localhost. */
export function newClientId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Card data shapes (stored as JSON in MoodboardItem.data)
// ---------------------------------------------------------------------------

export type NoteCardData = {
  title?: string;
  body: string;
  /** Sticky note color. Notes from before colors existed render in the first one. */
  color?: string;
};

export type ShapeKind = "rect" | "ellipse" | "diamond";

export type ShapeCardData = {
  kind: ShapeKind;
  text: string;
  fill: string;
};

export type TextCardData = {
  text: string;
};

/** A named area. `color` is one of SECTION_COLORS (6-digit hex). */
export type SectionCardData = {
  title: string;
  color: string;
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
  provider: "youtube" | "vimeo" | "loom" | "spotify" | "generic";
  thumbnailUrl?: string;
};

export type DrawingCardData = {
  pathData: string;
  strokeColor: string;
  strokeWidth: number;
  /** Below 1 for the highlighter. */
  opacity?: number;
};

export type MoodboardItemData =
  | NoteCardData
  | ShapeCardData
  | TextCardData
  | SectionCardData
  | ImageCardData
  | ColorCardData
  | LinkCardData
  | FileCardData
  | TodoCardData
  | EmbedCardData
  | DrawingCardData;

// ---------------------------------------------------------------------------
// Type-safe data accessors
// ---------------------------------------------------------------------------

export function isNoteData(type: MoodboardItemType, data: unknown): data is NoteCardData {
  return type === "NOTE";
}

export function isShapeData(type: MoodboardItemType, data: unknown): data is ShapeCardData {
  return type === "SHAPE";
}

export function isTextData(type: MoodboardItemType, data: unknown): data is TextCardData {
  return type === "TEXT";
}

export function isSectionData(type: MoodboardItemType, data: unknown): data is SectionCardData {
  return type === "SECTION";
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

export function isDrawingData(type: MoodboardItemType, data: unknown): data is DrawingCardData {
  return type === "DRAWING";
}

// ---------------------------------------------------------------------------
// Client-side item type (what the UI works with)
// ---------------------------------------------------------------------------

export type MoodboardItemClient = {
  id: string;
  type: MoodboardItemType;
  position: number;
  /** Can't be moved, resized or deleted until unlocked. */
  locked?: boolean;
  /** Objects sharing this are picked and moved as one. */
  groupId?: string | null;
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
    id: newClientId(),
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
  MIN_WIDTH: 80,
  MIN_HEIGHT: 40,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 4,
  /** Zoom buttons and shortcuts multiply by this. */
  ZOOM_STEP: 1.25,
} as const;

export type MoodboardClient = {
  id: string;
  title: string;
  description: string | null;
  companyId: string | null;
  projectId: string | null;
  ticketId: string | null;
  createdById: string;
  items: MoodboardItemClient[];
  connections: MoodboardConnection[];
  project?: { id: string; name: string } | null;
  ticket?: { id: string; title: string } | null;
  ticketTitle: string | null;
  isCreativeBoard: boolean;
  sharedWithCustomer: boolean;
  /** What the person viewing can do. The API enforces the same rules. */
  access: { canView: boolean; canEdit: boolean; canDelete: boolean; canShare: boolean };
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
    items: [{ id: newClientId(), text: "", checked: false }],
  };
}

export function defaultEmbedData(): EmbedCardData {
  return { url: "", embedUrl: "", provider: "generic" };
}

// ---------------------------------------------------------------------------
// Drawing tool presets
// ---------------------------------------------------------------------------

export const DRAW_COLORS = [
  "#424143",
  "#F15B2B",
  "#4C8EF7",
  "#32B37B",
  "#D63A35",
  "#8B5CF6",
  "#F5C518",
] as const;

/** The highlighter starts here, since it reads as gray in the default dark color. */
export const HIGHLIGHTER_DEFAULT_COLOR = "#F5C518";

export const DRAW_SIZES = [2, 4, 8] as const;

export type PenKind = "marker" | "highlighter";

/** The highlighter is wide and see-through, so it marks up what's under it. */
export const PEN_PRESETS: Record<PenKind, { widthFactor: number; opacity: number }> = {
  marker: { widthFactor: 1, opacity: 1 },
  highlighter: { widthFactor: 5, opacity: 0.4 },
};

export const STICKY_COLORS = [
  "#FFE58A",
  "#FFC8A8",
  "#FFB3C1",
  "#D9C8FF",
  "#B9DCFF",
  "#BDEBC8",
] as const;

/** Section tints: the area shows each at 20%, the title tab in full. */
export const SECTION_COLORS = ["#E4E2DD", "#FFE58A", "#FFC8A8", "#C9E7CF", "#C8DDFB", "#DCD3FF"];

export const SHAPE_FILLS = [
  "#FFFFFF",
  "#FFE58A",
  "#FFC8A8",
  "#D9C8FF",
  "#B9DCFF",
  "#BDEBC8",
] as const;

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

    // Spotify: a playlist or album plays in Spotify's own embedded player.
    const spotify = parseSpotifyUrl(url);
    if (spotify) {
      return { embedUrl: spotifyEmbedUrl(spotify), provider: "spotify" };
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
  { hex: "#F15B2B", name: "brandbite Orange" },
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

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export type CommentClient = {
  id: string;
  body: string;
  author: { id: string; name: string };
  createdAt: string;
  /** Edited after posting. */
  edited: boolean;
};

export type CommentThreadClient = CommentClient & {
  itemId: string;
  resolvedAt: string | null;
  replies: CommentClient[];
};

/** Who is reading the comments: their own can be edited; admins can delete any. */
export type CommentViewer = { id: string; canModerate: boolean };
