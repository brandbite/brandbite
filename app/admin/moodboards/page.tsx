// -----------------------------------------------------------------------------
// @file: app/admin/moodboards/page.tsx
// @purpose: Every moodboard on the platform, including creatives' private ones,
//           for the brandbite team. Opening one is view only.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  EmptyState,
  FilterBar,
  fmt,
  PageHeader,
  plural,
  SearchInput,
  Select,
  Skeleton,
  Table,
  TableFooter,
  Td,
  Th,
  Tr,
} from "@/components/admin/v2/ui";

type AdminMoodboard = {
  id: string;
  title: string;
  companyName: string | null;
  createdByName: string;
  ticketTitle: string | null;
  ticketCode: string | null;
  isCreativeBoard: boolean;
  sharedWithCustomer: boolean;
  itemCount: number;
  updatedAt: string;
};

type OwnerFilter = "ALL" | "CUSTOMER" | "CREATIVE";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminMoodboardsPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<AdminMoodboard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<OwnerFilter>("ALL");

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/moodboards", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      setBoards(json.moodboards ?? []);
    } catch (error) {
      console.error("[admin.moodboards] load error", error);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (boards ?? []).filter((b) => {
      if (owner === "CUSTOMER" && b.isCreativeBoard) return false;
      if (owner === "CREATIVE" && !b.isCreativeBoard) return false;
      const text = [b.title, b.companyName, b.createdByName, b.ticketTitle, b.ticketCode]
        .join(" ")
        .toLowerCase();
      return terms.every((t) => text.includes(t));
    });
  }, [boards, query, owner]);

  return (
    <>
      <PageHeader
        title="Moodboards"
        description="Every board on the platform, including creatives' private ones. Opening one is view only."
      />

      {failed && (
        <div className="mb-6">
          <Callout
            tone="error"
            title="We couldn't load moodboards"
            action={
              <Button size="sm" onClick={load}>
                Try again
              </Button>
            }
          />
        </div>
      )}

      <Card padding="none">
        <div className="px-6 pt-5">
          <FilterBar
            trailing={
              boards
                ? `${fmt(visible.length)} ${plural(visible.length, "moodboard", "moodboards")}`
                : null
            }
          >
            <SearchInput
              className="min-w-[200px] flex-1"
              value={query}
              onChange={setQuery}
              placeholder="Search moodboards"
              label="Search moodboards by title, company, person or job"
            />
            <div className="w-full sm:w-48">
              <Select
                aria-label="Filter by owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value as OwnerFilter)}
              >
                <option value="ALL">All boards</option>
                <option value="CUSTOMER">Customer boards</option>
                <option value="CREATIVE">Creative boards</option>
              </Select>
            </div>
          </FilterBar>
        </div>

        {!boards && !failed ? (
          <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
            <span className="sr-only">Loading moodboards…</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : boards && visible.length === 0 ? (
          <div className="border-t border-[var(--av2-border)]">
            <EmptyState
              title={boards.length === 0 ? "No moodboards yet" : "No moodboards match"}
              description={
                boards.length === 0
                  ? "Boards appear here once customers or creatives create them."
                  : "Try a different search or filter."
              }
            />
          </div>
        ) : boards ? (
          <>
            <Table label="Moodboards">
              <thead>
                <tr>
                  <Th>Moodboard</Th>
                  <Th>Belongs to</Th>
                  <Th>Created by</Th>
                  <Th>Job</Th>
                  <Th align="right">Items</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((b) => (
                  <Tr
                    key={b.id}
                    onSelect={() => router.push(`/admin/moodboards/${b.id}`)}
                    label={`Open ${b.title}`}
                  >
                    <Td>
                      <span className="font-semibold">{b.title}</span>
                    </Td>
                    <Td>
                      {b.isCreativeBoard ? (
                        <Badge tone={b.sharedWithCustomer ? "green" : "neutral"}>
                          {b.sharedWithCustomer ? "Creative, shared" : "Creative, private"}
                        </Badge>
                      ) : (
                        b.companyName || DASH
                      )}
                    </Td>
                    <Td>{b.createdByName}</Td>
                    <Td>
                      {b.ticketTitle ? (
                        <>
                          <div>{b.ticketTitle}</div>
                          <div className="text-xs text-[var(--av2-text-2)]">{b.ticketCode}</div>
                        </>
                      ) : (
                        DASH
                      )}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {fmt(b.itemCount)}
                    </Td>
                    <Td className="whitespace-nowrap text-[var(--av2-text-2)]">
                      {formatDate(b.updatedAt)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(visible.length)} of {fmt(boards.length)}{" "}
                {plural(boards.length, "moodboard", "moodboards")}
              </span>
            </TableFooter>
          </>
        ) : null}
      </Card>
    </>
  );
}
