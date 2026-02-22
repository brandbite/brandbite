// -----------------------------------------------------------------------------
// @file: app/not-found.tsx
// @purpose: Custom 404 page with branded layout and helpful navigation links
// -----------------------------------------------------------------------------

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bb-bg-page)] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bb-primary)] text-2xl font-bold text-white shadow-[var(--bb-primary)]/20 shadow-lg">
        B
      </div>

      <h1 className="mt-6 text-6xl font-bold tracking-tight text-[var(--bb-secondary)]">404</h1>

      <p className="mt-2 text-lg font-medium text-[var(--bb-text-secondary)]">Page not found</p>

      <p className="mt-1 max-w-sm text-sm text-[var(--bb-text-muted)]">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-[var(--bb-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Go home
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-5 py-2.5 text-sm font-semibold text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-bg-page)]"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
