// -----------------------------------------------------------------------------
// @file: app/customer/tickets/[ticketId]/page.tsx
// @purpose: Customer-facing ticket detail page for a single company ticket
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type TicketDetailResponse = {
  company: {
    id: string;
    name: string;
    slug: string;
  };
  ticket: {
    id: string;
    title: string;
    description: string | null;
    status: TicketStatus;
    priority: TicketPriority;
    dueDate: string | null;
    createdAt: string;
    updatedAt: string;
    companyTicketNumber: number | null;
    project: {
      id: string;
      name: string;
      code: string | null;
    } | null;
    jobType: {
      id: string;
      name: string;
      tokenCost: number;
      designerPayoutTokens: number;
    } | null;
    designer: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    createdBy: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  };
};

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TicketDetailResponse };

type TicketComment = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
};

type TicketAsset = {
  id: string;
  kind: "BRIEF_INPUT" | "OUTPUT_IMAGE";
  storageKey: string;
  url: string | null;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

const PRIORITY_BADGE: Record<TicketPriority, string> = {
  LOW: "bg-[#f2f1ed] text-[#7a7a7a]",
  MEDIUM: "bg-[#e1f0ff] text-[#245c9b]",
  HIGH: "bg-[#fff5dd] text-[#8a6000]",
  URGENT: "bg-[#fde8e7] text-[#b13832]",
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v = v / 1024;
    i += 1;
  }
  const precision = i === 0 ? 0 : i === 1 ? 0 : 1;
  return `${v.toFixed(precision)} ${units[i]}`;
}

