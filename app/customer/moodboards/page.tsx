// -----------------------------------------------------------------------------
// @file: app/customer/moodboards/page.tsx
// @purpose: Customer-facing moodboard list page: search, sort, preview cards.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Button,
  Callout,
  Card,
  EmptyState,
  plural,
  SearchInput,
  Select,
  Skeleton,
  PageHeader,
} from "@/components/admin/v2/ui";
import { IconMoodboards } from "@/components/navigation/nav-icons";
import { MoodboardPreviewCard } from "@/components/dashboard/workspace/moodboard-preview-card";

type MoodboardListItem = {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  itemCount: number;
  thumbnails: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
};

type SortKey = "updated" | "created" | "title";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Newest first" },
  { value: "title", label: "Name A-Z" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MoodboardsPage() {
  const router = useRouter();
  const [moodboards, setMoodboards] = useState<MoodboardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");

  useEffect(() => {
    fetchMoodboards();
  }, []);

  async function fetchMoodboards() {
    try {
      const res = await fetch("/api/customer/moodboards");
      if (!res.ok) throw new Error("Failed to fetch moodboards");
      const data = await res.json();
      setMoodboards(data.moodboards ?? []);
    } catch {
      setError("Could not load moodboards");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/customer/moodboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Moodboard" }),
      });
      if (!res.ok) throw new Error("Failed to create moodboard");
      const data = await res.json();
      router.push(`/customer/moodboards/${data.moodboard.id}`);
    } catch {
      setError("Could not create moodboard");
      setCreating(false);
    }
  }

  const visible = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = moodboards.filter((mb) => {
      const text = [mb.title, mb.projectName, mb.description].join(" ").toLowerCase();
      return terms.every((t) => text.includes(t));
    });
    return [...matches].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const key = sort === "created" ? "createdAt" : "updatedAt";
      return new Date(b[key]).getTime() - new Date(a[key]).getTime();
    });
  }, [moodboards, query, sort]);

  const newButton = (
    <Button variant="primary" onClick={handleCreate} disabled={creating} aria-busy={creating}>
      {creating ? "Creating..." : "+ New Moodboard"}
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Moodboards"
        description="Collect inspiration, colors, and references for your design projects."
        actions={newButton}
      />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title={error} />
        </div>
      )}

      {loading ? (
        <div
          aria-busy="true"
          aria-label="Loading moodboards"
          className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
        >
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : moodboards.length === 0 ? (
        error ? null : (
          <Card padding="none">
            <EmptyState
              icon={<IconMoodboards width={28} height={28} />}
              title="No moodboards yet"
              description="Create your first moodboard to start collecting design inspiration."
            />
          </Card>
        )
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              label="Search moodboards"
              placeholder="Search moodboards"
              className="min-w-[220px] flex-1 sm:max-w-md"
            />
            <div className="w-full sm:ml-auto sm:w-56">
              <Select
                aria-label="Sort moodboards"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="dark:[color-scheme:dark]"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {visible.length === 0 ? (
            <Card padding="none">
              <EmptyState
                title="No moodboards match your search"
                description="Try a different word, or clear the search to see every moodboard."
                action={<Button onClick={() => setQuery("")}>Clear search</Button>}
              />
            </Card>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((mb) => (
                <li key={mb.id} className="min-w-0">
                  <MoodboardPreviewCard
                    moodboard={mb}
                    dateLabel={
                      sort === "created"
                        ? `Created ${formatDate(mb.createdAt)}`
                        : `Updated ${formatDate(mb.updatedAt)}`
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          <p role="status" className="mt-6 text-sm text-[var(--av2-text-2)]">
            Showing {visible.length} {plural(visible.length, "moodboard", "moodboards")}
          </p>
        </>
      )}
    </>
  );
}
