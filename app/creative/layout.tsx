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
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="relative px-8 pt-10">
        <AppNav role="creative" />
      </div>
      <div className="px-8 pb-10">{children}</div>
    </div>
  );
}
