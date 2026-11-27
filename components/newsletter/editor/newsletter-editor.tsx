// -----------------------------------------------------------------------------
// @file: components/newsletter/editor/newsletter-editor.tsx
// @purpose: The newsletter editor: a full-screen workspace in three steps.
//           Build: blocks on the left are dragged (or clicked) into the
//           newsletter in the middle; the right has the email's inbox lines,
//           the picked block's settings and the whole email's style.
//           Review: the email as a computer and a phone show it, beside the
//           list of what still needs fixing. Export: which service sends it,
//           the HTML to copy or download, and a test email. The steps are
//           free to move between. Customers on a plan have their work kept
//           in their account as they go; everyone else's is kept in their
//           browser. brandbite never sends the newsletter.
// -----------------------------------------------------------------------------

"use client";

import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ArrowLeftIcon,
  CopyIcon,
  DesktopIcon,
  DownloadIcon,
  MobileIcon,
} from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { TOOL_FOCUS, useToolAccessStatus } from "@/components/tools/tool-ui";
import { saveBlob } from "@/lib/image-tools/render";
import {
  draftBlocks,
  type NewsletterDraft,
  type NewsletterKind,
  type RewriteAction,
} from "@/lib/newsletter/ai";
import { commit, redo, replace, startHistory, undo, type History } from "@/lib/newsletter/history";
import {
  blockTypeInfo,
  canPlace,
  cloneBlock,
  countBlocks,
  DEFAULT_ACCENT,
  findBlock,
  hasContent,
  insertBlock,
  moveBlock,
  newBlock,
  NEWSLETTER_MAX_BLOCKS,
  NEWSLETTER_TEXT_MAX,
  newsletterProblems,
  parseSlotId,
  pictureSlots,
  readNewsletter,
  removeBlock,
  updateBlock,
  withPictureRatios,
  type BlockSlot,
  type NewsletterBlock,
  type NewsletterBlockType,
  type NewsletterData,
  NEWSLETTER_SERVICES,
} from "@/lib/newsletter/newsletter";
import { isBlockTextField, newsletterHtml, newsletterText } from "@/lib/newsletter/render";
import { richToPlain, type RichNode } from "@/lib/newsletter/rich";
import {
  placeSavedBlock,
  type NewsletterVersionSummary,
  type SavedBlock,
} from "@/lib/newsletter/saved";
import {
  builderImageSrc,
  findTemplate,
  fromTemplate,
  templateIsPro,
} from "@/lib/newsletter/templates";

import "@/components/colors/studio/studio.css";

import { BlockGlyph, Canvas, Palette, slotTakes, type Dragging } from "./canvas";
import {
  BlockInspector,
  blockTitle,
  FooterInspector,
  HeaderInspector,
  NewsletterPanel,
  SERVICE_NOTES,
  StylePanel,
  type AiState,
} from "./inspector";

export const NEWSLETTER_DRAFT_KEY = "brandbite:newsletter-draft:v2";
const HOME = "/newsletter-builder";

