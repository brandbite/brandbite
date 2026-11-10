// -----------------------------------------------------------------------------
// @file: app/creative/portfolio/page.tsx
// @purpose: Auto-populated portfolio for the signed-in creative. Displays
//           every completed ticket with its final-revision thumbnails, with
//           a category filter and search input.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { IconArrowUpRight, IconDocument } from "@/components/admin/v2/icons";
import {
  Badge,
  buttonClass,
  Callout,
  Card,
  DASH,
  EmptyState,
  FilterChips,
  fmt,
  IconTile,
  PageHeader,
  plural,
  SearchInput,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
} from "@/components/admin/v2/ui";
import { formatDate, ListFooter, pageOf } from "@/components/dashboard/money/money-ui";

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

type ViewMode = "grid" | "list";

const ALL_CATEGORY = "__ALL__";
const PAGE_SIZE = 8;

const HEADER = {
  title: "Your completed work",
  description: "Approved work is collected here automatically.",
};

export default function CreativePortfolioPage() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);

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

  const paged = pageOf(filteredItems, page, PAGE_SIZE);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <>
        <PageHeader {...HEADER} />
        <div aria-busy="true" aria-label="Loading portfolio" className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-72" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader {...HEADER} />
        <Callout tone="error" title="We couldn't load your portfolio">
          {error}
        </Callout>
      </>
    );
  }

  if (!data || data.totalCount === 0) {
    return (
      <>
        <PageHeader {...HEADER} />
        <Card>
          <EmptyState
            icon={<IconDocument />}
            title="Nothing here yet"
            description="You haven't completed any requests yet. Once a request is approved and marked done, it will appear here automatically."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        {...HEADER}
        meta={
          <>
            {fmt(data.totalCount)} completed {plural(data.totalCount, "request", "requests")}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SearchInput
          className="min-w-[240px] flex-[2]"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search title, company, category…"
          label="Search your completed work"
        />
        {data.categories.length > 0 ? (
          <div className="min-w-[200px] flex-1">
            <Select
              aria-label="Filter by category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value={ALL_CATEGORY}>All categories</option>
              {data.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <FilterChips
          label="View"
          options={[
            { value: "grid" as ViewMode, label: "Grid" },
            { value: "list" as ViewMode, label: "List" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <EmptyState
            title="No work matches this filter"
            description="Try clearing the search or picking a different category."
          />
        </Card>
      ) : (
        <>
          {view === "grid" ? (
            <div className="grid gap-6 xl:grid-cols-2">
              {paged.rows.map((item) => (
                <PortfolioCard key={item.ticketId} item={item} />
              ))}
              <AboutPortfolio />
            </div>
          ) : (
            <div className="space-y-6">
              <Card padding="none">
                <PortfolioTable items={paged.rows} />
              </Card>
              <AboutPortfolio />
            </div>
          )}
          <div className="mt-2 [&>div]:border-t-0 [&>div]:px-0">
            <ListFooter {...paged} onPage={setPage} />
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function AboutPortfolio() {
  return (
    <Card>
      <div className="flex gap-4">
        <IconTile tone="peach">
          <IconDocument />
        </IconTile>
        <div className="min-w-0">
          <h2 className="text-xl leading-7 font-semibold">Built from approved work</h2>
          <p className="mt-1 text-base text-[var(--av2-text-2)]">
            Every request that is approved and marked done appears here automatically, with the
            images from its final revision.
          </p>
        </div>
      </div>
    </Card>
  );
}

function PortfolioCard({ item }: { item: PortfolioItem }) {
  const cover = item.thumbnails[0];
  const extras = item.thumbnails.slice(1);

  return (
    <Link
      href={`/creative/tickets/${item.ticketId}`}
      aria-label={`Open request: ${item.title}`}
      className="group flex h-full flex-col gap-5 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-6 transition-colors hover:border-[var(--av2-accent)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none sm:flex-row"
    >
      {/* Cover image */}
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-[var(--av2-bg)] sm:w-[280px]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-[var(--av2-text-2)]">
            No preview
          </div>
        )}

        {extras.length > 0 && (
          <div className="absolute right-2 bottom-2">
            <Badge>+{extras.length} more</Badge>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-[var(--av2-text-2)]">
          <span className="font-medium">{item.code}</span>
          <span>{formatDate(item.completedAt)}</span>
        </div>
        <h2 className="mt-1 line-clamp-2 text-xl leading-7 font-semibold">{item.title}</h2>
        <p className="mt-1 text-sm text-[var(--av2-text-2)]">
          {item.jobType?.name ?? DASH}
          {item.jobType?.category ? ` · ${item.jobType.category}` : null}
        </p>
        {item.companyName ? (
          <p className="mt-1 text-sm">
            {item.companyName}
            {item.projectName ? ` · ${item.projectName}` : null}
          </p>
        ) : null}
        <div className="mt-3">
          <Badge tone="green" dot>
            Done
          </Badge>
        </div>
        <span className={`${buttonClass("primary")} mt-auto self-start max-sm:mt-4 sm:mt-4`}>
          Open request
          <IconArrowUpRight />
        </span>
      </div>
    </Link>
  );
}

function PortfolioTable({ items }: { items: PortfolioItem[] }) {
  return (
    <Table label="Your completed work">
      <thead>
        <tr>
          <Th className="max-sm:hidden">ID</Th>
          <Th>Request</Th>
          <Th className="max-md:hidden">Service</Th>
          <Th className="max-lg:hidden">Company</Th>
          <Th>Completed</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.ticketId} className="border-b border-[var(--av2-border)] last:border-b-0">
            <Td className="whitespace-nowrap text-[var(--av2-text-2)] max-sm:hidden">
              {item.code}
            </Td>
            <Td>
              <Link
                href={`/creative/tickets/${item.ticketId}`}
                className="font-medium hover:underline"
              >
                {item.title}
              </Link>
            </Td>
            <Td className="max-md:hidden">{item.jobType?.name ?? DASH}</Td>
            <Td className="max-lg:hidden">
              {item.companyName ?? DASH}
              {item.projectName ? ` · ${item.projectName}` : null}
            </Td>
            <Td className="whitespace-nowrap">{formatDate(item.completedAt)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
