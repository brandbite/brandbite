// -----------------------------------------------------------------------------
// @file: components/tickets/source-files-panel.tsx
// @purpose: "Source files" on a request. The assigned creative uploads PSD,
//           AI, print files and the like; the browser sends each file
//           straight to the customer's Google Drive (when connected) or to
//           brandbite storage, never through our servers. Customers open or
//           download them; files on brandbite storage show how long they're
//           kept and nudge the customer to connect a Drive.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  Skeleton,
  buttonClass,
} from "@/components/admin/v2/ui";

type Storage = "GOOGLE_DRIVE" | "DROPBOX" | "R2";

type SourceFile = {
  id: string;
  name: string;
  sizeBytes: number;
  storage: Storage;
  externalUrl: string | null;
  deleteAfter: string | null;
  uploadedBy: string | null;
  createdAt: string;
  canRemove: boolean;
};

type Listing = {
  files: SourceFile[];
  canUpload: boolean;
  destination: Storage;
  retentionDays: number;
};

type Upload = { key: string; name: string; progress: number; error: string | null };

export type SourceFilesViewer = "creative" | "customer" | "admin";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Send the file to the URL the server handed out, reporting progress.
 *  Drive and R2 take a PUT; Dropbox's temporary upload links take a POST. */
function putFile(
  url: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void,
  method: "PUT" | "POST" = "PUT",
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.responseText)
        : reject(new Error(`Upload failed (${xhr.status}).`));
    xhr.onerror = () =>
      reject(new Error("The upload didn't go through. Check your connection and try again."));
    xhr.send(file);
  });
}

