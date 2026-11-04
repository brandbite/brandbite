// -----------------------------------------------------------------------------
// @file: components/dashboard/creative-board/upload-work-dialog.tsx
// @purpose: Attach design files and a note, then send the ticket for review.
//           Presentation only; validation and uploading live on the board page.
// -----------------------------------------------------------------------------

"use client";

import { useId, useRef } from "react";

import { Button, Eyebrow, Field, TextArea } from "@/components/admin/v2/ui";
import { IconX } from "@/components/navigation/nav-icons";
import { Modal } from "@/components/ui/modal";
import { OUTPUT_ACCEPT_ATTR, type PendingFile } from "@/lib/upload-helpers";

export function UploadWorkDialog({
  open,
  ticketTitle,
  files,
  maxFiles,
  note,
  notesEnabled,
  uploading,
  sending,
  progress,
  onNoteChange,
  onAddFiles,
  onRemoveFile,
  onClose,
  onConfirm,
}: {
  open: boolean;
  ticketTitle: string;
  files: PendingFile[];
  maxFiles: number;
  note: string;
  /** Admins switch notes on per creative; the server drops the note otherwise. */
  notesEnabled: boolean;
  uploading: boolean;
  sending: boolean;
  progress: string | null;
  onNoteChange: (note: string) => void;
  onAddFiles: (files: FileList | null) => void;
  onRemoveFile: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const noteId = `${reactId}-note`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const atLimit = files.length >= maxFiles;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      labelledBy={titleId}
      className="flex max-h-[90vh] flex-col overflow-hidden border border-[var(--av2-border)] p-0!"
    >
      <div className="shrink-0 border-b border-[var(--av2-border)] px-4 py-4 sm:px-6">
        <Eyebrow>Upload work</Eyebrow>
        <h2 id={titleId} className="mt-1 text-xl leading-7 font-semibold break-words">
          {ticketTitle}
        </h2>
        <p className="mt-1 text-sm text-[var(--av2-text-2)]">
          Attach at least one design file to send this version for review.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Design files</p>
            <span className="text-xs text-[var(--av2-text-2)] tabular-nums">
              {files.length}/{maxFiles}
            </span>
          </div>

          <div
            className="rounded-xl border-2 border-dashed border-[var(--av2-border)] bg-[var(--av2-bg)] px-4 py-5 text-center transition-colors hover:border-[var(--av2-accent)]"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddFiles(e.dataTransfer.files);
            }}
          >
            <p className="text-sm text-[var(--av2-text-2)]">Drag & drop images here, or</p>
            <Button
              className="mt-2"
              disabled={uploading || atLimit}
              onClick={() => inputRef.current?.click()}
            >
              Browse files
            </Button>
            <p className="mt-2 text-xs text-[var(--av2-text-2)]">
              Images or PDF, 4 MB each, up to {maxFiles} files
            </p>
            <input
              ref={inputRef}
              type="file"
              aria-label="Design files"
              accept={OUTPUT_ACCEPT_ATTR}
              multiple
              className="hidden"
              disabled={uploading || atLimit}
              onChange={(e) => {
                onAddFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {files.map((rf) => (
                <li
                  key={rf.id}
                  className="overflow-hidden rounded-lg border border-[var(--av2-border)]"
                >
                  {rf.file.type.startsWith("image/") ? (
                    <img
                      src={URL.createObjectURL(rf.file)}
                      alt={rf.file.name}
                      className="h-20 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center bg-[var(--av2-bg)] text-xs font-semibold tracking-wide text-[var(--av2-text-2)] uppercase">
                      {rf.file.name.split(".").pop() || "file"}
                    </div>
                  )}
                  <div className="flex items-center gap-1 pl-2">
                    <p className="min-w-0 flex-1 truncate text-xs text-[var(--av2-text-2)]">
                      {rf.file.name}
                    </p>
                    {!uploading && (
                      <button
                        type="button"
                        onClick={() => onRemoveFile(rf.id)}
                        aria-label={`Remove ${rf.file.name}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--av2-text-2)] hover:bg-[var(--av2-bg)] hover:text-[var(--av2-text)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
                      >
                        <IconX width={16} height={16} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {notesEnabled && (
          <Field label="Note to your customer (optional)" htmlFor={noteId}>
            <TextArea
              id={noteId}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              rows={3}
              disabled={uploading}
              placeholder="Highlight what you changed, any open questions, or how they should review this version."
            />
          </Field>
        )}

        {progress && (
          <p
            role="status"
            className="rounded-lg border border-[var(--av2-border)] bg-[var(--av2-bg)] px-3 py-2 text-sm text-[var(--av2-text-2)]"
          >
            {progress}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--av2-border)] px-4 py-3 sm:px-6 sm:py-4">
        <Button onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          disabled={uploading || sending || files.length === 0}
        >
          {uploading ? "Uploading..." : "Upload & send for review"}
        </Button>
      </div>
    </Modal>
  );
}
