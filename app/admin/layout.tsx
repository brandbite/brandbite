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
      <div className="relative px-4 pt-6 md:px-6 md:pt-8 lg:px-8 lg:pt-10">
        <AppNav role="admin" />
      </div>
      <div className="px-4 pb-6 md:px-6 md:pb-8 lg:px-8 lg:pb-10">{children}</div>
    </div>
  );
}