export function SourceFilesPanel({
  ticketId,
  viewer,
}: {
  ticketId: string;
  viewer: SourceFilesViewer;
}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const base = `/api/tickets/${ticketId}/source-files`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Could not load source files.");
      setListing(json);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load source files.");
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchUpload = (key: string, patch: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));

  const uploadOne = async (file: File) => {
    const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
    setUploads((list) => [...list, { key, name: file.name, progress: 0, error: null }]);
    try {
      const startRes = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
        }),
      });
      const start = await startRes.json().catch(() => null);
      if (!startRes.ok) throw new Error(start?.error || "Could not start the upload.");

      let responseText = "";
      let putError: Error | null = null;
      try {
        responseText = await putFile(
          start.uploadUrl,
          file,
          start.contentType,
          (p) => patchUpload(key, { progress: p }),
          start.method === "POST" ? "POST" : "PUT",
        );
      } catch (error) {
        // The bytes may still have arrived (e.g. only the answer was blocked):
        // let the server check with the storage either way, so a real upload
        // is kept and a failed one is marked failed instead of left hanging.
        putError = error instanceof Error ? error : new Error("Upload failed.");
      }
      let externalId: string | undefined;
      if (start.storage === "GOOGLE_DRIVE" && responseText) {
        try {
          externalId = (JSON.parse(responseText) as { id?: string }).id;
        } catch {
          externalId = undefined;
        }
      }
      const doneRes = await fetch(`${base}/${start.fileId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalId }),
      });
      const done = await doneRes.json().catch(() => null);
      if (!doneRes.ok) {
        throw putError ?? new Error(done?.error || "Could not finish the upload.");
      }
      setUploads((list) => list.filter((u) => u.key !== key));
      await load();
    } catch (error) {
      patchUpload(key, { error: error instanceof Error ? error.message : "Upload failed." });
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) void uploadOne(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async (file: SourceFile) => {
    setRemoving(file.id);
    setActionError(null);
    try {
      const res = await fetch(`${base}/${file.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Could not remove the file.");
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not remove the file.");
    } finally {
      setRemoving(null);
    }
  };

  const files = listing?.files ?? [];
  const onBrandbite = files.some((f) => f.storage === "R2");
  const retentionDays = listing?.retentionDays ?? 90;
  const destinationText =
    listing?.destination === "GOOGLE_DRIVE"
      ? "Files go straight into the customer's Google Drive."
      : listing?.destination === "DROPBOX"
        ? `Files up to 150 MB go straight into the customer's Dropbox. Bigger files are stored on brandbite and kept for ${retentionDays} days after the request is done.`
        : `The customer hasn't connected Google Drive or Dropbox, so files are stored on brandbite and kept for ${retentionDays} days after the request is done.`;
  const sizeHint =
    listing?.destination === "GOOGLE_DRIVE" ? "No size limit." : "Up to 5 GB per file.";

  return (
    <Card>
      <CardTitle description="Layered and print-ready files: PSD, AI, INDD, PDF, video projects and more.">
        Source files
      </CardTitle>

      {loadError && (
        <div className="mt-4">
          <Callout tone="error" title="Couldn't load source files">
            {loadError}
          </Callout>
        </div>
      )}

      {!listing && !loadError ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : null}

      {listing?.canUpload && (
        <div
          className="mt-4 rounded-xl border border-dashed border-[var(--av2-border)] p-5 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
        >
          <p className="text-sm text-[var(--av2-text-2)]">{destinationText}</p>
          <div className="mt-3">
            <Button variant="primary" onClick={() => inputRef.current?.click()}>
              Upload source files
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              aria-label="Choose source files"
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--av2-text-2)]">Or drop files here. {sizeHint}</p>
        </div>
      )}

      {uploads.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Uploads in progress">
          {uploads.map((u) => (
            <li key={u.key} className="rounded-lg border border-[var(--av2-border)] p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{u.name}</span>
                <span className="shrink-0 text-[var(--av2-text-2)]">
                  {u.error ? "Failed" : `${Math.round(u.progress * 100)}%`}
                </span>
              </div>
              {u.error ? (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-sm text-[var(--av2-error-text)]">{u.error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))}
                  >
                    Dismiss
                  </Button>
                </div>
              ) : (
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--av2-track)]"
                  role="progressbar"
                  aria-label={`Uploading ${u.name}`}
                  aria-valuenow={Math.round(u.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full bg-[var(--av2-accent)] transition-[width]"
                    style={{ width: `${Math.round(u.progress * 100)}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {actionError && (
        <div className="mt-4">
          <Callout tone="error">{actionError}</Callout>
        </div>
      )}

      {listing && files.length === 0 && uploads.length === 0 && (
        <p className="mt-4 text-sm text-[var(--av2-text-2)]">
          {viewer === "creative"
            ? "No source files delivered yet."
            : "No source files yet. They appear here once the creative delivers them."}
        </p>
      )}

      {files.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--av2-border)]">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                  {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
                  {file.uploadedBy ? ` · ${file.uploadedBy}` : ""}
                </p>
                <div className="mt-1">
                  {file.storage === "GOOGLE_DRIVE" ? (
                    <Badge tone="green">In Google Drive</Badge>
                  ) : file.storage === "DROPBOX" ? (
                    <Badge tone="green">In Dropbox</Badge>
                  ) : file.deleteAfter ? (
                    <Badge tone="amber">On brandbite until {formatDate(file.deleteAfter)}</Badge>
                  ) : (
                    <Badge tone="neutral">On brandbite · kept 90 days after done</Badge>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {file.storage === "R2" ? (
                  <a
                    href={`${base}/${file.id}/download`}
                    className={buttonClass("secondary", "sm")}
                  >
                    Download
                  </a>
                ) : viewer === "customer" ? (
                  <a
                    href={`${base}/${file.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass("secondary", "sm")}
                  >
                    {file.storage === "DROPBOX" ? "Open in Dropbox" : "Open in Drive"}
                  </a>
                ) : null}
                {file.canRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={removing === file.id}
                    onClick={() => void remove(file)}
                  >
                    {removing === file.id ? "Removing…" : "Remove"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewer === "customer" && onBrandbite && listing?.destination !== "GOOGLE_DRIVE" && (
        <div className="mt-4">
          <Callout tone="info" title="Keep your source files for good">
            Files on brandbite are kept for {retentionDays} days after the request is done.{" "}
            {listing?.destination === "DROPBOX"
              ? "Dropbox takes files up to 150 MB; connect Google Drive too and even the biggest files land in your own Drive."
              : "Connect Google Drive and new source files land in your own Drive instead."}{" "}
            <Link href="/customer/settings?tab=integrations" className="font-medium underline">
              Connect Google Drive
            </Link>
          </Callout>
        </div>
      )}
    </Card>
  );
}