const makeId = () => `b${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

type Box = { left: number; right: number; top: number; bottom: number };

/**
 * How far a point is from a drop place. Being beside a place counts for more
 * than being above or below it, so a block held over a column lands in that column.
 */
function slotDistance(rect: Box, point: { x: number; y: number }): number {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return dy + dx * 3;
}
const SLOT_REACH = 260;

const draggingOf = (dragged: DragData): Dragging => ({
  type: dragged.type,
  id: dragged.kind === "move" ? (dragged.id ?? null) : null,
});

/**
 * The drop place nearest the pointer that can take what is being dragged, so a
 * block doesn't have to be aimed at a thin line.
 */
const nearestSlot: CollisionDetection = ({
  active,
  droppableContainers,
  droppableRects,
  pointerCoordinates,
}) => {
  const dragged = active.data.current as DragData | undefined;
  if (!pointerCoordinates || !dragged) return [];
  const dragging = draggingOf(dragged);
  let best: { id: string | number; distance: number } | null = null;
  for (const container of droppableContainers) {
    const rect = droppableRects.get(container.id);
    const slot = (container.data.current as { slot?: BlockSlot } | undefined)?.slot;
    if (!rect || !slot || !slotTakes(slot, dragging)) continue;
    const distance = slotDistance(rect, pointerCoordinates);
    if (distance < SLOT_REACH && (!best || distance < best.distance)) {
      best = { id: container.id, distance };
    }
  }
  return best ? [{ id: best.id, data: { value: best.distance } }] : [];
};

/**
 * The same choice read from the page itself, for a block let go so quickly
 * that the drag never got to say what it was over.
 */
function nearestSlotOnPage(point: { x: number; y: number }, dragging: Dragging): BlockSlot | null {
  let best: { slot: BlockSlot; distance: number } | null = null;
  for (const node of document.querySelectorAll<HTMLElement>("[data-slot]")) {
    const slot = parseSlotId(node.dataset.slot ?? "");
    if (!slot || !slotTakes(slot, dragging)) continue;
    const distance = slotDistance(node.getBoundingClientRect(), point);
    if (distance < SLOT_REACH && (!best || distance < best.distance)) best = { slot, distance };
  }
  return best?.slot ?? null;
}

/** What a dragged thing says about itself: a new block from the list, or one being moved. */
type DragData = {
  kind: "new" | "move" | "saved";
  type: NewsletterBlockType;
  id?: string;
  savedId?: string;
};

type Step = "build" | "review" | "export";
const STEPS: { id: Step; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "review", label: "Review" },
  { id: "export", label: "Export" },
];

type SaveState = "new" | "saving" | "saved" | "error" | "local";
type Message = { kind: "ok" | "error"; text: string };

const BAR_BUTTON = `inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-[13px] font-semibold whitespace-nowrap hover:border-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--cs-border)] ${TOOL_FOCUS}`;

const strokeIcon = (d: string) => (
  <svg
    aria-hidden
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

export function NewsletterEditor() {
  const params = useSearchParams();
  const { access, ready } = useToolAccessStatus();
  const pro = access.pro;

  const [history, setHistory] = useState<History<NewsletterData> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"email" | "block" | "style">("email");
  const [step, setStep] = useState<Step>("build");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [pane, setPane] = useState<"blocks" | "canvas" | "settings">("canvas");
  const [dragging, setDragging] = useState<Dragging>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [menu, setMenu] = useState<"history" | null>(null);

  const doc = history?.present ?? null;

  /** Change the newsletter. `key` names the field being typed into, so a run of typing is one undo step. */
  const apply = useCallback(
    (change: (data: NewsletterData) => NewsletterData, key: string | null = null) =>
      setHistory((current) =>
        current ? commit(current, change(current.present), key, Date.now()) : current,
      ),
    [],
  );

  // ---- Opening: a kept newsletter, a template, or the browser's draft ----
  const [savedId, setSavedId] = useState<string | null>(null);
  const savedIdRef = useRef<string | null>(null);
  const savedJson = useRef("");
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const accent = access.brandColors[0]?.hex ?? DEFAULT_ACCENT;
    const open = (data: NewsletterData, id: string | null = null) => {
      savedIdRef.current = id;
      savedJson.current = JSON.stringify(data);
      setSavedId(id);
      setHistory(startHistory(data));
    };
    const fresh = (templateId: string | null): NewsletterData => {
      const wanted = findTemplate(templateId);
      const template =
        wanted && (access.pro || !templateIsPro(wanted)) ? wanted : findTemplate("announcement")!;
      const made = fromTemplate(template, makeId, accent);
      return {
        ...made,
        name: templateId === "blank" ? "Untitled newsletter" : made.name,
        blocks: templateId === "blank" ? [] : made.blocks,
        header: { ...made.header, brandName: access.companyName ?? "" },
      };
    };

    const id = params.get("id");
    const template = params.get("template");
    void (async () => {
      if (id && access.pro) {
        try {
          const res = await fetch(`/api/newsletters/${encodeURIComponent(id)}`, {
            cache: "no-store",
          });
          const body = (await res.json().catch(() => null)) as {
            data?: unknown;
            error?: string;
          } | null;
          const data = res.ok ? readNewsletter(body?.data, makeId) : null;
          if (data) return open(data, id);
          setLoadError(body?.error ?? "That newsletter couldn't be opened.");
        } catch {
          setLoadError("That newsletter couldn't be opened. Check your connection and try again.");
        }
        return;
      }
      if (template) return open(fresh(template));
      if (!access.pro) {
        try {
          const kept = readNewsletter(
            JSON.parse(window.localStorage.getItem(NEWSLETTER_DRAFT_KEY) ?? "null"),
            makeId,
          );
          if (kept) return open(kept);
        } catch {
          // Storage switched off or unreadable: start fresh.
        }
      }
      open(fresh("announcement"));
    })();
  }, [ready, access, params]);

  // ---- Keeping the work: the account for plan customers, the browser for everyone else ----
  const [saveState, setSaveState] = useState<SaveState>("new");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveTick, setSaveTick] = useState(0);
  const saving = useRef(false);
  const json = doc ? JSON.stringify(doc) : "";

  useEffect(() => {
    if (!json || json === savedJson.current) return;
    if (!pro) {
      const timer = window.setTimeout(() => {
        try {
          window.localStorage.setItem(NEWSLETTER_DRAFT_KEY, json);
          savedJson.current = json;
          setSaveState("local");
        } catch {
          setSaveState("error");
          setSaveError("Your browser didn't let us keep the draft. Export it before you leave.");
        }
      }, 500);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      if (saving.current) return; // the save in flight asks again when it is done
      saving.current = true;
      setSaveState("saving");
      void (async () => {
        try {
          const id = savedIdRef.current;
          const res = await fetch(id ? `/api/newsletters/${id}` : "/api/newsletters", {
            method: id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: JSON.parse(json) }),
          });
          const body = (await res.json().catch(() => null)) as {
            newsletter?: { id: string };
            error?: string;
          } | null;
          if (!res.ok || !body?.newsletter) throw new Error(body?.error ?? "");
          if (!id) {
            savedIdRef.current = body.newsletter.id;
            setSavedId(body.newsletter.id);
            window.history.replaceState(null, "", `?id=${body.newsletter.id}`);
          }
          savedJson.current = json;
          setSaveState("saved");
          setSaveError(null);
          // Anything typed while this was on its way gets its own save.
          setSaveTick((tick) => tick + 1);
        } catch (error) {
          setSaveState("error");
          setSaveError(
            (error instanceof Error && error.message) ||
              "Your changes couldn't be saved. Check your connection.",
          );
        } finally {
          saving.current = false;
        }
      })();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [json, pro, saveTick]);

  // Leaving with changes that haven't reached the account yet asks first.
  useEffect(() => {
    if (!pro) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (json && json !== savedJson.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [json, pro]);

  // ---- Pictures' shapes ----
  // Outlook on Windows stretches a picture unless the email says how tall it
  // is, and the email only knows that if someone measured the picture. So each
  // picture is loaded once here and its shape written into the newsletter,
  // quietly: it is no step for Undo.
  const shapes = useRef(new Map<string, number>());
  const [measured, setMeasured] = useState(0);
  useEffect(() => {
    if (!doc) return;
    const wanted = new Map<string, number>();
    for (const slot of pictureSlots(doc)) {
      if (!slot.url) {
        if (slot.ratio) wanted.set(slot.key, 0);
        continue;
      }
      const known = shapes.current.get(slot.url);
      if (known === undefined) {
        const url = slot.url;
        shapes.current.set(url, -1); // being measured
        const probe = new Image();
        probe.onload = () => {
          shapes.current.set(
            url,
            probe.naturalHeight
              ? Math.round((probe.naturalWidth / probe.naturalHeight) * 1000) / 1000
              : 0,
          );
          setMeasured((count) => count + 1);
        };
        probe.onerror = () => {
          shapes.current.set(url, 0);
          setMeasured((count) => count + 1);
        };
        probe.src = builderImageSrc(url);
      } else if (known >= 0 && Math.abs(known - slot.ratio) > 0.0005) {
        wanted.set(slot.key, known);
      }
    }
    if (wanted.size) {
      setHistory((current) =>
        current ? replace(current, withPictureRatios(current.present, wanted)) : current,
      );
    }
  }, [doc, measured]);

  // ---- Blocks: add, move, copy, remove ----
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  const stepRef = useRef<Step>("build");
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const select = useCallback((target: string | null) => {
    setSelected(target);
    setMenu(null);
    if (target) {
      setTab("block");
      setPane("settings");
    }
  }, []);

  const tooMany = () =>
    setMessage({
      kind: "error",
      text: `A newsletter takes up to ${NEWSLETTER_MAX_BLOCKS} blocks. Remove one to add another.`,
    });

  /** Where a new block goes when it is clicked rather than dragged: under the picked block, or at the end. */
  const slotAfterSelection = (blocks: NewsletterBlock[], type: NewsletterBlockType): BlockSlot => {
    const end: BlockSlot = { columnsId: null, cell: 0, index: blocks.length };
    const found = selectedRef.current ? findBlock(blocks, selectedRef.current) : null;
    if (!found) return end;
    const after = { ...found.slot, index: found.slot.index + 1 };
    if (canPlace(type, after)) return after;
    // Columns can't go inside a column: put them under the columns block that holds the picked one.
    const parent = blocks.findIndex((block) => block.id === found.slot.columnsId);
    return parent >= 0 ? { columnsId: null, cell: 0, index: parent + 1 } : end;
  };

  /** Puts a block into the newsletter: at the place given, or under the picked block. */
  const placeBlock = (block: NewsletterBlock, slot?: BlockSlot) => {
    if (!doc) return;
    if (countBlocks(doc.blocks) + countBlocks([block]) > NEWSLETTER_MAX_BLOCKS) return tooMany();
    apply((data) => ({
      ...data,
      blocks: insertBlock(data.blocks, slot ?? slotAfterSelection(data.blocks, block.type), block),
    }));
    setSelected(block.id);
    setTab("block");
    setPane("canvas");
  };
  const addBlock = (type: NewsletterBlockType, slot?: BlockSlot) =>
    placeBlock(newBlock(type, makeId()), slot);

  // ---- Blocks kept for reuse (plan customers) ----
  const [savedBlocks, setSavedBlocks] = useState<SavedBlock[]>([]);
  useEffect(() => {
    if (!ready || !pro) return;
    let live = true;
    fetch("/api/newsletters/blocks", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { blocks?: SavedBlock[] } | null) => {
        if (live && body?.blocks) setSavedBlocks(body.blocks);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [ready, pro]);

  const keepBlock = async (id: string) => {
    const found = doc ? findBlock(doc.blocks, id) : null;
    if (!found) return;
    try {
      const res = await fetch("/api/newsletters/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block: found.block }),
      });
      const body = (await res.json().catch(() => null)) as {
        block?: SavedBlock;
        error?: string;
      } | null;
      if (!res.ok || !body?.block) throw new Error(body?.error ?? "");
      const kept = body.block;
      setSavedBlocks((current) => [kept, ...current]);
      setMessage({ kind: "ok", text: `Kept as "${kept.name}". Find it under Your blocks.` });
    } catch (error) {
      setMessage({
        kind: "error",
        text: (error instanceof Error && error.message) || "The block couldn't be kept.",
      });
    }
  };
  const deleteSaved = async (id: string) => {
    const res = await fetch(`/api/newsletters/blocks/${id}`, { method: "DELETE" }).catch(
      () => null,
    );
    if (res?.ok || res?.status === 404) {
      setSavedBlocks((current) => current.filter((saved) => saved.id !== id));
    } else setMessage({ kind: "error", text: "The block couldn't be deleted." });
  };

  // ---- Earlier versions (plan customers, once the newsletter is in the account) ----
  const [versions, setVersions] = useState<NewsletterVersionSummary[] | null>(null);
  const openHistory = async () => {
    if (menu === "history") return setMenu(null);
    setMenu("history");
    setVersions(null);
    if (!savedIdRef.current) return setVersions([]);
    try {
      const res = await fetch(`/api/newsletters/${savedIdRef.current}/versions`, {
        cache: "no-store",
      });
      const body = (await res.json().catch(() => null)) as {
        versions?: NewsletterVersionSummary[];
      } | null;
      setVersions(res.ok && body?.versions ? body.versions : []);
    } catch {
      setVersions([]);
    }
  };
  const restoreVersion = async (versionId: string) => {
    setMenu(null);
    try {
      const res = await fetch(`/api/newsletters/${savedIdRef.current}/versions/${versionId}`, {
        cache: "no-store",
      });
      const body = (await res.json().catch(() => null)) as {
        data?: unknown;
        error?: string;
      } | null;
      const data = res.ok ? readNewsletter(body?.data, makeId) : null;
      if (!data) throw new Error(body?.error ?? "");
      apply(() => data);
      setSelected(null);
      setMessage({ kind: "ok", text: "That version is back. Undo returns to what you had." });
    } catch (error) {
      setMessage({
        kind: "error",
        text: (error instanceof Error && error.message) || "That version couldn't be opened.",
      });
    }
  };

  const actions = {
    onSelect: select,
    ...(pro ? { onKeep: (id: string) => void keepBlock(id) } : {}),
    onRich: (id: string, rich: RichNode[] | null) =>
      apply(
        (data) => ({
          ...data,
          blocks: updateBlock(data.blocks, id, (block) =>
            "rich" in block
              ? {
                  ...block,
                  rich,
                  text: rich ? richToPlain(rich).slice(0, NEWSLETTER_TEXT_MAX) : "",
                }
              : block,
          ),
        }),
        `${id}:text`,
      ),
    // The same undo steps as typing the same words in the panel on the right.
    onRegionField: (field: string, text: string) => {
      if (field === "brandName") {
        apply(
          (data) => ({ ...data, header: { ...data.header, brandName: text.slice(0, 120) } }),
          "header:brandName",
        );
      } else if (field === "note" || field === "address") {
        apply(
          (data) => ({ ...data, footer: { ...data.footer, [field]: text } }),
          `footer:${field}`,
        );
      }
    },
    onField: (id: string, field: string, text: string) =>
      apply(
        (data) => ({
          ...data,
          blocks: updateBlock(data.blocks, id, (block) =>
            isBlockTextField(block, field)
              ? ({ ...block, [field]: text } as NewsletterBlock)
              : block,
          ),
        }),
        `${id}:${field}`,
      ),
    // The same undo step as typing the same words in the panel on the right.
    onText: (id: string, text: string) =>
      apply(
        (data) => ({
          ...data,
          blocks: updateBlock(data.blocks, id, (block) =>
            block.type === "button"
              ? { ...block, label: text }
              : block.type === "heading" || block.type === "text"
                ? { ...block, text }
                : block,
          ),
        }),
        `${id}:${findBlock(doc?.blocks ?? [], id)?.block.type === "button" ? "label" : "text"}`,
      ),
    onMove: (id: string, direction: -1 | 1) =>
      apply((data) => {
        const found = findBlock(data.blocks, id);
        if (!found) return data;
        const index = direction < 0 ? found.slot.index - 1 : found.slot.index + 2;
        return { ...data, blocks: moveBlock(data.blocks, id, { ...found.slot, index }) };
      }),
    onDuplicate: (id: string) => {
      if (!doc) return;
      const found = findBlock(doc.blocks, id);
      if (!found) return;
      const copy = cloneBlock(found.block, makeId);
      if (countBlocks(doc.blocks) + countBlocks([copy]) > NEWSLETTER_MAX_BLOCKS) return tooMany();
      apply((data) => ({
        ...data,
        blocks: insertBlock(data.blocks, { ...found.slot, index: found.slot.index + 1 }, copy),
      }));
      setSelected(copy.id);
    },
    onRemove: (id: string) => {
      apply((data) => ({ ...data, blocks: removeBlock(data.blocks, id) }));
      setSelected((current) => (current === id ? null : current));
    },
  };

  // ---- Drag and drop ----
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) setDragging({ type: data.type, id: data.kind === "move" ? (data.id ?? null) : null });
    setMenu(null);
  };
  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const data = event.active.data.current as DragData | undefined;
    if (!data) return;
    const start = event.activatorEvent as Partial<PointerEvent>;
    const slot = event.over
      ? parseSlotId(String(event.over.id))
      : typeof start.clientX === "number" && typeof start.clientY === "number"
        ? nearestSlotOnPage(
            { x: start.clientX + event.delta.x, y: start.clientY + event.delta.y },
            draggingOf(data),
          )
        : null;
    if (!slot) return;
    if (data.kind === "new") addBlock(data.type, slot);
    else if (data.kind === "saved") {
      const saved = savedBlocks.find((item) => item.id === data.savedId);
      if (saved) placeBlock(placeSavedBlock(saved, makeId), slot);
    } else if (data.id) {
      const id = data.id;
      apply((current) => ({ ...current, blocks: moveBlock(current.blocks, id, slot) }));
      setSelected(id);
    }
  };

  // ---- Keys: undo, redo, delete, duplicate, let go ----
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      if (typing) return; // fields keep their own undo and their own Delete
      // A window is open over the editor (cutting a picture, the picture library): keys are for it.
      if (document.querySelector("dialog[open]")) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        setHistory((current) =>
          current ? (event.shiftKey ? redo(current) : undo(current)) : current,
        );
      } else if (mod && key === "y") {
        event.preventDefault();
        setHistory((current) => (current ? redo(current) : current));
      } else if (event.key === "Escape") {
        setSelected(null);
        setMenu(null);
      } else {
        const id = selectedRef.current;
        if (stepRef.current !== "build") return;
        if (!id || id === "header" || id === "footer") return;
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          actionsRef.current.onRemove(id);
        } else if (mod && key === "d") {
          event.preventDefault();
          actionsRef.current.onDuplicate(id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- AI writing ----
  const [ai, setAi] = useState<AiState>({ busy: null, note: null, runsLeft: null });
  const [subjects, setSubjects] = useState<string[]>([]);

  const askAi = async <T extends object>(
    busy: string,
    body: Record<string, unknown>,
  ): Promise<(T & { usedVoice?: boolean }) | null> => {
    setAi((current) => ({ ...current, busy, note: null }));
    try {
      const res = await fetch("/api/tools/newsletter-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = (await res.json().catch(() => null)) as
        | (T & { remaining?: number; usedVoice?: boolean; error?: string })
        | null;
      const runsLeft = typeof answer?.remaining === "number" ? answer.remaining : null;
      if (!res.ok || !answer) {
        setAi((current) => ({
          busy: null,
          runsLeft: runsLeft ?? current.runsLeft,
          note: { kind: "error", text: answer?.error ?? "It couldn't be written. Try again." },
        }));
        return null;
      }
      setAi((current) => ({ busy: null, note: null, runsLeft: runsLeft ?? current.runsLeft }));
      return answer;
    } catch {
      setAi((current) => ({
        ...current,
        busy: null,
        note: { kind: "error", text: "It couldn't be written. Check your connection." },
      }));
      return null;
    }
  };
  const aiDone = (text: string) => setAi((current) => ({ ...current, note: { kind: "ok", text } }));

  const writeDraft = async (kind: NewsletterKind, brief: string) => {
    const answer = await askAi<{ draft: NewsletterDraft }>("draft", { mode: "draft", kind, brief });
    if (!answer?.draft) return;
    const draft = answer.draft;
    apply((data) => ({
      ...data,
      subject: draft.subject || data.subject,
      preheader: draft.preheader || data.preheader,
      blocks: draftBlocks(draft, makeId),
    }));
    setSelected(null);
    aiDone(
      answer.usedVoice
        ? "Written in your brand's voice. Check the facts, then add your links and images."
        : "Written in a plain style, because your Brand guide doesn't describe your voice yet. Check the facts, then add your links and images.",
    );
  };

  const rewrite = async (action: RewriteAction) => {
    const found = doc && selected ? findBlock(doc.blocks, selected) : null;
    const block = found?.block;
    if (!block || (block.type !== "heading" && block.type !== "text")) return;
    const answer = await askAi<{ text: string }>(`${block.id}:${action}`, {
      mode: "rewrite",
      action,
      text: block.text,
      heading: block.type === "heading",
    });
    if (!answer?.text) return;
    const text = answer.text;
    apply((data) => ({
      ...data,
      blocks: updateBlock(
        data.blocks,
        block.id,
        // The rewrite comes back as plain words; formatting made before it is gone with the old words.
        (current) =>
          ({
            ...current,
            text,
            ...(current.type === "text" ? { rich: null } : {}),
          }) as NewsletterBlock,
      ),
    }));
    aiDone("Rewritten. Undo brings your own words back.");
  };

  const suggestSubjects = async () => {
    if (!doc) return;
    const answer = await askAi<{ subjects: string[] }>("subjects", {
      mode: "subjects",
      content: newsletterText(doc),
    });
    if (answer?.subjects) setSubjects(answer.subjects);
  };

  // ---- Test email and export ----
  const [sending, setSending] = useState(false);
  const sendTest = async () => {
    if (!doc) return;
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/tools/newsletter-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: doc }),
      });
      const body = (await res.json().catch(() => null)) as { to?: string; error?: string } | null;
      setMessage(
        res.ok && body?.to
          ? { kind: "ok", text: `Test sent to ${body.to}. It can take a minute to arrive.` }
          : { kind: "error", text: body?.error ?? "The test couldn't be sent." },
      );
    } catch {
      setMessage({ kind: "error", text: "The test couldn't be sent. Check your connection." });
    } finally {
      setSending(false);
    }
  };

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ kind: "ok", text: done });
    } catch {
      setMessage({
        kind: "error",
        text: "Your browser didn't allow the copy. Download the HTML instead.",
      });
    }
  };

  // The message under the bar goes away by itself.
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 7000);
    return () => window.clearTimeout(timer);
  }, [message]);

  // Redrawing the preview would jump back to the top; put it back where it was.
  const scrollTop = useRef(0);
  const onPreviewLoad = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    const win = event.currentTarget.contentWindow;
    if (!win) return;
    win.scrollTo(0, scrollTop.current);
    win.addEventListener("scroll", () => {
      scrollTop.current = win.scrollY;
    });
  };

  // The editor fills the window below whatever the site puts above it (the demo banner).
  const [top, setTop] = useState(0);
  const shell = useCallback((node: HTMLDivElement | null) => {
    if (node) setTop(Math.max(0, Math.round(node.getBoundingClientRect().top + window.scrollY)));
  }, []);

  // ---- Screens before the editor ----
  if (loadError) {
    return (
      <div className="color-studio flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-base leading-6 font-semibold">{loadError}</p>
        <Link href={HOME} className={studioButtonClasses("secondary")}>
          Back to your newsletters
        </Link>
      </div>
    );
  }
  if (!history || !doc) {
    return (
      <div className="color-studio flex min-h-dvh items-center justify-center p-6">
        <p role="status" className="text-sm leading-5 text-[var(--cs-muted)]">
          Opening the editor…
        </p>
      </div>
    );
  }

  const found =
    selected && selected !== "header" && selected !== "footer"
      ? findBlock(doc.blocks, selected)
      : null;
  const selectedBlock = found?.block ?? null;
  const ready2 = hasContent(doc);
  const problems = ready2 ? newsletterProblems(doc) : [];
  const html = () => newsletterHtml(doc);
  const inspectorTitle = selectedBlock
    ? blockTitle(selectedBlock)
    : selected === "header"
      ? "Header"
      : selected === "footer"
        ? "Footer"
        : null;

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved to your account"
        : saveState === "local"
          ? "Kept in this browser"
          : saveState === "error"
            ? "Not saved"
            : pro
              ? savedId
                ? "Saved to your account"
                : "Not saved yet"
              : "Kept in this browser";

  const paneClass = (name: typeof pane) => (pane === name ? "" : "max-[1023px]:hidden");

  const goStep = (next: Step) => {
    setStep(next);
    setMenu(null);
  };

  /** From the list of things to fix: back to Build, with the place in question open. */
  const goFix = (target: string) => {
    setStep("build");
    setDevice("desktop");
    if (target === "inbox") {
      setSelected(null);
      setTab("email");
      setPane("settings");
      setMenu(null);
    } else select(target);
  };

  const deviceToggle = (
    <div
      role="group"
      aria-label="Screen size"
      className="flex rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-1"
    >
      {(
        [
          { id: "desktop", label: "Desktop", icon: <DesktopIcon /> },
          { id: "phone", label: "Mobile", icon: <MobileIcon /> },
        ] as const
      ).map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={device === option.id}
          onClick={() => setDevice(option.id)}
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold ${TOOL_FOCUS} ${
            device === option.id
              ? "bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
              : "text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );

  /** The email as a mail app shows it, at a computer's or a phone's width. */
  const previewFrame = (
    <iframe
      title="Newsletter preview"
      // No scripts can run in it; same-origin only so its pictures load and its scroll can be kept.
      sandbox="allow-same-origin"
      srcDoc={newsletterHtml(doc, {
        imageSrc: builderImageSrc,
        assetBase: "",
        preview: true,
      })}
      onLoad={onPreviewLoad}
      className="h-full max-w-full rounded-lg bg-white shadow-lg"
      style={{ width: device === "phone" ? 390 : 760 }}
    />
  );

  const warningIcon = (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff1cc] text-[#8a5a00]"
    >
      {strokeIcon("M12 4l9 16H3zM12 10v4M12 17h.01")}
    </span>
  );

  const fixLabel = problems.length
    ? `${problems.length} to fix`
    : ready2
      ? "Ready to send"
      : "Nothing to send yet";

  const CARD =
    "rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5";
  const PRIMARY = `inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--cs-brand)] px-4 text-sm font-semibold whitespace-nowrap text-white hover:bg-[var(--cs-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--cs-brand)] ${TOOL_FOCUS}`;
  const PLAN_MARK =
    "rounded-md bg-[var(--cs-soft)] px-1.5 text-[11px] leading-5 font-semibold text-[var(--cs-soft-text)]";

  /** "Send test": for plan customers it sends; for everyone else it says what a plan adds. */
  const testButton = (className: string) => (
    <button
      type="button"
      disabled={access.newsletterTest ? !ready2 || sending : false}
      onClick={() =>
        access.newsletterTest
          ? void sendTest()
          : setMessage({ kind: "ok", text: "Test emails come with a brandbite plan." })
      }
      title="Sends this newsletter to your own address only"
      className={className}
    >
      {sending ? "Sending…" : "Send test"}
      {access.newsletterTest ? null : <span className={PLAN_MARK}>Plan</span>}
    </button>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={nearestSlot}
      // Drop places are measured all the time, so they are known the moment a drag starts.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div
        ref={shell}
        className="color-studio flex flex-col overflow-hidden text-[var(--cs-text)]"
        style={{ height: `calc(100dvh - ${top}px)` }}
      >
        {/* ---- Top bar ---- */}
        <header className="relative z-40 flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2">
          <Link
            href={HOME}
            aria-label="Back to your newsletters"
            title="Back to your newsletters"
            className={`${BAR_BUTTON} w-9 px-0`}
          >
            <ArrowLeftIcon />
          </Link>
          <span className="text-sm font-bold whitespace-nowrap max-[1179px]:hidden">
            Newsletter Builder
          </span>
          <span aria-hidden className="h-6 w-px bg-[var(--cs-border)] max-[1179px]:hidden" />
          <label className="group/name relative flex items-center">
            <input
              aria-label="Newsletter name"
              value={doc.name}
              maxLength={120}
              placeholder="Untitled newsletter"
              onChange={(event) => {
                const name = event.target.value;
                apply((data) => ({ ...data, name }), "name");
              }}
              className={`h-9 w-[220px] min-w-0 rounded-lg border border-transparent bg-transparent pr-8 pl-2 text-sm font-semibold hover:border-[var(--cs-border)] focus:border-[var(--cs-border)] max-[767px]:w-[140px] ${TOOL_FOCUS}`}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-2 text-[var(--cs-muted)] group-focus-within/name:hidden"
            >
              {strokeIcon("M4 20l4-1 11-11-3-3L5 16zM14 7l3 3")}
            </span>
          </label>
          <span
            role="status"
            title={saveError ?? undefined}
            className={`text-[13px] leading-5 max-[767px]:hidden ${saveState === "error" ? "font-semibold text-[var(--cs-danger)]" : "text-[var(--cs-muted)]"}`}
          >
            {saveLabel}
          </span>
          {saveState === "error" && pro ? (
            <button
              type="button"
              onClick={() => setSaveTick((tick) => tick + 1)}
              className={BAR_BUTTON}
            >
              Try again
            </button>
          ) : null}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                disabled={!history.past.length}
                onClick={() => setHistory((current) => (current ? undo(current) : current))}
                className={`${BAR_BUTTON} w-9 px-0`}
              >
                {strokeIcon("M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3")}
              </button>
              <button
                type="button"
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                disabled={!history.future.length}
                onClick={() => setHistory((current) => (current ? redo(current) : current))}
                className={`${BAR_BUTTON} w-9 px-0`}
              >
                {strokeIcon("M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3")}
              </button>
            </div>

            {pro && savedId ? (
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={menu === "history"}
                  onClick={() => void openHistory()}
                  className={BAR_BUTTON}
                >
                  {strokeIcon("M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4")}
                  History
                </button>
                {menu === "history" ? (
                  <div className="absolute top-11 right-0 z-50 w-[300px] rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-2 shadow-xl">
                    <p className="px-2 py-1.5 text-[11px] leading-4 font-bold tracking-[0.08em] text-[var(--cs-muted)] uppercase">
                      Earlier versions
                    </p>
                    {versions === null ? (
                      <p className="px-2 py-2 text-[13px] leading-5 text-[var(--cs-muted)]">
                        Loading…
                      </p>
                    ) : versions.length ? (
                      <ul className="max-h-[320px] overflow-y-auto">
                        {versions.map((version) => (
                          <li key={version.id}>
                            <button
                              type="button"
                              onClick={() => void restoreVersion(version.id)}
                              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-[13px] leading-5 hover:bg-[var(--cs-background)] ${TOOL_FOCUS}`}
                            >
                              <span>
                                {new Date(version.createdAt).toLocaleString("en", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {version.by ? (
                                  <span className="text-[var(--cs-muted)]"> · {version.by}</span>
                                ) : null}
                              </span>
                              <span className="font-semibold">Bring back</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-2 py-2 text-[13px] leading-5 text-[var(--cs-muted)]">
                        None yet. As you keep working, the newsletter is kept as it was every ten
                        minutes or so, and you can return to any of those here.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              disabled={!ready2}
              onClick={() => goStep("review")}
              title="Open Review"
              className={`${BAR_BUTTON} ${problems.length ? "border-[#f0b429] bg-[#fff8e6] text-[#6b4700]" : ""}`}
            >
              {problems.length ? strokeIcon("M12 4l9 16H3zM12 10v4M12 17h.01") : null}
              {fixLabel}
            </button>

            {testButton(BAR_BUTTON)}

            <button
              type="button"
              disabled={!ready2}
              onClick={() => goStep("export")}
              className={`${PRIMARY} h-9 text-[13px]`}
            >
              Export HTML
            </button>
          </div>
        </header>

        {/* ---- Steps: free to move between, in any order ---- */}
        <nav
          aria-label="Steps"
          className="flex shrink-0 justify-center border-b border-[var(--cs-border)] bg-[var(--cs-surface)] px-3"
        >
          <ol className="flex items-center">
            {STEPS.map((item, index) => (
              <li key={item.id} className="flex items-center">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className="mx-2 h-px w-14 bg-[var(--cs-border)] max-[639px]:w-4"
                  />
                ) : null}
                <button
                  type="button"
                  aria-current={step === item.id ? "step" : undefined}
                  onClick={() => goStep(item.id)}
                  className={`-mb-px flex min-h-12 items-center gap-2.5 border-b-[3px] px-3 text-[15px] font-semibold ${TOOL_FOCUS} ${
                    step === item.id
                      ? "border-[var(--cs-brand)]"
                      : "border-transparent text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[13px] ${
                      step === item.id
                        ? "bg-[var(--cs-brand)] text-white"
                        : "border border-[var(--cs-border)]"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {item.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <p
          role="status"
          className={`shrink-0 px-4 py-2 text-center text-[13px] leading-5 font-medium empty:hidden ${
            message?.kind === "error"
              ? "bg-[#fef3f2] text-[#b42318]"
              : "bg-[#ecfdf3] text-[#256b3a]"
          }`}
        >
          {message?.text ?? ""}
        </p>

        {/* ---- Workspace ---- */}
        {step === "review" ? (
          <div className="flex min-h-0 flex-1 max-[1023px]:flex-col max-[1023px]:overflow-y-auto">
            <main
              aria-label="Preview"
              className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#e7e4df] max-[1023px]:min-h-[70dvh] max-[1023px]:flex-none"
            >
              <div className="flex justify-center py-3">{deviceToggle}</div>
              {ready2 ? (
                <>
                  <div className="flex min-h-0 flex-1 justify-center px-3 pb-3">{previewFrame}</div>
                  <p className="pb-3 text-center text-[13px] leading-5 text-[var(--cs-muted)]">
                    Links don&apos;t open here. Mail apps differ a little; send yourself a test
                    before the real one.
                  </p>
                </>
              ) : (
                <p className="m-auto max-w-[320px] p-6 text-center text-sm leading-5 text-[var(--cs-muted)]">
                  Nothing to review yet. Add a block in Build and it shows here.
                </p>
              )}
            </main>

            <aside
              aria-label="Before you export"
              className="flex w-[380px] shrink-0 flex-col border-l border-[var(--cs-border)] bg-[var(--cs-surface)] max-[1023px]:w-full max-[1023px]:border-l-0"
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <h2 className="text-lg leading-7 font-bold">Before you export</h2>
                {!ready2 ? (
                  <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">
                    The checks run once the newsletter has something in it.
                  </p>
                ) : problems.length ? (
                  <>
                    <p className="mt-1 text-sm leading-5 text-[var(--cs-muted)]">
                      {problems.length === 1 ? "One thing" : `${problems.length} things`} to look
                      at. You can still export; these make sure the email works for every reader.
                    </p>
                    <ul className="mt-4 flex flex-col gap-2">
                      {problems.map((problem, index) => (
                        <li key={`${problem.target}-${index}`}>
                          <button
                            type="button"
                            onClick={() => goFix(problem.target)}
                            className={`flex w-full items-center gap-3 rounded-xl border border-[var(--cs-border)] p-3 text-left hover:border-[var(--cs-text)] ${TOOL_FOCUS}`}
                          >
                            {warningIcon}
                            <span className="min-w-0 flex-1 text-sm leading-5 font-medium">
                              {problem.text}
                            </span>
                            <span className="text-[13px] font-semibold whitespace-nowrap text-[var(--cs-brand-strong)] underline underline-offset-4">
                              Fix it
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-4 flex items-center gap-3 rounded-xl bg-[#E3F1E4] p-4 text-sm leading-5 font-medium text-[#14532D]">
                    <span aria-hidden className="shrink-0">
                      {strokeIcon("M5 12l5 5 9-10")}
                    </span>
                    Nothing left to fix. It is ready to export.
                  </p>
                )}

                <h3 className="mt-6 text-sm leading-5 font-bold">In the inbox</h3>
                <button
                  type="button"
                  onClick={() => goFix("inbox")}
                  title="Change the subject line and preview text"
                  className={`mt-2 w-full rounded-xl border border-[var(--cs-border)] p-3 text-left text-[13px] leading-5 hover:border-[var(--cs-text)] ${TOOL_FOCUS}`}
                >
                  <span className="block truncate font-semibold">
                    {doc.header.brandName.trim() || "Your brand"}
                  </span>
                  <span
                    className={`block truncate font-semibold ${doc.subject.trim() ? "" : "text-[var(--cs-muted)]"}`}
                  >
                    {doc.subject.trim() || "No subject line yet"}
                  </span>
                  <span className="block truncate text-[var(--cs-muted)]">
                    {doc.preheader.trim() || "No preview text"}
                  </span>
                </button>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--cs-border)] p-4">
                <button
                  type="button"
                  onClick={() => goStep("build")}
                  className={BAR_BUTTON + " h-10"}
                >
                  Back to Build
                </button>
                <button
                  type="button"
                  disabled={!ready2}
                  onClick={() => goStep("export")}
                  className={`${PRIMARY} flex-1`}
                >
                  Continue to Export
                </button>
              </div>
            </aside>
          </div>
        ) : step === "export" ? (
          <main
            aria-label="Export"
            className="min-h-0 flex-1 overflow-y-auto bg-[var(--cs-background)] px-4 py-8"
          >
            <div className="mx-auto flex max-w-[720px] flex-col gap-4">
              {!ready2 ? (
                <div className={`${CARD} text-center`}>
                  <p className="text-base leading-6 font-semibold">Nothing to export yet.</p>
                  <p className="mt-1 text-sm leading-5 text-[var(--cs-muted)]">
                    Add a block in Build first.
                  </p>
                  <button
                    type="button"
                    onClick={() => goStep("build")}
                    className={`${PRIMARY} mt-4`}
                  >
                    Back to Build
                  </button>
                </div>
              ) : (
                <>
                  {problems.length ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f0b429] bg-[#fff8e6] p-4">
                      {warningIcon}
                      <p className="min-w-[200px] flex-1 text-sm leading-5 font-medium text-[#6b4700]">
                        {problems.length === 1
                          ? "One thing is still open in Review."
                          : `${problems.length} things are still open in Review.`}{" "}
                        You can export anyway.
                      </p>
                      <button
                        type="button"
                        onClick={() => goStep("review")}
                        className={`${BAR_BUTTON} h-10`}
                      >
                        Open Review
                      </button>
                    </div>
                  ) : null}

                  <section aria-labelledby="export-service" className={CARD}>
                    <h2 id="export-service" className="text-lg leading-7 font-bold">
                      1. Which service will send it?
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-[var(--cs-muted)]">
                      The unsubscribe link and the personal fields are written as that
                      service&apos;s own tags.
                    </p>
                    <div
                      role="group"
                      aria-label="Email service"
                      className="mt-4 flex flex-wrap gap-2"
                    >
                      {NEWSLETTER_SERVICES.map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          aria-pressed={doc.footer.service === service.id}
                          onClick={() =>
                            apply((data) => ({
                              ...data,
                              footer: { ...data.footer, service: service.id },
                            }))
                          }
                          className={`h-11 rounded-xl border px-4 text-sm font-semibold ${TOOL_FOCUS} ${
                            doc.footer.service === service.id
                              ? "border-transparent bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
                              : "border-[var(--cs-border)] hover:border-[var(--cs-text)]"
                          }`}
                        >
                          {service.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[13px] leading-5 text-[var(--cs-muted)]">
                      {SERVICE_NOTES[doc.footer.service]}
                    </p>
                    {doc.footer.service === "other" ? (
                      <label className="mt-3 block text-[13px] leading-5 font-semibold">
                        Unsubscribe link or tag
                        <input
                          value={doc.footer.unsubscribe}
                          maxLength={500}
                          placeholder="e.g. {{ unsubscribe_url }}"
                          onChange={(event) => {
                            const unsubscribe = event.target.value;
                            apply(
                              (data) => ({ ...data, footer: { ...data.footer, unsubscribe } }),
                              "footer:unsubscribe",
                            );
                          }}
                          className={`mt-1.5 h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm font-normal ${TOOL_FOCUS}`}
                        />
                      </label>
                    ) : null}
                  </section>

                  <section aria-labelledby="export-html" className={CARD}>
                    <h2 id="export-html" className="text-lg leading-7 font-bold">
                      2. Get your HTML
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-[var(--cs-muted)]">
                      In your email service, start a campaign with your own HTML (“Code your own”,
                      “Paste in code” or “Custom HTML”), paste this, and type the same subject line
                      there. brandbite doesn&apos;t send it.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void copy(html(), "Copied the HTML. Paste it into your email service.")
                        }
                        className={PRIMARY}
                      >
                        <CopyIcon />
                        Copy HTML
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          saveBlob(new Blob([html()], { type: "text/html" }), "newsletter.html");
                          setMessage({ kind: "ok", text: "Downloaded newsletter.html." });
                        }}
                        className={`${BAR_BUTTON} h-10 text-sm`}
                      >
                        <DownloadIcon />
                        Download HTML
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void copy(newsletterText(doc), "Copied the plain-text version.")
                        }
                        className={`${BAR_BUTTON} h-10 text-sm`}
                      >
                        <CopyIcon />
                        Copy plain text
                      </button>
                    </div>
                  </section>

                  <section aria-labelledby="export-test" className={CARD}>
                    <h2 id="export-test" className="text-lg leading-7 font-bold">
                      3. Send yourself a test
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-[var(--cs-muted)]">
                      {access.newsletterTest
                        ? "It goes to your own address only. Read it on a phone first; most newsletters are opened there."
                        : "With a brandbite plan you can send the newsletter to your own address before the real one goes out."}
                    </p>
                    <div className="mt-4">{testButton(`${BAR_BUTTON} h-10 text-sm`)}</div>
                  </section>
                </>
              )}
            </div>
          </main>
        ) : (
          <div className="flex min-h-0 flex-1">
            <aside
              aria-label="Blocks"
              className={`w-[300px] shrink-0 overflow-y-auto border-r border-[var(--cs-border)] bg-[var(--cs-surface)] max-[1023px]:w-full max-[1023px]:border-r-0 ${paneClass("blocks")}`}
            >
              <Palette
                pro={pro}
                saved={savedBlocks}
                onAdd={(type) => addBlock(type)}
                onAddSaved={(saved) => placeBlock(placeSavedBlock(saved, makeId))}
                onDeleteSaved={(id) => void deleteSaved(id)}
              />
            </aside>

            <main
              aria-label="Newsletter"
              className={`flex min-w-0 flex-1 flex-col ${paneClass("canvas")}`}
              style={{ background: device === "phone" ? "#e7e4df" : doc.theme.page }}
            >
              <div className="flex shrink-0 justify-center pt-3">{deviceToggle}</div>
              {device === "phone" ? (
                <>
                  <div className="flex min-h-0 flex-1 justify-center px-3 py-3">{previewFrame}</div>
                  <p className="pb-3 text-center text-[13px] leading-5 text-[var(--cs-muted)]">
                    This is how a phone shows it. Switch to Desktop to change the newsletter.
                  </p>
                </>
              ) : (
                <div className="min-h-0 flex-1">
                  <Canvas data={doc} selected={selected} dragging={dragging} actions={actions} />
                </div>
              )}
            </main>

            <aside
              aria-label="Settings"
              className={`flex w-[360px] shrink-0 flex-col border-l border-[var(--cs-border)] bg-[var(--cs-surface)] max-[1023px]:w-full max-[1023px]:border-l-0 ${paneClass("settings")}`}
            >
              <div
                role="tablist"
                aria-label="Settings"
                className="flex shrink-0 border-b border-[var(--cs-border)] px-3"
              >
                {(
                  [
                    { id: "email", label: "Email" },
                    { id: "block", label: "Block" },
                    { id: "style", label: "Style" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === option.id}
                    onClick={() => setTab(option.id)}
                    className={`-mb-px min-h-12 border-b-[3px] px-4 text-[15px] font-semibold ${TOOL_FOCUS} ${
                      tab === option.id
                        ? "border-[var(--cs-text)]"
                        : "border-transparent text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {tab === "block" ? (
                  <>
                    {inspectorTitle ? (
                      <h2 className="flex items-center gap-2 px-5 pt-5 text-lg leading-7 font-bold">
                        {selectedBlock ? <BlockGlyph type={selectedBlock.type} size={18} /> : null}
                        {inspectorTitle}
                      </h2>
                    ) : null}
                    {selectedBlock ? (
                      <BlockInspector
                        key={selectedBlock.id}
                        block={selectedBlock}
                        data={doc}
                        access={access}
                        ai={ai}
                        onRewrite={(action) => void rewrite(action)}
                        onChange={(patch, key) =>
                          apply(
                            (data) => ({
                              ...data,
                              blocks: updateBlock(
                                data.blocks,
                                selectedBlock.id,
                                (block) => ({ ...block, ...patch }) as NewsletterBlock,
                              ),
                            }),
                            key ?? null,
                          )
                        }
                      />
                    ) : selected === "header" ? (
                      <HeaderInspector
                        data={doc}
                        access={access}
                        onChange={(patch, key) =>
                          apply(
                            (data) => ({ ...data, header: { ...data.header, ...patch } }),
                            key ?? null,
                          )
                        }
                      />
                    ) : selected === "footer" ? (
                      <FooterInspector
                        data={doc}
                        onChange={(patch, key) =>
                          apply(
                            (data) => ({ ...data, footer: { ...data.footer, ...patch } }),
                            key ?? null,
                          )
                        }
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3 px-8 py-12 text-center">
                        <span
                          aria-hidden
                          className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
                        >
                          {strokeIcon("M5 3l14 8-6 2-2 6z")}
                        </span>
                        <p className="text-sm leading-5 font-semibold">Pick a block to change it</p>
                        <p className="text-[13px] leading-5 text-[var(--cs-muted)]">
                          Click any block in the newsletter and its settings show here. The header
                          and the footer can be picked too.
                        </p>
                      </div>
                    )}
                  </>
                ) : tab === "style" ? (
                  <StylePanel
                    data={doc}
                    access={access}
                    onTheme={(patch, key) =>
                      apply(
                        (data) => ({ ...data, theme: { ...data.theme, ...patch } }),
                        key ?? null,
                      )
                    }
                    onLook={(theme, style) =>
                      apply((data) => ({ ...data, theme, header: { ...data.header, style } }))
                    }
                  />
                ) : (
                  <NewsletterPanel
                    data={doc}
                    access={access}
                    ai={ai}
                    subjects={subjects}
                    onChange={(patch, key) => apply((data) => ({ ...data, ...patch }), key ?? null)}
                    onWrite={(kind, brief) => void writeDraft(kind, brief)}
                    onSuggestSubjects={() => void suggestSubjects()}
                  />
                )}
              </div>

              <p className="m-4 flex shrink-0 items-center gap-3 rounded-xl bg-[#E3F1E4] px-4 py-3 text-[13px] leading-5 font-medium text-[#14532D] max-[1023px]:hidden">
                <span aria-hidden className="shrink-0">
                  {strokeIcon("M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5M12 8h.01")}
                </span>
                Export HTML to send with your email service.
              </p>
            </aside>
          </div>
        )}

        {/* ---- On a narrow screen the three parts of Build take turns ---- */}
        {step === "build" ? (
          <nav
            aria-label="Editor parts"
            className="hidden shrink-0 border-t border-[var(--cs-border)] bg-[var(--cs-surface)] max-[1023px]:flex"
          >
            {(
              [
                { id: "blocks", label: "Blocks" },
                { id: "canvas", label: "Newsletter" },
                { id: "settings", label: "Settings" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={pane === option.id}
                onClick={() => setPane(option.id)}
                className={`min-h-12 flex-1 text-sm font-semibold ${TOOL_FOCUS} ${
                  pane === option.id ? "text-[var(--cs-text)]" : "text-[var(--cs-muted)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </nav>
        ) : null}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#8d5bff] bg-white px-3 py-2 text-[13px] font-semibold text-[#242528] shadow-xl">
            <BlockGlyph type={dragging.type} size={16} />
            {blockTypeInfo(dragging.type).label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
