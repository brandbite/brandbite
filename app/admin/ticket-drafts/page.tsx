// -----------------------------------------------------------------------------
// @file: app/admin/ticket-drafts/page.tsx
// @purpose: Every unsent request draft on the platform, for the brandbite team.
//           View only: a draft belongs to the person writing it.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  DetailPanel,
  EmptyState,
  FilterBar,
  fmt,
  PageHeader,
  plural,
  SearchInput,
  Skeleton,
  SplitView,
  Table,
  TableFooter,
  Td,
  Th,
  Tr,
} from "@/components/admin/v2/ui";
import { SafeHtml } from "@/components/ui/safe-html";

type AdminDraft = {
  id: string;
  title: string;
  description: string;
  updatedAt: string;
  companyName: string;
  createdByName: string;
  jobTypeName: string | null;
  attachments: { id: string; originalName: string | null; bytes: number; url: string | null }[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function draftTitle(draft: AdminDraft) {
  return draft.title.trim() || "Untitled request";
}

export default function AdminTicketDraftsPage() {
  const [drafts, setDrafts] = useState<AdminDraft[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/admin/ticket-drafts", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      setDrafts(json.drafts ?? []);
    } catch (error) {
      console.error("[admin.ticket-drafts] load error", error);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (drafts ?? []).filter((d) => {
      const text = [d.title, d.companyName, d.createdByName, d.jobTypeName].join(" ").toLowerCase();
      return terms.every((t) => text.includes(t));
    });
  }, [drafts, query]);

  const selected = (drafts ?? []).find((d) => d.id === selectedId) ?? null;

  return (
    <>
      <PageHeader
        title="Request drafts"
        description="Requests customers have saved but not sent. They cost no tokens and haven't reached anyone. View only."
      />

      {failed && (
        <div className="mb-6">
          <Callout
            tone="error"
            title="We couldn't load drafts"
            action={
              <Button size="sm" onClick={load}>
                Try again
              </Button>
            }
          />
        </div>
      )}

      <SplitView
        panel={
          selected ? (
            <DetailPanel title={draftTitle(selected)} onClose={() => setSelectedId(null)}>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">Draft</Badge>
                  <span className="text-sm text-[var(--av2-text-2)]">
                    {selected.companyName} · {selected.createdByName}
                  </span>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-semibold">Brief</h3>
                  {selected.description.replace(/<[^>]*>|&nbsp;/g, "").trim() ? (
                    <SafeHtml html={selected.description} className="text-sm break-words" />
                  ) : (
                    <p className="text-sm text-[var(--av2-text-2)]">No brief yet.</p>
                  )}
                </div>
                {selected.attachments.length > 0 ? (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Files</h3>
                    <ul className="space-y-1 text-sm">
                      {selected.attachments.map((a) => (
                        <li key={a.id} className="break-words">
                          {a.url ? (
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-[var(--av2-link)] underline"
                            >
                              {a.originalName ?? "File"}
                            </a>
                          ) : (
                            (a.originalName ?? "File")
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </DetailPanel>
          ) : null
        }
      >
        <Card padding="none">
          <div className="px-6 pt-5">
            <FilterBar
              trailing={
                drafts
                  ? `${fmt(visible.length)} ${plural(visible.length, "draft", "drafts")}`
                  : null
              }
            >
              <SearchInput
                className="min-w-[200px] flex-1"
                value={query}
                onChange={setQuery}
                placeholder="Search drafts"
                label="Search drafts by title, company, person or service"
              />
            </FilterBar>
          </div>

          {!drafts && !failed ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading drafts…</span>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : drafts && visible.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title={drafts.length === 0 ? "No drafts" : "No drafts match"}
                description={
                  drafts.length === 0
                    ? "Drafts appear here once customers start writing requests."
                    : "Try a different search."
                }
              />
            </div>
          ) : drafts ? (
            <>
              <Table label="Request drafts">
                <thead>
                  <tr>
                    <Th>Draft</Th>
                    <Th>Company</Th>
                    <Th>Written by</Th>
                    <Th>Service</Th>
                    <Th align="right">Files</Th>
                    <Th>Updated</Th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => (
                    <Tr
                      key={d.id}
                      selected={d.id === selectedId}
                      onSelect={() => setSelectedId(d.id)}
                      label={`Open ${draftTitle(d)}`}
                    >
                      <Td>
                        <span className="font-semibold">{draftTitle(d)}</span>
                      </Td>
                      <Td>{d.companyName}</Td>
                      <Td>{d.createdByName}</Td>
                      <Td>{d.jobTypeName ?? DASH}</Td>
                      <Td align="right" className="tabular-nums">
                        {fmt(d.attachments.length)}
                      </Td>
                      <Td className="whitespace-nowrap text-[var(--av2-text-2)]">
                        {formatDate(d.updatedAt)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <TableFooter>
                <span className="tabular-nums">
                  Showing {fmt(visible.length)} of {fmt(drafts.length)}{" "}
                  {plural(drafts.length, "draft", "drafts")}
                </span>
              </TableFooter>
            </>
          ) : null}
        </Card>
      </SplitView>
    </>
  );
}
