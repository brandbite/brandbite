// -----------------------------------------------------------------------------
// @file: app/creative/portfolio/page.tsx
// @purpose: Auto-populated portfolio for the signed-in creative. Displays
//           every completed ticket with its final-revision thumbnails, with
//           a category chip bar and search input.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { FormInput } from "@/components/ui/form-field";

type PortfolioItem = {
  ticketId: string;
  code: string;
  title: string;
  completedAt: string;
  companyName: string | null;
  projectName: string | null;
  jobType: {
    id: string;
    name: string;
    category: string | null;
  } | null;
  thumbnails: {
    id: string;
    url: string;
    mimeType: string;
    width: number | null;
    height: number | null;
  }[];
};

type PortfolioResponse = {
  totalCount: number;
  categories: string[];
  items: PortfolioItem[];
};

const ALL_CATEGORY = "__ALL__";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function CreativePortfolioPage() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/creative/portfolio", { cache: "no-store" });
        const json = (await res.json()) as PortfolioResponse | { error: string };

        if (cancelled) return;

        if (!res.ok) {
          setError("error" in json ? json.error : "Failed to load portfolio");
          return;
        }
        setData(json as PortfolioResponse);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load portfolio");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    return data.items.filter((item) => {
      if (category !== ALL_CATEGORY) {
        if ((item.jobType?.category ?? "") !== category) return false;
      }
      if (needle) {
        const haystack = [
          item.title,
          item.code,
          item.companyName ?? "",
          item.projectName ?? "",
          item.jobType?.name ?? "",
          item.jobType?.category ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [data, category, search]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <InlineAlert variant="error">{error}</InlineAlert>
      </div>
    );
  }

  if (!data || data.totalCount === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <header>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bb-text-tertiary)] uppercase">
            Portfolio
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--bb-secondary)]">
            Your completed work
          </h1>
        </header>
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--bb-text-muted)]">
            You haven&apos;t completed any tickets yet. Once a ticket is approved and marked done,
            it will appear here automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bb-text-tertiary)] uppercase">
            Portfolio
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--bb-secondary)]">
            Your completed work
          </h1>
          <p className="mt-1 text-sm text-[var(--bb-text-muted)]">
            {data.totalCount} completed ticket{data.totalCount === 1 ? "" : "s"} — auto-populated
            from every approved revision.
          </p>
        </div>

        <div className="w-full max-w-xs">
          <FormInput
            placeholder="Search title, company, category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="sm"
          />
        </div>
      </header>

      {/* Category filter */}
      {data.categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip
            label="All"
            active={category === ALL_CATEGORY}
            onClick={() => setCategory(ALL_CATEGORY)}
          />
          {data.categories.map((c) => (
            <CategoryChip
              key={c}
              label={c}
              active={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>
      )}

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--bb-text-muted)]">
            No work matches this filter. Try clearing the search or picking a different category.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <PortfolioCard key={item.ticketId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors ${
        active
          ? "border-[var(--bb-primary)] bg-[var(--bb-primary)] text-white"
          : "border-[var(--bb-border)] bg-[var(--bb-bg-page)] text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-warm)]"
      }`}
    >
      {label}
    </button>
  );
}

function PortfolioCard({ item }: { item: PortfolioItem }) {
  const cover = item.thumbnails[0];
  const extras = item.thumbnails.slice(1);

  return (
    <Link
      href={`/creative/tickets/${item.ticketId}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] shadow-sm transition-all hover:border-[var(--bb-primary)] hover:shadow-md"
    >
      {/* Cover image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--bb-bg-warm)]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-[var(--bb-text-muted)]">
            No preview
          </div>
        )}

        {extras.length > 0 && (
          <div className="absolute right-2 bottom-2 flex gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            +{extras.length} more
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-1 flex-col gap-1 px-4 py-3">
        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
          <span>{item.code}</span>
          <span>{formatDate(item.completedAt)}</span>
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold text-[var(--bb-secondary)]">
          {item.title}
        </h3>
        <p className="text-[11px] text-[var(--bb-text-muted)]">
          {item.jobType?.name ?? "—"}
          {item.jobType?.category && (
            <>
              {" · "}
              <span>{item.jobType.category}</span>
            </>
          )}
        </p>
        {item.companyName && (
          <p className="mt-auto pt-2 text-[11px] text-[var(--bb-text-muted)]">
            for <span className="font-semibold">{item.companyName}</span>
            {item.projectName && ` — ${item.projectName}`}
          </p>
        )}
      </div>
    </Link>
  );
}
