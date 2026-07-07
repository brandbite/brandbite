// -----------------------------------------------------------------------------
// @file: components/ui/pdf-canvas.tsx
// @purpose: Render a single PDF page to a <canvas> via pdf.js so the pin
//           overlay can sit on top of it (an <iframe>/<embed> swallows clicks
//           and cannot be annotated). The bytes are fetched from our own
//           same-origin proxy (/api/assets/:id/raw) to avoid any CORS
//           dependency on the R2 public domain.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useRef, useState } from "react";

// pdf.js is loaded dynamically inside the effect so it never runs during SSR
// (it references browser-only globals). The worker is served same-origin from
// /public so CSP `worker-src 'self'` covers it and its version always matches
// the pinned pdfjs-dist (both come from the same install).
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<any>; destroy: () => void };

export function PdfCanvas({
  assetId,
  page,
  onNumPages,
  className,
}: {
  assetId: string;
  page: number;
  onNumPages?: (n: number) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const renderTaskRef = useRef<any>(null);

  // Load the document once per asset.
  useEffect(() => {
    let cancelled = false;
    let localDoc: PdfDoc | null = null;
    setStatus("loading");
    setDoc(null);

    (async () => {
      try {
        const pdfjs: any = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({ url: `/api/assets/${assetId}/raw` });
        const loaded = (await loadingTask.promise) as PdfDoc;
        if (cancelled) {
          loaded.destroy();
          return;
        }
        localDoc = loaded;
        setDoc(loaded);
        onNumPages?.(loaded.numPages);
      } catch (err) {
        console.error("[PdfCanvas] load error:", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      localDoc?.destroy();
    };
    // onNumPages intentionally omitted — parent passes a stable callback and we
    // only want to reload when the asset changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  // Render the requested page whenever the doc or page changes.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;

    (async () => {
      try {
        const safePage = Math.min(Math.max(1, page), doc.numPages);
        const pdfPage = await doc.getPage(safePage);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Render at 2x (bounded by devicePixelRatio) for crispness; CSS scales
        // the element down to fit, preserving the canvas's intrinsic aspect
        // ratio so the pin overlay's normalized coords map 1:1 to the page.
        const outputScale = Math.min(2, window.devicePixelRatio || 1) * 1.5;
        const viewport = pdfPage.getViewport({ scale: outputScale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            /* ignore */
          }
        }
        const task = pdfPage.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled) setStatus("ready");
      } catch (err: any) {
        if (err?.name === "RenderingCancelledException") return;
        console.error("[PdfCanvas] render error:", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doc, page]);

  if (status === "error") {
    return (
      <div className="rounded-xl bg-[var(--bb-bg-page)]/10 px-6 py-10 text-sm text-white/60">
        Failed to load PDF
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={
          className ?? "block h-auto max-h-[80vh] w-auto max-w-full rounded-lg bg-white shadow-2xl"
        }
      />
    </div>
  );
}
