// -----------------------------------------------------------------------------
// @file: components/ui/loading-state.tsx
// @purpose: Shared loading indicator for data-fetching states
// -----------------------------------------------------------------------------

type LoadingStateProps = {
  /** Short message like "Loading tickets…" */
  message?: string;
  /** "inline" renders a small pill; "block" renders a centered full-width box */
  display?: "inline" | "block";
  className?: string;
};

export function LoadingState({
  message = "Loading…",
  display = "block",
  className = "",
}: LoadingStateProps) {
  if (display === "inline") {
    return (
      <span
        className={`rounded-full bg-[var(--bb-bg-card)] px-3 py-1 text-[11px] text-[var(--bb-text-secondary)] ${className}`}
      >
        {message}
      </span>
    );
  }

  return (
    <div
      className={`py-6 text-center text-sm text-[var(--bb-text-secondary)] ${className}`}
    >
      {message}
    </div>
  );
}
