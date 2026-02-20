// -----------------------------------------------------------------------------
// @file: app/creative/loading.tsx
// @purpose: Loading skeleton for creative pages (nav provided by layout)
// -----------------------------------------------------------------------------

export default function CreativeLoading() {
  return (
    <>
      <div className="mb-6">
        <div className="h-7 w-40 animate-pulse rounded bg-[#e3e1dc]" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[#e3e1dc]" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-[#e3e1dc] bg-white shadow-sm"
          />
        ))}
      </div>
    </>
  );
}
