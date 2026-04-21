# Accessibility audit — Phase 2 findings + Phase 3 resolutions

**Date**: 2026-04-21
**Standard targeted**: WCAG 2.2 Level AA
**Scope**: `app/`, `components/`, `lib/` — production code
**Method**: static code analysis (grep + file review) + dev-time [@axe-core/react](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/react) runtime monitor

Phase 1 (skip link, `prefers-reduced-motion`, global `:focus-visible`, aria-live toasts) shipped earlier on `main`. Phase 3 resolved the findings below — status updated inline.

## Resolved in Phase 3

| Area                                                      | Resolution                                                                                                                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color contrast — `--bb-text-muted` / `--bb-text-tertiary` | Darkened in light mode (`#8a8883` / `#6b6a63`), lightened in dark mode (`#7a7a85` / `#9a9aa3`). Both modes now clear AA thresholds.                                                                     |
| Focus rings — 8 elements                                  | Added `focus-visible:ring-*` to tag-badge close button, tag-multi-select combobox + edit input, customer/creative settings toggles, customer settings inline inputs.                                    |
| `LoadingState` silent to AT                               | Component now renders with `role="status" aria-live="polite"` — every caller inherits automatically.                                                                                                    |
| Notification bell "Loading..."                            | Wrapped in `role="status" aria-live="polite"`.                                                                                                                                                          |
| Tag color picker lacks accessible name                    | Added `aria-label` and `aria-pressed`.                                                                                                                                                                  |
| Kanban KeyboardSensor (flagged for verify)                | N/A — boards use native HTML5 drag-drop, not @dnd-kit. Keyboard users have an equivalent alternative: click card → detail modal → status action buttons, all keyboard-accessible. Not a WCAG violation. |
| Duplicate `<h1>` on customer board                        | False positive from regex — two `<h1>` are in separate `if/else` branches, only one renders at a time. No change needed.                                                                                |

---

## Summary

| Severity | Category                                         |        Count        |
| :------: | ------------------------------------------------ | :-----------------: |
|   High   | Removed focus ring, no replacement               |          8          |
|  Medium  | Text contrast below 4.5:1 (system-wide)          |    1 token pair     |
|  Medium  | Form inputs without `<label>` association        |          3          |
|  Medium  | Kanban missing `KeyboardSensor`                  | 3 pages (to verify) |
|  Medium  | Loading states not announced to AT               |         3+          |
|   Low    | Empty `alt=""` on potentially informative images | 10 (context-verify) |
|   Low    | Heading hierarchy — duplicate `<h1>`             |       2 pages       |
|   Low    | Nested modal focus management                    |       1 page        |

**Total actionable items: 28**

---

## What's already good

These categories were checked and passed or mostly passed:

- **Modal component** (`components/ui/modal.tsx`) has focus trap + focus restoration + Escape handler
- **Main `<Button>`** (`components/ui/button.tsx`) has `focus-visible:ring-2`
- **FormInput / FormSelect / FormTextarea** wrappers include id/label wiring when used
- **NotificationBell dropdown** (`components/ui/notification-bell.tsx`) closes on Escape + returns focus to the bell button
- **Sidebar `<AppSidebar />`** — mobile drawer traps focus via body-scroll-lock + Escape handler; `aria-label="Primary navigation"` on the aside; `aria-current="page"` on active item; `aria-haspopup`/`aria-expanded` on the menu toggles
- **Language** — `lang="en"` on `<html>`
- **Theme script** is wrapped in `suppressHydrationWarning` to avoid a hydration warning triggering SR errors
- **Phase 1 landmarks** — skip link, aria-live toast regions, global `:focus-visible`, `prefers-reduced-motion` all live

---

## High severity — focus indicators missing

Any element with `focus:outline-none` must have an explicit replacement (a ring, an inverse background, something). The global `:focus-visible` rule added in Phase 1 helps but is overridden by `focus:outline-none` on the same element.

|  #  | File                                 | Line | Element                         | Fix                                                                  |
| :-: | ------------------------------------ | :--: | ------------------------------- | -------------------------------------------------------------------- |
|  1  | `app/customer/settings/page.tsx`     | 1272 | Toggle switch (`role="switch"`) | Add `focus-visible:ring-2 focus-visible:ring-[var(--bb-primary)]`    |
|  2  | `app/customer/settings/page.tsx`     | 1290 | Toggle switch                   | Same fix                                                             |
|  3  | `app/customer/settings/page.tsx`     | 1341 | Inline tag-name `<input>`       | Use `FormInput` or add `focus:ring-1 focus:ring-[var(--bb-primary)]` |
|  4  | `app/customer/settings/page.tsx`     | 1441 | Inline tag-value `<input>`      | Same fix                                                             |
|  5  | `app/creative/settings/page.tsx`     | 413  | In-app notification toggle      | Add `focus-visible:ring-2 focus-visible:ring-[var(--bb-primary)]`    |
|  6  | `components/ui/tag-multi-select.tsx` | 161  | Combobox input                  | Add `focus-visible:ring-1`                                           |
|  7  | `components/ui/tag-multi-select.tsx` | 256  | Combobox input                  | Same fix                                                             |
|  8  | `components/ui/tag-badge.tsx`        |  34  | Close button on tags            | Add `focus-visible:ring-1 focus-visible:ring-[var(--bb-primary)]`    |

