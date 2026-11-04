// -----------------------------------------------------------------------------
// @file: components/dashboard/customer-board/project-menu.tsx
// @purpose: Project actions next to the project filter: create a project, and
//           rename, edit the brand guide of or delete the one selected.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { buttonClass } from "@/components/admin/v2/ui";

import { IconDots, IconPencil, IconPlus, IconTrash } from "./board-icons";
import type { BoardProject } from "./board-types";

function MenuItem({
  onClick,
  danger = false,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none ${
        danger ? "text-[var(--av2-error-text)]" : "text-[var(--av2-text)]"
      }`}
    >
      {children}
    </button>
  );
}

export function ProjectMenu({
  project,
  onCreate,
  onRename,
  onBrandGuide,
  onDelete,
}: {
  /** The project chosen in the filter, if any. */
  project: BoardProject | null;
  onCreate: () => void;
  onRename: (project: BoardProject) => void;
  onBrandGuide: (project: BoardProject) => void;
  onDelete: (project: BoardProject) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Project actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`${buttonClass("secondary")} !w-10 !px-0`}
      >
        <IconDots />
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-20 mt-1 w-56 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1 shadow-lg sm:right-auto sm:left-0">
          <MenuItem onClick={() => run(onCreate)}>
            <IconPlus />
            New project
          </MenuItem>
          {project ? (
            <>
              <div className="my-1 border-t border-[var(--av2-border)]" />
              <p className="truncate px-3 py-1 text-xs font-medium text-[var(--av2-text-2)]">
                {project.name}
              </p>
              <MenuItem onClick={() => run(() => onRename(project))}>
                <IconPencil />
                Rename
              </MenuItem>
              <MenuItem onClick={() => run(() => onBrandGuide(project))}>
                <IconPencil />
                Brand guide
              </MenuItem>
              <MenuItem danger onClick={() => run(() => onDelete(project))}>
                <IconTrash />
                Delete project
              </MenuItem>
            </>
          ) : (
            <p className="px-3 py-2 text-xs text-[var(--av2-text-2)]">
              Choose a project to rename it, edit its brand guide or delete it.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
