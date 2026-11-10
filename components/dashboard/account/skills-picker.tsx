// -----------------------------------------------------------------------------
// @file: components/dashboard/account/skills-picker.tsx
// @purpose: The creative's long skills list with search, categories, a
//           selected-only filter and paging, plus a grouped selection summary.
//           Ticking still saves through the page's debounced handler.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  EmptyState,
  plural,
  SearchInput,
  Select,
  Switch,
} from "@/components/admin/v2/ui";
import { ListPager } from "./account-ui";

export type SkillJobType = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
};

const ALL_CATEGORIES = "__all__";
const UNCATEGORIZED = "Other";
const PAGE_SIZES = [6, 12, 24];
/** Chips shown per category in the summary before "+N more". */
const SUMMARY_CHIP_LIMIT = 6;

export function categoryOf(skill: SkillJobType): string {
  return skill.category?.trim() || UNCATEGORIZED;
}

export function filterSkills(
  skills: SkillJobType[],
  filters: { query: string; category: string; selectedOnly: boolean; selected: Set<string> },
): SkillJobType[] {
  const q = filters.query.trim().toLowerCase();
  return skills.filter((s) => {
    if (filters.category !== ALL_CATEGORIES && categoryOf(s) !== filters.category) return false;
    if (filters.selectedOnly && !filters.selected.has(s.id)) return false;
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description ?? "").toLowerCase().includes(q) ||
      categoryOf(s).toLowerCase().includes(q)
    );
  });
}

export function groupByCategory(
  skills: SkillJobType[],
): { category: string; skills: SkillJobType[] }[] {
  const groups = new Map<string, SkillJobType[]>();
  for (const skill of skills) {
    const key = categoryOf(skill);
    groups.set(key, [...(groups.get(key) ?? []), skill]);
  }
  return [...groups.entries()]
    .map(([category, items]) => ({ category, skills: items }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function SkillsPicker({
  skills,
  selectedIds,
  onToggle,
  saving,
  loadFailed,
  selectedOnly,
  onSelectedOnly,
}: {
  skills: SkillJobType[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  saving: boolean;
  loadFailed: boolean;
  /** Lifted so the selection summary can switch this view on. */
  selectedOnly: boolean;
  onSelectedOnly: (next: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const groups = useMemo(() => groupByCategory(skills), [skills]);
  const filtered = useMemo(
    () => filterSkills(skills, { query, category, selectedOnly, selected }),
    [skills, query, category, selectedOnly, selected],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  // Unticking under "Selected only" can shrink the list past the current page.
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  // A filter change always starts again from the first page.
  useEffect(() => setPage(1), [query, category, selectedOnly, pageSize]);

  const filtering = query.trim() !== "" || category !== ALL_CATEGORIES || selectedOnly;
  const shownIds = new Set(filtered.map((s) => s.id));
  const hiddenSelected = filtering ? selectedIds.filter((id) => !shownIds.has(id)).length : 0;

  const clearFilters = () => {
    setQuery("");
    setCategory(ALL_CATEGORIES);
    onSelectedOnly(false);
  };

  return (
    <Card>
      <CardTitle description="Select the services you can handle. You will only be auto-assigned requests that match your skills.">
        Active skills
      </CardTitle>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search skills"
          label="Search skills"
        />
        <Select
          aria-label="Skill category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value={ALL_CATEGORIES}>All categories ({skills.length})</option>
          {groups.map((g) => (
            <option key={g.category} value={g.category}>
              {g.category} ({g.skills.length})
            </option>
          ))}
        </Select>
        <Switch label="Selected only" checked={selectedOnly} onChange={onSelectedOnly} />
      </div>

      {hiddenSelected > 0 && (
        <div className="mt-4">
          <Callout
            tone="info"
            title={`${hiddenSelected} selected ${plural(hiddenSelected, "skill is", "skills are")} not shown by this filter`}
            action={<Button onClick={clearFilters}>Clear filters</Button>}
          >
            {plural(hiddenSelected, "It stays", "They stay")} selected and saved. Filtering never
            changes your selection.
          </Callout>
        </div>
      )}

      {loadFailed ? (
        <div className="mt-4">
          <Callout tone="error" title="We couldn't load the skills list">
            Refresh the page to try again. Your saved skills haven&apos;t changed.
          </Callout>
        </div>
      ) : skills.length === 0 ? (
        <EmptyState title="No services available yet." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No skills match these filters."
          description="Try another search or category."
          action={<Button onClick={clearFilters}>Clear filters</Button>}
        />
      ) : (
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {visible.map((skill) => {
            const checked = selected.has(skill.id);
            return (
              <li key={skill.id}>
                <label
                  className={`flex h-full min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                    checked
                      ? "border-[var(--av2-accent)]/40 bg-[var(--av2-selected)]"
                      : "border-[var(--av2-border)] hover:bg-[var(--av2-bg)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(skill.id)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--av2-accent-strong)] dark:[color-scheme:dark]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{skill.name}</span>
                    {skill.description && (
                      <span className="mt-0.5 block text-sm text-[var(--av2-text-2)]">
                        {skill.description}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--av2-border)] pt-4 text-sm text-[var(--av2-text-2)]">
          <p>
            Showing {start + 1}–{start + visible.length} of {filtered.length}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-32">
              <Select
                aria-label="Skills per page"
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </Select>
            </div>
            <ListPager page={safePage} pageCount={pageCount} onPage={setPage} />
          </div>
        </div>
      )}

      <p role="status" className="mt-3 text-sm text-[var(--av2-text-2)]">
        {saving ? "Saving…" : "Changes save automatically."}
      </p>
    </Card>
  );
}

export function SelectionSummary({
  skills,
  selectedIds,
  onShowSelected,
}: {
  skills: SkillJobType[];
  selectedIds: string[];
  onShowSelected: () => void;
}) {
  const groups = useMemo(() => {
    const ids = new Set(selectedIds);
    return groupByCategory(skills.filter((s) => ids.has(s.id)));
  }, [skills, selectedIds]);
  const count = groups.reduce((sum, g) => sum + g.skills.length, 0);

  return (
    <Card>
      <CardTitle
        description={
          count > 0
            ? `${count} ${plural(count, "skill", "skills")} selected, grouped by category.`
            : undefined
        }
        action={
          count > 0 ? (
            <Button variant="ghost" onClick={onShowSelected} className="-my-2 shrink-0">
              Show selected
            </Button>
          ) : undefined
        }
      >
        Selection summary
      </CardTitle>
      {count === 0 ? (
        <p className="mt-3 text-sm text-[var(--av2-text-2)]">
          No skills selected yet. With no skills ticked, you won&apos;t be matched to requests.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map((group) => {
            const extra = group.skills.length - SUMMARY_CHIP_LIMIT;
            return (
              <div key={group.category}>
                <p className="mb-2 text-sm font-semibold">{group.category}</p>
                <ul className="flex flex-wrap gap-2">
                  {group.skills.slice(0, SUMMARY_CHIP_LIMIT).map((skill) => (
                    <li key={skill.id} className="max-w-full">
                      <Badge className="max-w-full truncate">{skill.name}</Badge>
                    </li>
                  ))}
                  {extra > 0 && (
                    <li>
                      <Badge tone="lavender">+{extra} more</Badge>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
