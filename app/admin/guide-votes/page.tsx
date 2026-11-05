// -----------------------------------------------------------------------------
// @file: app/admin/guide-votes/page.tsx
// @purpose: "Was this helpful?" totals per Support guide, most "No" answers
//           first, so admins can see which guides to improve.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  EmptyState,
  FilterBar,
  KpiCard,
  PageHeader,
  Select,
  Skeleton,
  Table,
  TableFooter,
  Td,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import type { GuideVoteRow } from "@/lib/support/guide-votes";

const AUDIENCE_LABEL: Record<GuideVoteRow["audience"], string> = {
  customer: "Customer",
  creative: "Creative",
  admin: "Admin",
};

function percentHelpful(helpful: number, total: number) {
  return total === 0 ? null : Math.round((helpful / total) * 100);
}

export default function AdminGuideVotesPage() {
  const [rows, setRows] = useState<GuideVoteRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [audience, setAudience] = useState("ALL");
  const [coverage, setCoverage] = useState("VOTED");

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/admin/guide-votes", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      setRows(json.rows);
    } catch (error) {
      console.error("[admin.guide-votes] load error", error);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const inAudience = useMemo(
    () => (rows ?? []).filter((r) => audience === "ALL" || r.audience === audience),
    [rows, audience],
  );
  const visible = useMemo(
    () => inAudience.filter((r) => coverage === "ALL" || r.total > 0),
    [inAudience, coverage],
  );

  const helpful = inAudience.reduce((sum, r) => sum + r.helpful, 0);
  const notHelpful = inAudience.reduce((sum, r) => sum + r.notHelpful, 0);
  const total = helpful + notHelpful;
  const rate = percentHelpful(helpful, total);
  const ready = rows !== null;

  return (
    <>
      <PageHeader
        title="Guide ratings"
        description="What people answered to “Was this helpful?” on each Support guide."
      />

      {failed && (
        <div className="mb-6">
          <Callout
            tone="error"
            title="We couldn't load guide ratings"
            action={
              <Button size="sm" onClick={load}>
                Try again
              </Button>
            }
          />
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Answers" value={ready ? fmt(total) : DASH} />
        <KpiCard
          label="Answered yes"
          value={rate === null ? DASH : `${rate}%`}
          hint={ready ? `${fmt(helpful)} yes, ${fmt(notHelpful)} no` : undefined}
        />
        <KpiCard
          label="Guides with answers"
          value={ready ? fmt(inAudience.filter((r) => r.total > 0).length) : DASH}
          hint={ready ? `Out of ${fmt(inAudience.length)}` : undefined}
        />
      </div>

      <Card padding="none">
        <div className="px-6 pt-5">
          <FilterBar>
            <div className="w-full sm:w-44">
              <Select
                aria-label="Filter by audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="ALL">All audiences</option>
                <option value="customer">Customer</option>
                <option value="creative">Creative</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div className="w-full sm:w-56">
              <Select
                aria-label="Filter by answers"
                value={coverage}
                onChange={(e) => setCoverage(e.target.value)}
              >
                <option value="VOTED">Guides with answers</option>
                <option value="ALL">All guides</option>
              </Select>
            </div>
          </FilterBar>
        </div>

        {!ready && !failed ? (
          <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
            <span className="sr-only">Loading guide ratings…</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : ready && visible.length === 0 ? (
          <div className="border-t border-[var(--av2-border)]">
            <EmptyState
              title="No answers yet"
              description="Answers appear here once people use “Was this helpful?” at the end of a guide."
            />
          </div>
        ) : ready ? (
          <>
            <Table label="Guide ratings">
              <thead>
                <tr>
                  <Th>Guide</Th>
                  <Th>Audience</Th>
                  <Th align="right">No</Th>
                  <Th align="right">Yes</Th>
                  <Th align="right">Answered yes</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const percent = percentHelpful(r.helpful, r.total);
                  return (
                    <Tr key={`${r.audience}/${r.slug}`}>
                      <Td>
                        <div className="font-semibold">{r.title}</div>
                        <div className="text-xs text-[var(--av2-text-2)]">{r.category}</div>
                      </Td>
                      <Td>
                        <Badge>{AUDIENCE_LABEL[r.audience]}</Badge>
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {fmt(r.notHelpful)}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {fmt(r.helpful)}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {percent === null ? DASH : `${percent}%`}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(visible.length)} {plural(visible.length, "guide", "guides")}
              </span>
            </TableFooter>
          </>
        ) : null}
      </Card>
    </>
  );
}
