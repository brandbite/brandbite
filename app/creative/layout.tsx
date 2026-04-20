// -----------------------------------------------------------------------------
// @file: app/creative/layout.tsx
// @purpose: Creative shell — fixed-left sidebar + content area.
// -----------------------------------------------------------------------------

import { AppSidebar } from "@/components/navigation/app-sidebar";

export const dynamic = "force-dynamic";

export default function CreativeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bb-bg-card)] text-[var(--bb-secondary)]">
      <AppSidebar role="creative" />
      <div className="md:pl-[var(--bb-sidebar-w,240px)] md:transition-[padding] md:duration-200">
        <main className="px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
