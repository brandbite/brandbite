// -----------------------------------------------------------------------------
// @file: app/admin/support-content/page.tsx
// @purpose: Admin list of every Support guide (customer, creative, admin) with
//           its CMS state: written in code, edited here, hidden, or added
//           here. Guides whose code changed after an edit are flagged for
//           review; the deploy notification links to ?filter=review.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  EmptyState,
  FilterChips,
  PageHeader,
  SearchInput,
  Skeleton,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
  type Tone,
} from "@/components/admin/v2/ui";
import { IconFaq } from "@/components/navigation/nav-icons";

type Role = "customer" | "creative" | "admin" | "public";
type State = "code" | "edited" | "cms" | "hidden";
type Status = "IN_SYNC" | "CODE_CHANGED" | "CODE_REMOVED";

type Row = {
  role: Role;
  slug: string;
  title: string;
  category: string;
  state: State;
  status: Status;
  ownerOnly: boolean;
  updatedAt: string | null;
};

type Filter = "all" | "review" | "edited" | "cms" | "hidden";

const ROLE_TABS: { value: Role; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "creative", label: "Creative" },
  { value: "admin", label: "Admin" },
  { value: "public", label: "Public guides" },
];

const STATE_BADGE: Record<State, { label: string; tone: Tone }> = {
  code: { label: "From code", tone: "neutral" },
  edited: { label: "Edited", tone: "lavender" },
  cms: { label: "Added here", tone: "blue" },
  hidden: { label: "Hidden", tone: "amber" },
};

const STATUS_BADGE: Partial<Record<Status, { label: string; tone: Tone }>> = {
  CODE_CHANGED: { label: "Code updated", tone: "red" },
  CODE_REMOVED: { label: "Removed from code", tone: "red" },
};

const needsReview = (row: Row) => row.status !== "IN_SYNC";

function matches(row: Row, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "review") return needsReview(row);
  return row.state === filter;
}

export default function SupportContentPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialFilter = (params.get("filter") as Filter | null) ?? "all";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>((params.get("role") as Role | null) ?? "customer");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/support-guides", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { guides: Row[] };
      setRows(json.guides);
    } catch {
      setError("The guides couldn't be loaded.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Opened from the notification: jump to the first role with something to review.
  useEffect(() => {
    if (!rows || initialFilter !== "review") return;
    const first = rows.find(needsReview);
    if (first) setRole(first.role);
  }, [rows, initialFilter]);

  const reviewCount = rows?.filter(needsReview).length ?? 0;
  const inRole = useMemo(() => (rows ?? []).filter((row) => row.role === role), [rows, role]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inRole
      .filter((row) => matches(row, filter))
      .filter(
        (row) =>
          !q ||
          row.title.toLowerCase().includes(q) ||
          row.slug.includes(q) ||
          row.category.toLowerCase().includes(q),
      )
      .sort((a, b) => Number(needsReview(b)) - Number(needsReview(a)));
  }, [inRole, filter, query]);

  const count = (f: Filter) => inRole.filter((row) => matches(row, f)).length;

  return (
    <div>
      <PageHeader
        title="Support content"
        description="Guides are written in code with each feature. Edit, hide or add guides here; your version wins until you change it back."
        actions={
          <ButtonLink href={`/admin/support-content/new?role=${role}`} variant="primary">
            New guide
          </ButtonLink>
        }
      />

      {reviewCount > 0 ? (
        <div className="mb-6">
          <Callout
            tone="warning"
            title={`${reviewCount} ${reviewCount === 1 ? "guide needs" : "guides need"} your review`}
            action={
              filter !== "review" ? (
                <Button size="sm" onClick={() => setFilter("review")}>
                  Show them
                </Button>
              ) : undefined
            }
          >
            A release changed or removed guides that were edited here. Your text is still live; open
            each one to keep it, take the new version, or merge them.
          </Callout>
        </div>
      ) : null}

      {error ? (
        <div className="mb-6">
          <Callout
            tone="error"
            title="Couldn't load guides"
            action={
              <Button size="sm" onClick={() => void load()}>
                Try again
              </Button>
            }
          >
            {error}
          </Callout>
        </div>
      ) : null}

      <Card>
        <div className="flex flex-col gap-4 p-4">
          <Tabs
            tabs={ROLE_TABS.map((tab) => ({
              value: tab.value,
              label: `${tab.label} (${(rows ?? []).filter((row) => row.role === tab.value).length})`,
            }))}
            value={role}
            onChange={setRole}
            label="Who the guides are for"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterChips
              label="Filter guides"
              value={filter}
              onChange={(next) => {
                setFilter(next);
                router.replace(next === "all" ? "/admin/support-content" : `?filter=${next}`);
              }}
              options={[
                { value: "all", label: "All", count: count("all") },
                { value: "review", label: "Needs review", count: count("review") },
                { value: "edited", label: "Edited", count: count("edited") },
                { value: "cms", label: "Added here", count: count("cms") },
                { value: "hidden", label: "Hidden", count: count("hidden") },
              ]}
            />
            <div className="w-full max-w-xs">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search guides"
                label="Search guides"
              />
            </div>
          </div>
        </div>

        {rows === null && !error ? (
          <div className="flex flex-col gap-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<IconFaq width={28} height={28} />}
            title="No guides here"
            description="Try another filter, or add a guide."
          />
        ) : (
          <Table label="Support guides">
            <thead>
              <tr>
                <Th>Guide</Th>
                <Th>Category</Th>
                <Th>State</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const href = `/admin/support-content/${row.role}/${row.slug}`;
                const status = STATUS_BADGE[row.status];
                return (
                  <Tr
                    key={`${row.role}-${row.slug}`}
                    onSelect={() => router.push(href)}
                    label={row.title}
                  >
                    <Td>
                      <Link href={href} className="font-medium hover:underline">
                        {row.title}
                      </Link>
                      <div className="text-xs text-[var(--av2-text-2)]">{row.slug}</div>
                    </Td>
                    <Td>{row.category}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={STATE_BADGE[row.state].tone}>
                          {STATE_BADGE[row.state].label}
                        </Badge>
                        {status ? (
                          <Badge tone={status.tone} dot>
                            {status.label}
                          </Badge>
                        ) : null}
                        {row.ownerOnly ? <Badge tone="neutral">Owner only</Badge> : null}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
