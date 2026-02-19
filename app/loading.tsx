// -----------------------------------------------------------------------------
// @file: app/loading.tsx
// @purpose: Root-level loading skeleton shown during page transitions
// -----------------------------------------------------------------------------

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f3f0]">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f15b2b] text-sm font-semibold text-white animate-pulse">
          B
        </div>
        <p className="text-sm text-[#7a7a7a]">Loading...</p>
      </div>
    </div>
  );
}
