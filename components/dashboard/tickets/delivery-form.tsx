// -----------------------------------------------------------------------------
// @file: components/dashboard/tickets/delivery-form.tsx
// @purpose: "Upload new version" on the creative job screen. Same two steps as
//           the board's Upload work dialog: move the ticket to In review (which
//           creates the revision), then upload the files against that revision.
//           Send stays off until a file is added, so an empty form can never
//           read as a delivered version.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button, Callout, Card, Field, TextArea } from "@/components/admin/v2/ui";
import { useToast } from "@/components/ui/toast-provider";
import {
  formatBytes,
  getImageDimensions,
  isOutputMimeAllowed,
  MAX_UPLOAD_LABEL,
  OUTPUT_ACCEPT_ATTR,
  OUTPUT_ACCEPTED_LABEL,
  validateFileSize,
} from "@/lib/upload-helpers";

export const MAX_DELIVERY_FILES = 10;

type PendingFile = { id: string; file: File };

export function DeliveryForm({ ticketId, onSent }: { ticketId: string; onSent: () => void }) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const noteId = useId();

  const [files, setFiles] = useState<PendingFile[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [notesEnabled, setNotesEnabled] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Admins switch notes on per creative. It only comes back on the list route,
  // and the server drops the note when it's off, so failing quiet is safe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/creative/tickets?limit=1", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok) setNotesEnabled(json?.revisionNotesEnabled === true);
      } catch {
        // The note field simply stays hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const reasons: string[] = [];
    const accepted = Array.from(list).filter((file) => {
      if (!isOutputMimeAllowed(file.type)) {
        reasons.push(`${file.name}: only ${OUTPUT_ACCEPTED_LABEL} can be delivered.`);
        return false;
      }
      const sizeError = validateFileSize(file);
      if (sizeError) {
        reasons.push(sizeError);
        return false;
      }
      return true;
    });
    const room = Math.max(0, MAX_DELIVERY_FILES - files.length);
    if (accepted.length > room) {
      reasons.push(`You can send up to ${MAX_DELIVERY_FILES} files. Some were not added.`);
    }
    setFiles((prev) => [
      ...prev,
      ...accepted.slice(0, room).map((file) => ({ id: crypto.randomUUID(), file })),
    ]);
    setRejected(reasons);
  };

  const send = async () => {
    if (files.length === 0) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/creative/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ticketId,
          status: "IN_REVIEW",
          creativeMessage: notesEnabled ? note.trim() || null : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || `Request failed with status ${res.status}`);
        return;
      }

      let failed = 0;
      if (json?.revisionId) {
        for (let i = 0; i < files.length; i += 1) {
          const { file } = files[i];
          setProgress(`Uploading file ${i + 1} of ${files.length}…`);
          try {
            const dims = await getImageDimensions(file);
            const body = new FormData();
            body.append("file", file);
            body.append("ticketId", ticketId);
            body.append("kind", "OUTPUT_IMAGE");
            body.append("revisionId", json.revisionId);
            if (dims?.width) body.append("width", String(dims.width));
            if (dims?.height) body.append("height", String(dims.height));
            const upload = await fetch("/api/uploads/r2/upload", { method: "POST", body });
            if (!upload.ok) failed += 1;
          } catch {
            failed += 1;
          }
        }
      }

      if (failed === 0) {
        showToast({ type: "success", title: "Version sent for review" });
      } else if (failed < files.length) {
        showToast({
          type: "warning",
          title: "Some uploads failed",
          description: `${files.length - failed} of ${files.length} files uploaded.`,
        });
      } else {
        showToast({
          type: "error",
          title: "Upload failed",
          description: "Files could not be uploaded, but the version was created.",
        });
      }
      onSent();
    } catch (err) {
      console.error("[DeliveryForm] send error", err);
      setError("Failed to send this version. Please try again.");
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  const full = files.length >= MAX_DELIVERY_FILES;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl leading-7 font-semibold">Upload new version</h2>
        <span className="text-sm text-[var(--av2-text-2)] tabular-nums">
          {files.length}/{MAX_DELIVERY_FILES}
        </span>
      </div>

      <div
        className="mt-4 rounded-xl border-2 border-dashed border-[var(--av2-border)] px-4 py-6 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!sending) addFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-sm">Drag and drop files here, or</p>
        <Button
          className="mt-2"
          disabled={sending || full}
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </Button>
        <p className="mt-2 text-xs text-[var(--av2-text-2)]">
          Images or PDF. Up to {MAX_UPLOAD_LABEL} per file.
        </p>
        <input
          ref={inputRef}
          type="file"
          aria-label="Add files to this version"
          accept={OUTPUT_ACCEPT_ATTR}
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {rejected.length > 0 ? (
        <div className="mt-3">
          <Callout tone="warning" title="Some files weren't added">
            <ul className="space-y-0.5">
              {rejected.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </Callout>
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="mt-3 divide-y divide-[var(--av2-border)] rounded-xl border border-[var(--av2-border)]">
          {files.map(({ id, file }) => (
            <li key={id} className="flex items-center justify-between gap-3 py-1 pr-1 pl-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-[var(--av2-text-2)]">{formatBytes(file.size)}</p>
              </div>
              <Button
                variant="ghost"
                disabled={sending}
                aria-label={`Remove ${file.name}`}
                onClick={() => setFiles((prev) => prev.filter((f) => f.id !== id))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {notesEnabled ? (
        <Field label="Note to your customer (optional)" htmlFor={noteId} className="mt-4">
          <TextArea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            disabled={sending}
            placeholder="Highlight what you changed, any open questions, or how to review this version."
          />
        </Field>
      ) : null}

      {error ? (
        <div className="mt-3">
          <Callout tone="error" title="This version wasn't sent">
            {error}
          </Callout>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <p role="status" className="min-w-0 flex-1 text-sm text-[var(--av2-text-2)]">
          {progress ??
            (files.length === 0
              ? "Add at least one file to send this version."
              : `${files.length === 1 ? "This file isn't" : `These ${files.length} files aren't`} sent yet. Press Send for review to deliver them; it also stops your timer.`)}
        </p>
        <Button variant="primary" disabled={sending || files.length === 0} onClick={send}>
          {sending ? "Sending…" : "Send for review"}
        </Button>
      </div>
    </Card>
  );
}