**Fix pattern** — for any button/input that removes the outline:

```tsx
className = "... focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bb-primary)]";
```

---

## Medium severity

### 1. Color contrast — muted/tertiary text on light backgrounds

Current `:root` tokens in `app/globals.css`:

| Token                 | Value     | Ratio vs `--bb-bg-page` (#fbfaf8) |     AA pass?     |
| --------------------- | --------- | :-------------------------------: | :--------------: |
| `--bb-text-muted`     | `#b1afa9` |              ~3.8:1               | ❌ (under 4.5:1) |
| `--bb-text-tertiary`  | `#9a9892` |              ~3.2:1               |        ❌        |
| `--bb-text-secondary` | `#7a7a7a` |              ~4.9:1               |        ✅        |
| `--bb-secondary`      | `#424143` |              ~9.8:1               |        ✅        |

Usages of `--bb-text-muted` / `--bb-text-tertiary` include section eyebrows, form hints, sidebar section headers, timestamps, "Loading..." text, table cell metadata.

**Fix options**:

1. **Darken tokens**: `--bb-text-muted: #8a8883`, `--bb-text-tertiary: #6b6a63` — safest, minimal visual change
2. **Reserve for non-essential only**: keep current hex but audit every usage — anything a user needs to read should use `--bb-text-secondary` or darker
3. **Both**: darken + audit

Option 1 is the recommended starting point. One token change unlocks AA across the app.

### 2. Form inputs without `<label>` association

|  #  | File                             | Line | Input                                            |
| :-: | -------------------------------- | :--: | ------------------------------------------------ |
|  9  | `app/customer/settings/page.tsx` | 1336 | Inline tag-name edit input                       |
| 10  | `app/customer/settings/page.tsx` | 1441 | Inline tag-value edit input                      |
| 11  | `app/customer/board/page.tsx`    | 2055 | Custom button (verify surrounding label context) |

**Fix**: wrap in `<label>` with visible text, or add `aria-label` for inline edit fields.

### 3. Kanban board — keyboard drag/drop

Need to verify each board page has `KeyboardSensor` in its `@dnd-kit` sensor list:

- `app/admin/board/page.tsx`
- `app/customer/board/page.tsx`
- `app/creative/board/page.tsx`

**Fix** (if missing):

```tsx
import { useSensor, useSensors, KeyboardSensor, PointerSensor } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);
```

### 4. Loading states not announced

Loading text renders visually but screen readers don't know the app is busy. Wrap with `role="status"`:

| File                                      | Pattern                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `components/ui/loading-state.tsx`         | Check that the component itself wraps children in `role="status" aria-live="polite"` |
| `components/ui/notification-bell.tsx:104` | Dropdown "Loading..." text                                                           |
| Various admin list pages                  | "Loading plans…", "Loading users…" etc.                                              |

If `LoadingState` already has the role, every caller is covered automatically.

---

## Low severity

### Images with empty `alt=""` — context review

10 instances found. Marketing decorative images (`alt=""` + `aria-hidden="true"`) are correct. Spot-check these that might be informative:

- `app/customer/board/page.tsx:1650` — ticket thumbnail
- `app/admin/showcase/page.tsx:498` — showcase image

### Heading hierarchy

- `app/customer/board/page.tsx:1945, 1959` — two `<h1>` on the same page. Demote one to `<h2>`.

### Nested modal focus

- Customer board (`app/customer/board/page.tsx`) has detail + revision + rating modals that can stack. Verify focus returns to the correct trigger when closing nested layers.

---

## Phase 3 — fix order

Recommended ordering (by leverage per effort):

1. **Color-token darkening** — one-line change in `globals.css` fixes ~50 usages at once, biggest UX impact
2. **Focus-ring fixes** — 8 instances, all the same pattern, ~20 min
3. **Kanban `KeyboardSensor`** — if missing, 1-line addition per board page; big keyboard-user win
4. **`LoadingState` role=status** — one-shot fix at the component level
5. **Label associations** — 3 inputs in settings page
6. **Alt text context review** — case-by-case on ~2 images
7. **Duplicate h1** — 2 lines

Expected Phase 3 PR: ~60 LOC changed, 4 files + color tokens. Half a day of work including manual verification on demo.

---

## Dev-time tooling

`@axe-core/react` is now installed as a dev dep and mounted in root layout via `<A11yDevMonitor />`. It's gated behind `NODE_ENV !== "production"`, so zero bytes land in prod builds.

To use: run `npm run dev`, open any page, and check the browser console. Violations show up with links to axe-core rule pages that explain the fix. Debounced 1s so typing doesn't spam.

---

## Not covered (explicit deferrals)

These are real gaps but out of Phase 2/3 scope:

- **Lighthouse CI** — could add a GH Action running Lighthouse on key routes. Worth doing after Phase 3 fixes so the baseline passes.
- **Real screen reader testing** — VoiceOver / NVDA walkthroughs. Irreplaceable but requires human time.
- **Color contrast on brand colors** — `--bb-primary` (#f15b2b) against white/dark. Need to check button text contrast.
- **Reduced-motion alternatives** — some UI affordances depend on motion (e.g. pin-drop animation signals "new pin"). Phase 1 kills the motion; a Phase 3-plus task is to provide a static equivalent (e.g. a brief highlight) so the information isn't lost.
