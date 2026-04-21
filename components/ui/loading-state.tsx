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

// `role="status"` + `aria-live="polite"` is what makes the loading text
// audible to screen readers. Without it, AT users silently see an empty
// list with no signal that the app is busy. Polite (not assertive) so it
// waits for the user to finish their current utterance before announcing.
export function LoadingState({
  message = "Loading…",
  display = "block",
  className = "",
}: LoadingStateProps) {
  if (display === "inline") {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`rounded-full bg-[var(--bb-bg-card)] px-3 py-1 text-[11px] text-[var(--bb-text-secondary)] ${className}`}
      >
        {message}
      </span>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`py-6 text-center text-sm text-[var(--bb-text-secondary)] ${className}`}
    >
      {message}
    </div>
  );
}