async function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null;

  return await new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const w = Number(img.naturalWidth) || 0;
      const h = Number(img.naturalHeight) || 0;
      URL.revokeObjectURL(url);

      if (w > 0 && h > 0) {
        resolve({ width: w, height: h });
      } else {
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

export default function CustomerTicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const router = useRouter();
  const ticketIdFromParams = params?.ticketId;

  const [state, setState] = useState<ViewState>({ status: "loading" });

  // comments state
  const [comments, setComments] = useState<TicketComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // brief assets state
  const [briefAssets, setBriefAssets] = useState<TicketAsset[] | null>(null);
  const [briefAssetsLoading, setBriefAssetsLoading] = useState(false);
  const [briefAssetsError, setBriefAssetsError] = useState<string | null>(null);

  // download urls cache (assetId -> url)
  const [assetDownloadUrls, setAssetDownloadUrls] = useState<Record<string, string>>(
    {},
  );

  const [uploadingBriefs, setUploadingBriefs] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Hem useParams hem de URL path üzerinden ticketId çözmeye çalış
    const resolvedTicketId =
      (typeof ticketIdFromParams === "string" && ticketIdFromParams) ||
      (typeof window !== "undefined"
        ? window.location.pathname.split("/").pop() ?? ""
        : "");

    // Eğer hâlâ yoksa fetch bile yapmıyoruz, loading'de bırakıyoruz
    if (!resolvedTicketId) {
      console.warn("[CustomerTicketDetailPage] Could not resolve ticket id from URL");
      return;
    }

    const load = async () => {
      setState({ status: "loading" });

      try {
        const res = await fetch(`/api/customer/tickets/${resolvedTicketId}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = json?.error || `Request failed with status ${res.status}`;
          if (!cancelled) {
            setState({ status: "error", message: msg });
          }
          return;
        }

        if (!cancelled) {
          setState({
            status: "ready",
            data: json as TicketDetailResponse,
          });
        }
      } catch (error) {
        console.error("Ticket detail fetch error:", error);
        if (!cancelled) {
          setState({
            status: "error",
            message: "Unexpected error while loading ticket detail.",
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [ticketIdFromParams]);

  // comments loader – ticket id belli olduktan sonra
  const ticketIdFromData = state.status === "ready" ? state.data.ticket.id : null;

  useEffect(() => {
    if (!ticketIdFromData) return;

    let cancelled = false;

    const loadComments = async () => {
      setCommentsLoading(true);
      setCommentsError(null);

      try {
        const res = await fetch(`/api/customer/tickets/${ticketIdFromData}/comments`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = json?.error || `Request failed with status ${res.status}`;
          if (!cancelled) {
            setCommentsError(msg);
          }
          return;
        }

        if (!cancelled) {
          setComments((json?.comments as TicketComment[]) ?? []);
        }
      } catch (err) {
        console.error("Ticket comments fetch error:", err);
        if (!cancelled) {
          setCommentsError("Unexpected error while loading comments.");
        }
      } finally {
        if (!cancelled) {
          setCommentsLoading(false);
        }
      }
    };

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [ticketIdFromData]);

  // brief assets loader
  const loadBriefAssets = async (ticketId: string) => {
    setBriefAssetsLoading(true);
    setBriefAssetsError(null);

    try {
      const res = await fetch(
        `/api/customer/tickets/${ticketId}/assets?kind=BRIEF_INPUT`,
        { cache: "no-store" },
      );
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error || `Request failed with status ${res.status}`;
        setBriefAssetsError(msg);
        return;
      }

      const assets = (json?.assets as TicketAsset[]) ?? [];
      setBriefAssets(assets);
    } catch (err) {
      console.error("Brief assets fetch error:", err);
      setBriefAssetsError("Unexpected error while loading attachments.");
    } finally {
      setBriefAssetsLoading(false);
    }
  };

  useEffect(() => {
    if (!ticketIdFromData) return;
    loadBriefAssets(ticketIdFromData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketIdFromData]);

  // Fetch a presigned download URL for an asset (and cache it)
  const ensureDownloadUrl = async (assetId: string) => {
    if (assetDownloadUrls[assetId]) return;

    try {
      const res = await fetch(`/api/assets/${assetId}/download`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.warn("[CustomerTicketDetailPage] download url failed:", json);
        return;
      }

      const url = json?.downloadUrl as string | undefined;
      if (!url) return;

      setAssetDownloadUrls((prev) => ({ ...prev, [assetId]: url }));
    } catch (err) {
      console.warn("[CustomerTicketDetailPage] download url error:", err);
    }
  };

  useEffect(() => {
    const assets = briefAssets ?? [];
    if (assets.length === 0) return;

    // Preload URLs for the first few
    assets.slice(0, 6).forEach((a) => {
      void ensureDownloadUrl(a.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefAssets]);

  // ---------------------------------------------------------------------------
  // HOOK sonrası derived state
  // ---------------------------------------------------------------------------

  const error = state.status === "error" ? state.message : null;
  const data = state.status === "ready" ? state.data : null;
  const company = data?.company ?? null;
  const ticket = data?.ticket ?? null;

  const ticketCode = useMemo(() => {
    if (!ticket) return "";
    if (ticket.project?.code && ticket.companyTicketNumber != null) {
      return `${ticket.project.code}-${ticket.companyTicketNumber}`;
    }
    if (ticket.companyTicketNumber != null) {
      return `#${ticket.companyTicketNumber}`;
    }
    return ticket.id;
  }, [ticket]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const formatStatusLabel = (status: TicketStatus) => STATUS_LABELS[status];

  const formatPriorityLabel = (priority: TicketPriority) => {
    switch (priority) {
      case "LOW":
        return "Low";
      case "MEDIUM":
        return "Medium";
      case "HIGH":
        return "High";
      case "URGENT":
        return "Urgent";
    }
  };

  const handleSubmitComment = async () => {
    if (!ticketIdFromData) return;
    const trimmed = newComment.trim();
    if (!trimmed) return;

    setSubmittingComment(true);
    setCommentsError(null);

    try {
      const res = await fetch(`/api/customer/tickets/${ticketIdFromData}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error || `Request failed with status ${res.status}`;
        setCommentsError(msg);
        return;
      }

      const created = json?.comment as TicketComment | undefined;
      if (created) {
        setComments((prev) => [...(prev ?? []), created]);
        setNewComment("");
      }
    } catch (err) {
      console.error("Add comment error:", err);
      setCommentsError("Failed to add comment. Please try again.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // Upload new brief images from ticket detail
  const handleUploadBriefFiles = async (files: FileList | null) => {
    if (!ticketIdFromData) return;
    if (!files || files.length === 0) return;

    const incoming = Array.from(files);
    const accepted = incoming.filter((f) => f.type.startsWith("image/"));

    if (accepted.length === 0) {
      setBriefAssetsError("Only image files are supported for now.");
      return;
    }

    setUploadingBriefs(true);
    setUploadProgressText("Preparing uploads...");
    setBriefAssetsError(null);

    let failed = 0;

    for (let i = 0; i < accepted.length; i += 1) {
      const file = accepted[i];

      try {
        setUploadProgressText(`Uploading ${i + 1} of ${accepted.length}...`);

        const presignRes = await fetch("/api/uploads/r2/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId: ticketIdFromData,
            kind: "BRIEF_INPUT",
            contentType: file.type || "application/octet-stream",
            bytes: file.size,
            originalName: file.name,
          }),
        });

        const presignJson = await presignRes.json().catch(() => null);

        if (!presignRes.ok) {
          failed += 1;
          console.error("[CustomerTicketDetailPage] Presign failed:", presignRes.status, presignJson);
          continue;
        }

        const uploadUrl: string | undefined = presignJson?.uploadUrl;
        const storageKey: string | undefined = presignJson?.storageKey;

        if (!uploadUrl || !storageKey) {
          failed += 1;
          console.error("[CustomerTicketDetailPage] Presign missing uploadUrl/storageKey");
          continue;
        }

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });

        if (!putRes.ok) {
          failed += 1;
          console.error("[CustomerTicketDetailPage] R2 PUT failed:", putRes.status);
          continue;
        }

        const dims = await getImageDimensions(file);

        const registerRes = await fetch("/api/assets/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId: ticketIdFromData,
            kind: "BRIEF_INPUT",
            storageKey,
            mimeType: file.type || "application/octet-stream",
            bytes: file.size,
            width: dims?.width ?? null,
            height: dims?.height ?? null,
            originalName: file.name,
          }),
        });

        const registerJson = await registerRes.json().catch(() => null);

        if (!registerRes.ok) {
          failed += 1;
          console.error("[CustomerTicketDetailPage] Asset register failed:", registerRes.status, registerJson);
          continue;
        }
      } catch (err) {
        failed += 1;
        console.error("[CustomerTicketDetailPage] Upload error:", err);
      }
    }

    setUploadProgressText(null);
    setUploadingBriefs(false);

    await loadBriefAssets(ticketIdFromData);

    if (failed > 0) {
      setBriefAssetsError(
        `Some uploads failed (${failed}). You can try again.`,
      );
    }
  };

  if (state.status === "loading") {
    return <TicketDetailSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top navigation */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f15b2b] text-sm font-semibold text-white">
              B
            </div>
            <span className="text-lg font-semibold tracking-tight">Brandbite</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-[#7a7a7a] md:flex">
            <button className="font-medium text-[#424143]" onClick={() => router.push("/customer/tickets")}>
              My tickets
            </button>
            <button className="font-medium text-[#7a7a7a]" onClick={() => router.push("/customer/board")}>
              Board
            </button>
            <button className="font-medium text-[#7a7a7a]" onClick={() => router.push("/customer/tokens")}>
              Tokens
            </button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.push("/customer/tickets")}
              className="mb-2 inline-flex items-center gap-1 text-xs text-[#7a7a7a] hover:text-[#424143]"
            >
              <span className="text-lg leading-none">←</span>
              <span>Back to tickets</span>
            </button>

            <h1 className="text-2xl font-semibold tracking-tight">
              {ticket?.title ?? "Ticket"}
            </h1>
            {ticketCode && (
              <p className="mt-1 text-xs text-[#9a9892]">
                Ticket code:{" "}
                <span className="font-medium text-[#424143]">{ticketCode}</span>
              </p>
            )}
            {company && (
              <p className="mt-1 text-xs text-[#9a9892]">
                Company:{" "}
                <span className="font-medium text-[#424143]">{company.name}</span>{" "}
                ({company.slug})
              </p>
            )}
          </div>

          {ticket && (
            <div className="flex flex-col items-end gap-2">
              <span className="inline-flex rounded-full bg-[#f5f3f0] px-3 py-1 text-[11px] font-medium text-[#424143]">
                {formatStatusLabel(ticket.status)}
              </span>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-[11px] font-medium ${PRIORITY_BADGE[ticket.priority]}`}
              >
                {formatPriorityLabel(ticket.priority)}
              </span>
            </div>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
            <p className="font-medium">Error</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {!error && ticket && (
          <div className="grid gap-4 md:grid-cols-3">
            {/* Left: description + meta */}
            <section className="space-y-4 md:col-span-2">
              {/* Description */}
              <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-[#424143]">Brief</h2>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-full border border-[#d4d2cc] bg-white px-3 py-1 text-[11px] font-medium text-[#424143] hover:bg-[#f7f4f0] disabled:cursor-not-allowed disabled:opacity-60">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploadingBriefs}
                        onChange={(e) => {
                          void handleUploadBriefFiles(e.target.files);
                          e.currentTarget.value = "";
                        }}
                      />
                      Add images
                    </label>
                    <button
                      type="button"
                      onClick={() => ticketIdFromData && void loadBriefAssets(ticketIdFromData)}
                      className="rounded-full border border-[#d4d2cc] bg-white px-3 py-1 text-[11px] font-medium text-[#424143] hover:bg-[#f7f4f0]"
                      disabled={briefAssetsLoading || uploadingBriefs}
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {ticket.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[#7a7a7a]">
                    {ticket.description}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-[#9a9892]">
                    No description was provided for this ticket.
                  </p>
                )}

                {/* Attachments */}
                <div className="mt-4 rounded-xl border border-[#ebe7df] bg-[#fbf8f4] px-3 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#424143]">
                      Brief attachments
                    </p>
                    <p className="text-[11px] text-[#9a9892]">
                      {(briefAssets?.length ?? 0) > 0
                        ? `${briefAssets!.length} file(s)`
                        : "—"}
                    </p>
                  </div>

                  {uploadProgressText && (
                    <div className="mt-2 rounded-md border border-[#eadfce] bg-[#fffaf1] px-3 py-2 text-[11px] text-[#6b6258]">
                      {uploadProgressText}
                    </div>
                  )}

                  {briefAssetsError && (
                    <div className="mt-2 rounded-md border border-red-200 bg-[#fff7f7] px-3 py-2 text-[11px] text-red-700">
                      {briefAssetsError}
                    </div>
                  )}

                  {briefAssetsLoading && (
                    <p className="mt-2 text-[11px] text-[#9a9892]">
                      Loading attachments…
                    </p>
                  )}

                  {!briefAssetsLoading &&
                    !briefAssetsError &&
                    (briefAssets?.length ?? 0) === 0 && (
                      <p className="mt-2 text-[11px] text-[#9a9892]">
                        No attachments yet. Add reference images to help your designer.
                      </p>
                    )}

                  {!briefAssetsLoading &&
                    !briefAssetsError &&
                    (briefAssets?.length ?? 0) > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {briefAssets!.map((a) => {
                          const src = assetDownloadUrls[a.id] ?? a.url ?? null;

                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => void ensureDownloadUrl(a.id)}
                              className="group relative overflow-hidden rounded-lg border border-[#e3e1dc] bg-white"
                              title={a.originalName ?? a.storageKey}
                            >
                              {src ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={src}
                                  alt={a.originalName ?? "Attachment"}
                                  className="h-28 w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-28 items-center justify-center text-[11px] text-[#9a9892]">
                                  Click to load
                                </div>
                              )}

                              <div className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/40 to-transparent px-2 py-1 text-left text-[10px] text-white group-hover:block">
                                <div className="truncate">
                                  {a.originalName ?? "Attachment"}
                                </div>
                                <div className="opacity-90">
                                  {formatBytes(a.bytes)}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                </div>
              </div>

              {/* Meta sections (project, job type, dates) */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-3 shadow-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                    Project & job
                  </h3>
                  <div className="mt-2 space-y-1 text-xs text-[#7a7a7a]">
                    <p>
                      Project:{" "}
                      <span className="font-semibold text-[#424143]">
                        {ticket.project?.name || "—"}
                      </span>
                    </p>
                    <p>
                      Project code:{" "}
                      <span className="font-semibold text-[#424143]">
                        {ticket.project?.code || "—"}
                      </span>
                    </p>
                    <p>
                      Job type:{" "}
                      <span className="font-semibold text-[#424143]">
                        {ticket.jobType?.name || "—"}
                      </span>
                    </p>
                    <p>
                      Token cost:{" "}
                      <span className="font-semibold text-[#424143]">
                        {ticket.jobType?.tokenCost != null
                          ? `${ticket.jobType.tokenCost} tokens`
                          : "—"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-3 shadow-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                    Dates
                  </h3>
                  <div className="mt-2 space-y-1 text-xs text-[#7a7a7a]">
                    <p>
                      Created:{" "}
                      <span className="font-semibold text-[#424143]">
                        {formatDateTime(ticket.createdAt)}
                      </span>
                    </p>
                    <p>
                      Last updated:{" "}
                      <span className="font-semibold text-[#424143]">
                        {formatDateTime(ticket.updatedAt)}
                      </span>
                    </p>
                    <p>
                      Due date:{" "}
                      <span className="font-semibold text-[#424143]">
                        {formatDate(ticket.dueDate)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Right: comments / people / helper */}
            <section className="space-y-4">
              {/* Comments card */}
              <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-3 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                  Comments
                </h3>

                {commentsError && (
                  <div className="mt-2 rounded-md border border-red-200 bg-[#fff7f7] px-3 py-2 text-[11px] text-red-700">
                    {commentsError}
                  </div>
                )}

                <div className="mt-2 max-h-60 space-y-2 overflow-y-auto pr-1">
                  {commentsLoading && (
                    <p className="text-[11px] text-[#9a9892]">
                      Loading comments…
                    </p>
                  )}
                  {!commentsLoading && !commentsError && (comments?.length ?? 0) === 0 && (
                    <p className="text-[11px] text-[#9a9892]">
                      No comments yet. Use the form below to start a thread with your team and the designer.
                    </p>
                  )}
                  {!commentsLoading &&
                    !commentsError &&
                    (comments?.length ?? 0) > 0 &&
                    comments!.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg bg-[#f5f3f0] px-3 py-2 text-[11px]"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-semibold text-[#424143]">
                            {c.author.name || c.author.email}
                          </span>
                          <span className="text-[10px] text-[#9a9892]">
                            {formatDateTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-[#424143]">
                          {c.body}
                        </p>
                      </div>
                    ))}
                </div>

                {/* Add comment form */}
                <div className="mt-3 border-t border-[#ebe7df] pt-3">
                  <label className="mb-1 block text-[11px] font-medium text-[#424143]">
                    Add a comment
                  </label>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    placeholder="Share feedback, clarifications, or next steps for this ticket."
                    className="w-full rounded-md border border-[#d4d2cc] bg-[#fbf8f4] px-3 py-2 text-[11px] text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[10px] text-[#9a9892]">
                      Comments are visible to your team and Brandbite designers.
                    </p>
                    <button
                      type="button"
                      disabled={submittingComment || !newComment.trim() || !ticketIdFromData}
                      onClick={handleSubmitComment}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${
                        submittingComment || !newComment.trim()
                          ? "cursor-not-allowed bg-[#e3ded4] text-[#9a9892]"
                          : "bg-[#f15b2b] text-white hover:bg-[#e44f22]"
                      }`}
                    >
                      {submittingComment ? "Sending…" : "Add comment"}
                    </button>
                  </div>
                </div>
              </div>

              {/* People card */}
              <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-3 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                  People
                </h3>
                <div className="mt-2 space-y-2 text-xs text-[#7a7a7a]">
                  <div>
                    <p className="font-semibold text-[#424143]">Requester</p>
                    <p>
                      {ticket.createdBy?.name || ticket.createdBy?.email || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="mt-2 font-semibold text-[#424143]">Designer</p>
                    <p>{ticket.designer?.name || ticket.designer?.email || "—"}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {!error && !ticket && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-[#fffaf2] px-4 py-3 text-sm text-amber-800">
            Ticket could not be loaded.
          </div>
        )}
      </div>
    </div>
  );
}

function TicketDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[#e3ded4]" />
            <div className="h-4 w-24 rounded bg-[#e3ded4]" />
          </div>
        </div>
        <div className="mb-4 h-6 w-64 rounded bg-[#e3ded4]" />
        <div className="mb-2 h-3 w-40 rounded bg-[#e3ded4]" />
        <div className="mb-6 h-3 w-32 rounded bg-[#e3ded4]" />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            <div className="h-32 rounded-2xl bg-white" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-32 rounded-2xl bg-white" />
              <div className="h-32 rounded-2xl bg-white" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-40 rounded-2xl bg-white" />
            <div className="h-32 rounded-2xl bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
