// -----------------------------------------------------------------------------
// @file: components/ui/tag-badge.tsx
// @purpose: Small colored pill for rendering a ticket tag
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-18
// -----------------------------------------------------------------------------

import { TAG_COLORS, type TagColorKey } from "@/lib/tag-colors";

type TagBadgeProps = {
  name: string;
  color: TagColorKey;
  /** When provided, renders a small x button to remove the tag */
  onRemove?: () => void;
  className?: string;
};

export function TagBadge({
  name,
  color,
  onRemove,
  className = "",
}: TagBadgeProps) {
  const style = TAG_COLORS[color] ?? TAG_COLORS.GRAY;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 inline-flex items-center justify-center rounded-full hover:opacity-70 focus:outline-none"
          aria-label={`Remove ${name}`}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7.5 2.5L2.5 7.5M2.5 2.5L7.5 7.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </span>
  );
}
