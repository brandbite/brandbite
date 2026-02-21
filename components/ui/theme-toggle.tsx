// -----------------------------------------------------------------------------
// @file: components/ui/theme-toggle.tsx
// @purpose: Three-state theme toggle — Light / System / Dark
// -----------------------------------------------------------------------------

"use client";

import { useTheme } from "@/components/theme-provider";

type ThemeOption = "light" | "system" | "dark";

const OPTIONS: { value: ThemeOption; label: string; icon: React.ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
  },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="inline-flex items-center rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] p-0.5"
      role="radiogroup"
      aria-label="Theme"
    >
      {OPTIONS.map((opt) => {
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={opt.label}
            onClick={() => setTheme(opt.value)}
            className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
              isActive
                ? "bg-[var(--bb-bg-page)] text-[var(--bb-secondary)] shadow-sm"
                : "text-[var(--bb-text-muted)] hover:text-[var(--bb-text-secondary)]"
            }`}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
