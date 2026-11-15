// -----------------------------------------------------------------------------
// @file: components/brand/brand-export-buttons.tsx
// @purpose: "Copy for AI" (the brand guide as Markdown, on the clipboard) and
//           "Download JSON", for handing a brand to an AI assistant or tool.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import { Button } from "@/components/admin/v2/ui";
import {
  brandExportFileName,
  brandToJson,
  brandToMarkdown,
  type BrandExport,
  type BrandExportFile,
} from "@/lib/brand/brand-export";

export function BrandExportButtons({
  brand,
  files,
  size = "md",
}: {
  brand: BrandExport;
  files: BrandExportFile[];
  size?: "md" | "sm";
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(brandToMarkdown(brand, files));
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    window.setTimeout(() => setStatus("idle"), 2500);
  };

  const downloadJson = () => {
    const url = URL.createObjectURL(
      new Blob([brandToJson(brand, files)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = brandExportFileName(brand.name, "json");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button size={size} onClick={() => void copy()}>
        {status === "copied" ? "Copied" : "Copy for AI"}
      </Button>
      <Button size={size} onClick={downloadJson}>
        Download JSON
      </Button>
      <span role="status" className="sr-only">
        {status === "copied" ? "Brand guide copied" : ""}
        {status === "failed" ? "Couldn't copy. Use Download JSON instead." : ""}
      </span>
      {status === "failed" && (
        <span className="text-xs text-[var(--av2-error-text)]">
          Couldn&apos;t copy. Use Download JSON instead.
        </span>
      )}
    </>
  );
}
