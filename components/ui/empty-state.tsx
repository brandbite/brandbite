// -----------------------------------------------------------------------------
// @file: components/ui/empty-state.tsx
// @purpose: Shared empty-state placeholder for data lists with no items
// -----------------------------------------------------------------------------

type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d5cec0] bg-white/60 px-5 py-6 text-center">
      <p className="text-sm text-[var(--bb-text-tertiary)]">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-[var(--bb-text-muted)]">{description}</p>
      )}
    </div>
  );
}
