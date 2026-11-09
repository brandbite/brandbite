"use client";

// -----------------------------------------------------------------------------
// @file: components/navigation/breadcrumb-detail.tsx
// @purpose: Lets a page name the last breadcrumb step. The dashboard shells
//           work out the trail from the URL, so a detail page shows "Detail";
//           a page that knows its own name (a Support guide's title) renders
//           <BreadcrumbDetail label=… /> and the shell shows that instead.
// -----------------------------------------------------------------------------

import { createContext, useContext, useEffect, type ReactNode } from "react";

const SetDetailContext = createContext<((label: string | null) => void) | null>(null);

/** Shell side: keeps the label in shell state and hands the setter down. */
export function BreadcrumbDetailProvider({
  setLabel,
  children,
}: {
  setLabel: (label: string | null) => void;
  children: ReactNode;
}) {
  return <SetDetailContext.Provider value={setLabel}>{children}</SetDetailContext.Provider>;
}

/** Page side: names the last breadcrumb step while this page is shown. */
export function BreadcrumbDetail({ label }: { label: string }) {
  const setLabel = useContext(SetDetailContext);
  useEffect(() => {
    if (!setLabel) return;
    setLabel(label);
    return () => setLabel(null);
  }, [label, setLabel]);
  return null;
}

/** Replaces the trail's generic "Detail" step with the page's own name. */
export function withDetailLabel(crumbs: string[], label: string | null): string[] {
  if (!label || crumbs[crumbs.length - 1] !== "Detail") return crumbs;
  return [...crumbs.slice(0, -1), label];
}
