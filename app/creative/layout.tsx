// -----------------------------------------------------------------------------
// @file: app/creative/layout.tsx
// @purpose: Creative shell — shared nav + page wrapper for all creative routes
// -----------------------------------------------------------------------------

import { AppNav } from "@/components/navigation/app-nav";

export default function CreativeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bb-bg-card)] text-[var(--bb-secondary)]">
      <div className="relative px-4 pt-6 md:px-6 md:pt-8 lg:px-8 lg:pt-10">
        <AppNav role="creative" />
      </div>
      <div className="px-4 pb-6 md:px-6 md:pb-8 lg:px-8 lg:pb-10">{children}</div>
    </div>
  );
}
