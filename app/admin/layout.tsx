// -----------------------------------------------------------------------------
// @file: app/admin/layout.tsx
// @purpose: Admin shell — shared nav + page wrapper for all admin routes
// -----------------------------------------------------------------------------

import { AppNav } from "@/components/navigation/app-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="relative px-8 pt-10">
        <AppNav role="admin" />
      </div>
      <div className="px-8 pb-10">{children}</div>
    </div>
  );
}
