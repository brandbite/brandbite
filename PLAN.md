# Full UI Polish — Phase 2: Six-Item Implementation Plan

## Overview

Simultaneous implementation of all 6 remaining UI audit items. Changes are organized into **3 waves** to minimize conflicts and allow incremental build checks.

---

## Wave 1 — Foundation (no visible changes yet)

### 1A. Expand CSS variables & Tailwind theme

**File: `app/globals.css`** — Expand `:root` from 4 variables to ~20 covering every recurring color:

```
--bb-primary:        #f15b2b    (CTA / brand orange)
--bb-primary-hover:  #e44f20
--bb-primary-light:  #fff0ea    (badge-primary bg)
--bb-primary-border: #f5c4ad

--bb-secondary:      #424143    (primary text)
--bb-text-secondary: #7a7a7a
--bb-text-tertiary:  #9a9892
--bb-text-muted:     #b1afa9

--bb-border:         #e3e1dc    (standard border)
--bb-border-subtle:  #f0eeea    (table row divider)
--bb-bg-page:        #fbfaf8    (input bg)
--bb-bg-warm:        #f7f5f0    (search bg, secondary btn)
--bb-bg-card:        #f5f3f0    (neutral pill, column bg)

--bb-info-bg:        #eaf4ff
--bb-info-text:      #1d72b8
--bb-info-border:    #c7d1f7
--bb-success-bg:     #f0fff6
--bb-success-text:   #137a3a
--bb-success-border: #b9e2cd
--bb-warning-bg:     #fff7e0
--bb-warning-text:   #8a6b1f
--bb-warning-border: #f7d0a9
--bb-danger-bg:      #fde8e7
--bb-danger-text:    #b13832
--bb-danger-border:  #f7c7c0
```

**File: `tailwind.config.js`** — Map CSS vars to Tailwind tokens:

```js
theme: {
  extend: {
    colors: {
      bb: {
        primary:       'var(--bb-primary)',
        'primary-hover':'var(--bb-primary-hover)',
        secondary:     'var(--bb-secondary)',
        // ... all variables above
      }
    }
  }
}
```

> **Why Wave 1?** These are additive-only — no existing class changes — so zero risk of regressions. Every subsequent wave can reference the new tokens.

### 1B. Create shared `<Modal>` component

**New file: `components/ui/modal.tsx`**

```tsx
type ModalProps = {
  open: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg";        // max-w-sm / max-w-md / max-w-xl
  scrollable?: boolean;              // max-h-[90vh] overflow-y-auto
  children: React.ReactNode;
  className?: string;
};

// Renders: backdrop (fixed inset-0 z-50 bg-black/30) + centered card (rounded-2xl bg-white p-5 shadow-xl)
// Closes on backdrop click & Escape key
```

Also extract a `<ModalHeader>` sub-component:
```tsx
type ModalHeaderProps = {
  eyebrow?: string;   // uppercase label
  title: string;
  subtitle?: string;
  onClose?: () => void;
};
```

And a `<ModalFooter>` for consistent action row:
```tsx
type ModalFooterProps = {
  children: React.ReactNode;
};
// Renders: flex items-center justify-end gap-2 mt-4
```

### 1C. Create shared `<DataTable>` wrapper

**New file: `components/ui/data-table.tsx`**

Lightweight wrapper that standardizes:
- Container: `overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-white shadow-sm`
- Optional max-height scroll: `max-h-[520px] overflow-auto`
- `<table>`: `min-w-full text-left text-xs`
- `<thead>`: `border-b border-[var(--bb-border)] text-[11px] uppercase tracking-[0.08em] text-[var(--bb-text-tertiary)]`
- `<th>`: `px-3 py-2.5 font-semibold` (standardized padding — midpoint between current px-2/px-4 and py-2/py-3)
- `<tr>`: `border-b border-[var(--bb-border-subtle)] last:border-b-0`
- `<td>`: `px-3 py-2.5 align-top text-[11px] text-[var(--bb-secondary)]`

```tsx
export function DataTable({ children, maxHeight, className }: DataTableProps) { ... }
export function THead({ children }: { children: React.ReactNode }) { ... }
export function TH({ children, align, className }: THProps) { ... }
export function TD({ children, className }: TDProps) { ... }
```

> This is NOT a full abstraction — pages still control their own `<tbody>` rows. It just wraps the repetitive container/thead/td patterns.

---

## Wave 2 — Component adoption & badge unification

### 2A. Replace all inline badge patterns with `<Badge>`

**Files to update (5+):**

| File | Current pattern | Action |
|------|----------------|--------|
| `designer/board/page.tsx` | `priorityPillClass()` switch | Remove function, use `<Badge variant={priorityToBadgeVariant(p)}>` |
| `customer/board/page.tsx` | `priorityBadgeClass`, `statusBadgeClass` records | Same approach |
| `customer/tickets/page.tsx` | `PRIORITY_BADGE` record | Replace with Badge |
| `customer/tickets/[ticketId]/page.tsx` | `PRIORITY_BADGE` record + inline status spans | Replace with Badge |
| `designer/tickets/page.tsx` | `statusBadgeClass()`, `priorityBadgeClass()` | Replace with Badge |
| `admin/board/page.tsx` | Inline project-code pill, stats pills | Replace with Badge |
| `designer/board/page.tsx` | Revision badge, token badge, feedback badge | Replace with Badge |
| `debug/assignment-log/page.tsx` | `formatReasonBadge()` | Replace with Badge |

**New helper in `lib/board.ts`:**
```tsx
import type { BadgeVariant } from "@/components/ui/badge";

export const priorityBadgeVariant = (p: TicketPriority): BadgeVariant => {
  switch (p) {
    case "LOW":     return "neutral";
    case "MEDIUM":  return "info";
    case "HIGH":    return "warning";
    case "URGENT":  return "danger";
  }
};

export const statusBadgeVariant = (s: TicketStatus): BadgeVariant => {
  switch (s) {
    case "TODO":        return "neutral";
    case "IN_PROGRESS": return "info";
    case "IN_REVIEW":   return "warning";
    case "DONE":        return "success";
  }
};
```

### 2B. Replace inline modals with `<Modal>`

**Files:** `customer/board/page.tsx` (4 modals), `designer/board/page.tsx` (2 modals)

Each modal becomes:
```tsx
<Modal open={!!detailTicket} onClose={closeDetail} size="lg" scrollable>
  <ModalHeader eyebrow="Ticket" title={detailTicket.title} onClose={closeDetail} />
  {/* body content unchanged */}
  <ModalFooter>
    <Button variant="secondary" onClick={closeDetail}>Close</Button>
  </ModalFooter>
</Modal>
```

### 2C. Adopt `<DataTable>` in all table pages

**Files (6 table pages):**
- `admin/tickets/page.tsx` — normalize px-4 py-3 → px-3 py-2.5
- `admin/withdrawals/page.tsx` — add rounded container wrapper
- `admin/plans/page.tsx` — already close, just swap to DataTable
- `admin/companies/page.tsx` — same
- `admin/ledger/page.tsx` — same
- `customer/tickets/page.tsx` — fix tracking-[0.12em] → standard 0.08em, border #ebe7df → var(--bb-border)

---

## Wave 3 — Typography, spacing & color migration

### 3A. Standardize typography tokens

Define these constant patterns (all pages must follow):

| Element | Classes |
|---------|---------|
| **Page eyebrow** | `text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bb-text-muted)]` |
| **Page h1** | `text-2xl font-semibold tracking-tight` (currently some use text-xl — unify to text-2xl) |
| **Section h2** | `text-sm font-semibold tracking-tight text-[var(--bb-secondary)]` |
| **Modal h2** | `text-lg font-semibold text-[var(--bb-secondary)]` |
| **Body text** | `text-xs text-[var(--bb-text-secondary)]` or `text-[11px] text-[var(--bb-text-secondary)]` |
| **Metric label** | `text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]` |
| **Table thead** | `text-[11px] uppercase tracking-[0.08em] text-[var(--bb-text-tertiary)]` (handled by DataTable) |

Scan every page for deviations and normalize.

### 3B. Migrate hardcoded hex colors to CSS variables

**Scope:** 1048 occurrences across 43 files.

**Strategy — targeted find-and-replace by hex value:**

| Hex | Replacement | Occurrences |
|-----|-------------|-------------|
| `#f15b2b` | `var(--bb-primary)` | ~30 |
| `#e44f20` | `var(--bb-primary-hover)` | ~5 |
| `#424143` | `var(--bb-secondary)` | ~120 |
| `#7a7a7a` | `var(--bb-text-secondary)` | ~60 |
| `#9a9892` | `var(--bb-text-tertiary)` | ~50 |
| `#b1afa9` | `var(--bb-text-muted)` | ~20 |
| `#e3e1dc` | `var(--bb-border)` | ~80 |
| `#f0eeea` | `var(--bb-border-subtle)` | ~30 |
| `#f5f3f0` | `var(--bb-bg-card)` | ~40 |
| `#f7f5f0` | `var(--bb-bg-warm)` | ~30 |
| `#fbfaf8` | `var(--bb-bg-page)` | ~15 |
| `#d4d2cc` | `var(--bb-border)` (close enough) | ~10 |
| Semantic colors (info/success/warning/danger bg/text/border) | respective vars | ~100+ |

This also applies to **shared components** (`button.tsx`, `form-field.tsx`, `badge.tsx`, `inline-alert.tsx`, `loading-state.tsx`, `empty-state.tsx`) — they should use CSS vars too.

> **Note:** Board column colors in `lib/board.ts` (`statusColumnClass`) will also migrate to CSS vars.

### 3C. Kanban board light unification

The three board pages have legitimate per-role differences, so we will NOT merge them into one component. Instead:

1. **Move shared card sub-patterns into `lib/board.ts`:**
   - `BOARD_CARD_BASE` class string: `rounded-xl bg-white border border-[var(--bb-border)] p-3 shadow-sm`
   - `BOARD_COLUMN_HEADER` class string for column title styling

2. **Unify filter bar pattern:** All 3 boards use search + dropdowns — extract a common filter-bar layout constant or small component.

3. **Ensure all boards use `<Badge>` for priority/status** (already done in 2A).

---

## Build & verification plan

- **After Wave 1:** `npx next build` — should pass (additive only, no existing code changed)
- **After Wave 2:** `npx next build` — verify all imports resolve
- **After Wave 3:** `npx next build` — final verification, then visual testing of all pages

## Execution approach

All three waves will be executed sequentially. Within each wave, independent files will be edited in parallel where possible. The entire implementation targets ~40 files across the codebase.

## Risk assessment

- **Low risk:** Wave 1 (new files + CSS additions only)
- **Medium risk:** Wave 2 (replacing working inline patterns with component equivalents — must preserve exact visual appearance)
- **Medium risk:** Wave 3 color migration (bulk find-replace — must not break any Tailwind arbitrary value syntax)

All changes are cosmetic/structural — zero API or business logic modifications.
